import express from "express";
import fs from "fs";
import { db } from "../db.js";
import {
  applyOrderLoyaltyReservations,
  buildLoyaltyApplication,
  releaseOrderLoyaltyReservations,
  resetCustomerLoyaltyOnUsernameChange,
} from "../loyalty.js";

export const publicRouter = express.Router();


const MAX_SQL_VARS = 900;
const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN || "";

async function fetchTelegramChat(telegramId) {
  if (!TELEGRAM_BOT_TOKEN || !telegramId) {
    return null;
  }

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat?chat_id=${encodeURIComponent(String(telegramId))}`);
  const payload = await response.json();

  if (!response.ok || !payload?.ok) {
    const description = payload?.description || `HTTP ${response.status}`;
    throw new Error(description);
  }

  return payload.result || null;
}


function normalizeTelegramUsername(value) {
  return typeof value === "string" ? value.trim().replace(/^@+/, "") : "";
}

async function resolveTelegramUsernameStatus(telegramId) {
  const dbCustomer = db
    .prepare("SELECT telegram_username, first_name, last_name FROM customers WHERE telegram_id = ?")
    .get(telegramId);

  if (!TELEGRAM_BOT_TOKEN) {
    return {
      ok: true,
      status: "retry",
      hasUsername: false,
      username: null,
      source: "unavailable",
      canRetryLive: false,
      storedUsername: normalizeTelegramUsername(dbCustomer?.telegram_username),
      message: "Проверка username временно недоступна. Закройте и откройте магазин заново.",
    };
  }

  try {
    const chat = await fetchTelegramChat(telegramId);
    const username = normalizeTelegramUsername(chat?.username);
    const firstName = typeof chat?.first_name === "string" && chat.first_name.trim() !== ""
      ? chat.first_name.trim()
      : dbCustomer?.first_name || null;
    const lastName = typeof chat?.last_name === "string" && chat.last_name.trim() !== ""
      ? chat.last_name.trim()
      : dbCustomer?.last_name || null;

    if (dbCustomer) {
      db.prepare(`
        UPDATE customers
        SET telegram_username = ?,
            first_name = COALESCE(?, first_name),
            last_name = COALESCE(?, last_name),
            last_visit_at = DATETIME('now'),
            updated_at = DATETIME('now')
        WHERE telegram_id = ?
      `).run(username || null, firstName, lastName, telegramId);
    }

    const status = username ? "confirmed" : "missing";
    const message = username
      ? "Username подтвержден"
      : "Telegram пока не передал ваш username. Если вы только что его установили, закройте магазин и откройте заново - это обновит данные.";

    return {
      ok: true,
      status,
      hasUsername: Boolean(username),
      username: username || null,
      source: "telegram",
      canRetryLive: true,
      message,
    };
  } catch (telegramError) {
    return {
      ok: true,
      status: "retry",
      hasUsername: false,
      username: null,
      source: "unavailable",
      canRetryLive: true,
      warning: "live_check_failed",
      storedUsername: normalizeTelegramUsername(dbCustomer?.telegram_username),
      message: "Telegram пока не передал обновлённый username. Подождите несколько секунд и попробуйте ещё раз.",
    };
  }
}

function chunkArray(arr, size = MAX_SQL_VARS) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function pushToMap(map, key, value) {
  const list = map.get(key);
  if (list) {
    list.push(value);
  } else {
    map.set(key, [value]);
  }
}

function pushVariantImage(map, productId, variantId, url) {
  let byProduct = map.get(productId);
  if (!byProduct) {
    byProduct = new Map();
    map.set(productId, byProduct);
  }
  const list = byProduct.get(variantId);
  if (list) {
    list.push(url);
  } else {
    byProduct.set(variantId, [url]);
  }
}

const ACTIVE_CUSTOMER_ORDER_STATUSES = new Set(["new", "in_progress"]);

function recordOrderStatusChange(orderId, previousStatus, newStatus, note) {
  if (!orderId || previousStatus === newStatus) {
    return;
  }

  try {
    db.prepare(
      `
      INSERT INTO order_status_history (id, order_id, previous_status, new_status, note)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run(
      generateId("osh"),
      orderId,
      previousStatus || null,
      newStatus,
      note || null,
    );
  } catch (error) {
    console.warn("[public] Failed to record status history:", error.message);
  }
}

function findOwnedActiveOrder({ orderId = null, telegramId = "", telegramUsername = "" } = {}) {
  const normalizedUsername = normalizeTelegramUsername(telegramUsername).toLowerCase();

  if (!telegramId && !normalizedUsername) {
    return null;
  }

  const params = [];
  let sql = `
    SELECT
      o.*,
      c.telegram_id AS customer_telegram_id,
      c.first_name AS customer_first_name,
      c.last_name AS customer_last_name,
      COALESCE(o.telegram_username, c.telegram_username) AS resolved_telegram_username
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE COALESCE(o.archived, 0) = 0
      AND o.status IN ('new', 'in_progress')
  `;

  if (orderId) {
    sql += " AND o.id = ?";
    params.push(orderId);
  }

  sql += " ORDER BY o.updated_at DESC, o.created_at DESC";

  const candidates = db.prepare(sql).all(...params);

  return (
    candidates.find((candidate) => {
      if (
        telegramId &&
        candidate.customer_telegram_id &&
        String(candidate.customer_telegram_id) === String(telegramId)
      ) {
        return true;
      }

      if (!normalizedUsername) {
        return false;
      }

      const candidateUsername = normalizeTelegramUsername(
        candidate.resolved_telegram_username,
      ).toLowerCase();
      return Boolean(candidateUsername) && candidateUsername === normalizedUsername;
    }) || null
  );
}

function restoreStockForOrderItems(orderItems) {
  for (const item of orderItems) {
    if (item.variant_id) {
      db.prepare(
        "UPDATE product_variants SET stock = stock + ? WHERE id = ?",
      ).run(item.quantity, item.variant_id);
    } else if (item.product_id) {
      db.prepare(
        "UPDATE products SET stock = stock + ? WHERE id = ?",
      ).run(item.quantity, item.product_id);
    }
  }
}

function clearPromoUsageForOrder(order) {
  if (!order?.promo_code_id) {
    return;
  }

  db.prepare(
    "UPDATE promo_codes SET current_uses = MAX(current_uses - 1, 0) WHERE id = ?",
  ).run(order.promo_code_id);
  db.prepare("DELETE FROM promo_usage WHERE order_id = ?").run(order.id);
}

function describeOrderItem(item) {
  const baseTitle =
    item.base_product_title ||
    item.product_title ||
    item.title ||
    item.product_id ||
    "товар";
  return item.variant_name ? `${baseTitle} (${item.variant_name})` : baseTitle;
}

function buildManagerActionNote({
  previousItems,
  nextItems,
  previousPromoCodeText,
  nextPromoCodeText,
}) {
  const previousMap = new Map();
  const nextMap = new Map();

  previousItems.forEach((item) => {
    previousMap.set(`${item.product_id || ""}::${item.variant_id || ""}`, item);
  });
  nextItems.forEach((item) => {
    nextMap.set(`${item.product_id || ""}::${item.variant_id || ""}`, item);
  });

  const parts = [];

  for (const [key, nextItem] of nextMap.entries()) {
    const previousItem = previousMap.get(key);
    if (!previousItem) {
      parts.push(`добавлено: ${describeOrderItem(nextItem)} x${nextItem.quantity}`);
      continue;
    }

    if (Number(previousItem.quantity) !== Number(nextItem.quantity)) {
      parts.push(
        `количество: ${describeOrderItem(nextItem)} ${previousItem.quantity}→${nextItem.quantity}`,
      );
    }
  }

  for (const [key, previousItem] of previousMap.entries()) {
    if (!nextMap.has(key)) {
      parts.push(`убрано: ${describeOrderItem(previousItem)} x${previousItem.quantity}`);
    }
  }

  if ((previousPromoCodeText || null) !== (nextPromoCodeText || null)) {
    parts.push(
      nextPromoCodeText
        ? `промокод: ${nextPromoCodeText}`
        : "промокод удалён",
    );
  }

  return parts.slice(0, 4).join("; ") || "Клиент обновил заказ";
}

function loadCustomerOrderItems(orderId) {
  const items = db
    .prepare(
      `
      SELECT
        oi.*,
        p.categoryId AS category_id,
        p.groupId AS group_id,
        p.description AS product_description,
        g.cover_image AS group_cover_image,
        c.cover_image AS category_cover_image
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN category_groups g ON g.id = p.groupId
      LEFT JOIN categories c ON c.id = p.categoryId
      WHERE oi.order_id = ?
      ORDER BY oi.rowid ASC
    `,
    )
    .all(orderId);

  const baseImageStmt = db.prepare(
    "SELECT url FROM product_images WHERE productId = ? AND variant_id IS NULL ORDER BY position ASC",
  );
  const variantImageStmt = db.prepare(
    "SELECT url FROM product_images WHERE productId = ? AND variant_id = ? ORDER BY position ASC",
  );

  return items.map((item) => {
    const variantImages =
      item.product_id && item.variant_id
        ? variantImageStmt
            .all(item.product_id, item.variant_id)
            .map((row) => row.url)
        : [];
    const baseImages = item.product_id
      ? baseImageStmt.all(item.product_id).map((row) => row.url)
      : [];

    const image =
      variantImages[0] ||
      baseImages[0] ||
      item.group_cover_image ||
      item.category_cover_image ||
      null;

    return {
      id: item.id,
      product_id: item.product_id,
      product_title: item.product_title,
      product_description: item.product_description || null,
      group_name: item.group_name || null,
      base_product_id: item.base_product_id || null,
      base_product_title: item.base_product_title || item.product_title,
      variant_id: item.variant_id || null,
      variant_name: item.variant_name || null,
      quantity: Number(item.quantity || 0),
      price_per_unit: Number(item.price_per_unit || 0),
      discount_amount: Number(item.discount_amount || 0),
      manual_discount_amount: Number(item.manual_discount_amount || 0),
      loyalty_discount_amount: Number(item.loyalty_discount_amount || 0),
      loyalty_units_applied: Number(item.loyalty_units_applied || 0),
      total_price: Number(item.total_price || 0),
      total_cost: Number(item.total_cost || 0),
      image,
      cart_item: {
        productId: item.product_id,
        title: item.product_title,
        productTitle: item.base_product_title || item.product_title,
        groupName: item.group_name || null,
        priceRub: Number(item.price_per_unit || 0),
        quantity: Number(item.quantity || 0),
        image,
        variantId: item.variant_id || null,
        variantName: item.variant_name || null,
        groupId: item.group_id || null,
        categoryId: item.category_id || null,
      },
    };
  });
}

function serializeCustomerOrder(order) {
  const items = loadCustomerOrderItems(order.id);
  const isActive = ACTIVE_CUSTOMER_ORDER_STATUSES.has(order.status);

  return {
    found: true,
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    delivery_type: order.delivery_type,
    delivery_address: order.delivery_address || null,
    phone: order.phone || null,
    notes: order.notes || null,
    total_amount: Number(order.total_amount || 0),
    discount_amount: Number(order.discount_amount || 0),
    final_amount: Number(order.final_amount || 0),
    promo_code_text: order.promo_code_text || null,
    telegram_username: normalizeTelegramUsername(
      order.resolved_telegram_username || order.telegram_username,
    ) || null,
    created_at: order.created_at,
    updated_at: order.updated_at,
    needs_manager_action: Number(order.needs_manager_action || 0),
    manager_action_type: order.manager_action_type || null,
    manager_action_note: order.manager_action_note || null,
    can_edit: isActive,
    can_cancel: isActive,
    items,
  };
}

publicRouter.get("/api/categories", (req, res) => {
  // ОПТИМИЗАЦИЯ: не загружаем cover_image в списке - экономит ~8MB трафика
  // Фронтенд загружает обложки отдельно через /api/categories/:id/image
  const categoriesRaw = db
    .prepare(
      `
    SELECT c.id, c.slug, c.name, c.[order], c.hide_empty, 
           CASE WHEN c.cover_image IS NOT NULL AND c.cover_image != '' THEN 1 ELSE 0 END as hasCoverImage,
           c.display_mode
    FROM categories c
    ORDER BY c.[order] ASC, c.name ASC
  `,
    )
    .all();

  // Для групп тоже не загружаем cover_image
  const groupsRaw = db
    .prepare(
      `
    SELECT g.id, g.categoryId, g.slug, g.name, 
           CASE WHEN g.cover_image IS NOT NULL AND g.cover_image != '' THEN 1 ELSE 0 END as hasCoverImage,
           g.[order], g.hide_empty, g.parent_group_id, g.meta_label, g.meta_value
    FROM category_groups g
    ORDER BY g.categoryId ASC, g.[order] ASC, g.name ASC
  `,
    )
    .all();

  const categoryCountRows = db
    .prepare(
      `
    SELECT categoryId, COUNT(DISTINCT p.id) as total
    FROM products p
    WHERE (
      -- Для товаров без вариантов проверяем stock товара
      (p.has_variants = 0 AND (p.stock IS NULL OR p.stock > 0))
      OR
      -- Для товаров с вариантами проверяем, есть ли варианты в наличии
      (p.has_variants = 1 AND EXISTS (
        SELECT 1 FROM product_variants pv 
        WHERE pv.product_id = p.id 
        AND (pv.stock IS NULL OR pv.stock > 0)
      ))
    )
    GROUP BY categoryId
  `,
    )
    .all();

  const groupCountRows = db
    .prepare(
      `
    SELECT groupId, COUNT(DISTINCT p.id) as total
    FROM products p
    WHERE groupId IS NOT NULL 
      AND (
        -- Для товаров без вариантов проверяем stock товара
        (p.has_variants = 0 AND (p.stock IS NULL OR p.stock > 0))
        OR
        -- Для товаров с вариантами проверяем, есть ли варианты в наличии
        (p.has_variants = 1 AND EXISTS (
          SELECT 1 FROM product_variants pv 
          WHERE pv.product_id = p.id 
          AND (pv.stock IS NULL OR pv.stock > 0)
        ))
      )
    GROUP BY groupId
  `,
    )
    .all();

  const categoryCounts = new Map(
    categoryCountRows.map((row) => [row.categoryId, row.total]),
  );
  const groupCounts = new Map(
    groupCountRows.map((row) => [row.groupId, row.total]),
  );

  const nodes = groupsRaw.map((group) => ({
    id: group.id,
    categoryId: group.categoryId,
    slug: group.slug,
    name: group.name,
    order: group["order"],
    hasCoverImage: group.hasCoverImage === 1,
    hideEmpty: group.hide_empty === 1,
    parentId: group.parent_group_id || null,
    metaLabel: group.meta_label || null,
    metaValue: group.meta_value || null,
    productCount: groupCounts.get(group.id) || 0,
    totalProductCount: 0,
    children: [],
  }));

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const rootsByCategory = new Map();

  nodes.forEach((node) => {
    if (node.parentId && nodesById.has(node.parentId)) {
      nodesById.get(node.parentId).children.push(node);
    } else {
      const list = rootsByCategory.get(node.categoryId) || [];
      list.push(node);
      rootsByCategory.set(node.categoryId, list);
    }
  });

  const computeTotals = (node) => {
    node.children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    let total = Number(node.productCount ?? 0);
    node.children.forEach((child) => {
      total += computeTotals(child);
    });
    node.totalProductCount = total;
    return total;
  };

  rootsByCategory.forEach((list) => {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    list.forEach((node) => computeTotals(node));
  });

  const collectVisible = (node) => {
    if (node.totalProductCount === 0 && node.hideEmpty) {
      return [];
    }
    const result = [
      {
        id: node.id,
        categoryId: node.categoryId,
        slug: node.slug,
        name: node.name,
        order: node.order,
        hasCoverImage: node.hasCoverImage,
        hideEmpty: node.hideEmpty,
        parentId: node.parentId,
        metaLabel: node.metaLabel || null,
        metaValue: node.metaValue || null,
        productCount: node.productCount,
        totalProductCount: node.totalProductCount,
      },
    ];

    node.children.forEach((child) => {
      result.push(...collectVisible(child));
    });
    return result;
  };

  const flattenedGroupsByCategory = new Map();
  rootsByCategory.forEach((nodesList, categoryId) => {
    const collected = [];
    nodesList.forEach((node) => {
      collected.push(...collectVisible(node));
    });
    flattenedGroupsByCategory.set(categoryId, collected);
  });

  const categories = [];

  for (const cat of categoriesRaw) {
    const totalProducts = categoryCounts.get(cat.id) || 0;
    const groups = (flattenedGroupsByCategory.get(cat.id) || []).filter(
      (group) => group.totalProductCount > 0,
    );

    const hasVisibleProducts = totalProducts > 0 || groups.length > 0;

    if (!hasVisibleProducts) {
      continue;
    }

    if (cat.hide_empty === 1 && totalProducts === 0 && groups.length === 0) {
      continue;
    }

    categories.push({
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      order: cat["order"],
      hasCoverImage: cat.hasCoverImage === 1,
      productCount: totalProducts,
      groups,
      displayMode: cat.display_mode || "default",
    });
  }

  res.json(categories);
});

publicRouter.get("/api/banners", (req, res) => {
  const rows = db
    .prepare(
      "SELECT id, image, href, active, [order], openInNewTab FROM banners WHERE active = 1 ORDER BY [order] ASC",
    )
    .all();
  res.json(rows);
});

// Endpoint для получения обложки категории отдельно (оптимизация трафика)
publicRouter.get("/api/categories/:id/image", (req, res) => {
  const { id } = req.params;
  const row = db
    .prepare("SELECT cover_image FROM categories WHERE id = ?")
    .get(id);
  if (!row || !row.cover_image) {
    return res.status(404).json({ error: "Image not found" });
  }
  res.json({ image: row.cover_image });
});

// Endpoint для получения обложки группы категорий
publicRouter.get("/api/category-groups/:id/image", (req, res) => {
  const { id } = req.params;
  const row = db
    .prepare("SELECT cover_image FROM category_groups WHERE id = ?")
    .get(id);
  if (!row || !row.cover_image) {
    return res.status(404).json({ error: "Image not found" });
  }
  res.json({ image: row.cover_image });
});

publicRouter.get("/api/products", (req, res) => {
  const { category, group, sort } = req.query;

  // Pagination params (defaults aligned with frontend)
  // Увеличен максимальный лимит до 1000 для загрузки всех товаров категории
  const limit = Math.min(
    Math.max(parseInt(req.query.limit ?? "50", 10) || 50, 1),
    1000,
  );
  const offset = Math.max(parseInt(req.query.offset ?? "0", 10) || 0, 0);

  let whereClauses = [];
  const whereParams = [];
  let categoryFilterId = null;

  if (category) {
    const cat = db
      .prepare("SELECT id FROM categories WHERE slug = ?")
      .get(String(category));
    if (!cat) {
      return res.json({ products: [], total: 0, hasMore: false });
    }
    categoryFilterId = cat.id;
    whereClauses.push("p.categoryId = ?");
    whereParams.push(cat.id);
  }

  if (group) {
    const groupRow = db
      .prepare("SELECT id, categoryId FROM category_groups WHERE slug = ?")
      .get(String(group));
    if (!groupRow) {
      return res.json({ products: [], total: 0, hasMore: false });
    }
    if (categoryFilterId && groupRow.categoryId !== categoryFilterId) {
      return res.json({ products: [], total: 0, hasMore: false });
    }
    if (!categoryFilterId) {
      categoryFilterId = groupRow.categoryId;
    }
    whereClauses.push("p.groupId = ?");
    whereParams.push(groupRow.id);
  }

  // Hide products with zero stock for public storefront
  // Для товаров без вариантов проверяем stock товара, для товаров с вариантами - stock вариантов
  whereClauses.unshift(`(
    (p.has_variants = 0 AND (p.stock IS NULL OR p.stock > 0))
    OR
    (p.has_variants = 1 AND EXISTS (
      SELECT 1 FROM product_variants pv 
      WHERE pv.product_id = p.id 
      AND (pv.stock IS NULL OR pv.stock > 0)
    ))
  )`);

  const where = `WHERE ${whereClauses.join(" AND ")}`;

  // Sorting
  let orderBy = "ORDER BY p.priceRub ASC";
  switch (String(sort || "price_asc")) {
    case "price_desc":
      orderBy = "ORDER BY p.priceRub DESC";
      break;
    case "newest":
      orderBy = "ORDER BY p.createdAt DESC";
      break;
    case "oldest":
      orderBy = "ORDER BY p.createdAt ASC";
      break;
    default:
      orderBy = "ORDER BY p.priceRub ASC";
  }

  // Total count
  const countSql = `SELECT COUNT(*) as total FROM products p ${where}`;
  const total = whereParams.length
    ? db.prepare(countSql).get(...whereParams).total
    : db.prepare(countSql).get().total;

  // Fetch products with pagination
  // ОПТИМИЗАЦИЯ: не загружаем cover_image категории здесь - это экономит ~80MB трафика
  // Фронтенд загружает обложки категорий отдельно через /api/categories/:id/image
  const sql = `
    SELECT 
      p.id, 
      p.categoryId, 
      p.groupId,
      p.title, 
      p.priceRub, 
      p.description, 
      p.variant AS variant,
      p.strength AS strength,
      p.cost_price AS costPrice,
      p.stock AS stock,
      p.min_stock AS minStock,
      p.use_category_image AS useCategoryImage,
      p.has_variants AS hasVariants,
      p.createdAt,
      g.slug as groupSlug,
      g.name as groupName
    FROM products p
    LEFT JOIN category_groups g ON p.groupId = g.id
    ${where}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;
  const products = whereParams.length
    ? db.prepare(sql).all(...whereParams, limit, offset)
    : db.prepare(sql).all(limit, offset);

  const productIds = products.map((p) => p.id);
  const baseImagesByProduct = new Map();
  const variantImagesByProduct = new Map();
  const linksByProduct = new Map();
  const badgesByProduct = new Map();
  const variantsByProduct = new Map();

  if (productIds.length > 0) {
    for (const chunk of chunkArray(productIds)) {
      const placeholders = chunk.map(() => "?").join(",");

      const imageRows = db
        .prepare(
          `
        SELECT productId, variant_id AS variantId, url, position
        FROM product_images
        WHERE productId IN (${placeholders})
        ORDER BY productId ASC, variant_id ASC, position ASC
      `,
        )
        .all(...chunk);
      imageRows.forEach((row) => {
        if (row.variantId) {
          pushVariantImage(
            variantImagesByProduct,
            row.productId,
            row.variantId,
            row.url,
          );
        } else {
          pushToMap(baseImagesByProduct, row.productId, row.url);
        }
      });

      const linkRows = db
        .prepare(
          `
        SELECT productId, label, url, position
        FROM product_links
        WHERE productId IN (${placeholders})
        ORDER BY productId ASC, position ASC
      `,
        )
        .all(...chunk);
      linkRows.forEach((row) => {
        pushToMap(linksByProduct, row.productId, {
          label: row.label ?? "",
          url: row.url,
        });
      });

      const badgeRows = db
        .prepare(
          `
        SELECT product_id as productId, type, label, color
        FROM product_badges
        WHERE product_id IN (${placeholders})
        ORDER BY product_id ASC, rowid ASC
      `,
        )
        .all(...chunk);
      badgeRows.forEach((row) => {
        pushToMap(badgesByProduct, row.productId, {
          type: row.type || null,
          label: row.label || null,
          color: row.color || null,
        });
      });

      const variantRows = db
        .prepare(
          `
        SELECT id, product_id, name, color_code AS colorCode, color_image AS colorImage, color_display_mode AS colorDisplayMode, price_rub AS priceRub, stock, position
        FROM product_variants
        WHERE product_id IN (${placeholders})
        ORDER BY product_id ASC, position ASC
      `,
        )
        .all(...chunk);
      variantRows.forEach((row) => {
        pushToMap(variantsByProduct, row.product_id, row);
      });
    }
  }

  const enriched = products.map((p) => {
    const stockValue = typeof p.stock === "number" ? p.stock : null;

    const result = {
      ...p,
      stock: stockValue,
      costPrice: typeof p.costPrice === "number" ? p.costPrice : null,
      minStock: typeof p.minStock === "number" ? p.minStock : null,
      badges: badgesByProduct.get(p.id) ?? [],
      isAvailable: stockValue === null ? true : stockValue > 0,
      links: linksByProduct.get(p.id) ?? [],
    };

    if (p.hasVariants) {
      // Для товаров с вариантами получаем варианты и их изображения
      const variants = variantsByProduct.get(p.id) ?? [];
      result.variants = variants.map((v) => ({
        ...v,
        images: variantImagesByProduct.get(p.id)?.get(v.id) ?? [],
      }));
      // Для обратной совместимости, показываем изображения первого варианта как изображения товара
      result.images =
        result.variants.length > 0 &&
        result.variants[0].images &&
        result.variants[0].images.length > 0
          ? result.variants[0].images
          : [];
      // Обновляем доступность на основе вариантов
      result.isAvailable = result.variants.some(
        (v) => v.stock === null || v.stock > 0,
      );
    } else {
      // Обычный товар без вариантов
      const productImages = baseImagesByProduct.get(p.id) ?? [];
      result.images = productImages;
      // ОПТИМИЗАЦИЯ: если у товара нет своих изображений и useCategoryImage=1,
      // фронтенд сам загрузит обложку категории через кэш
      // Добавляем флаг needsCategoryImage для фронтенда
      result.needsCategoryImage =
        p.useCategoryImage && productImages.length === 0;
    }

    return result;
  });

  res.json({ products: enriched, total, hasMore: offset + limit < total });
});

publicRouter.get("/api/product/:id", (req, res) => {
  const id = req.params.id;
  // ОПТИМИЗАЦИЯ: не загружаем cover_image категории - фронтенд загрузит отдельно при необходимости
  const p = db
    .prepare(
      `
    SELECT 
      p.id,
      p.categoryId,
      p.groupId,
      p.title,
      p.priceRub,
      p.description,
      p.variant AS variant,
      p.strength AS strength,
      p.cost_price AS costPrice,
      p.stock AS stock,
      p.min_stock AS minStock,
      p.use_category_image AS useCategoryImage,
      p.has_variants AS hasVariants,
      p.createdAt,
      g.slug AS groupSlug,
      g.name AS groupName
    FROM products p
    LEFT JOIN category_groups g ON p.groupId = g.id
    WHERE p.id = ?
  `,
    )
    .get(id);
  if (!p) return res.status(404).json({ error: "Not found" });

  const links = db
    .prepare(
      "SELECT label, url FROM product_links WHERE productId = ? ORDER BY position ASC",
    )
    .all(id)
    .map((link) => ({
      label: link.label ?? "",
      url: link.url,
    }));
  const badges = db
    .prepare(
      `
    SELECT type, label, color
    FROM product_badges
    WHERE product_id = ?
    ORDER BY rowid ASC
  `,
    )
    .all(id);
  const stockValue = typeof p.stock === "number" ? p.stock : null;

  const result = {
    ...p,
    stock: stockValue,
    costPrice: typeof p.costPrice === "number" ? p.costPrice : null,
    minStock: typeof p.minStock === "number" ? p.minStock : null,
    badges: badges.map((badge) => ({
      type: badge.type || null,
      label: badge.label || null,
      color: badge.color || null,
    })),
    isAvailable: stockValue === null ? true : stockValue > 0,
    links,
  };

  if (p.hasVariants) {
    // Для товаров с вариантами получаем варианты и их изображения
    const variants = db
      .prepare(
        `
      SELECT id, product_id, name, color_code AS colorCode, color_image AS colorImage, color_display_mode AS colorDisplayMode, price_rub AS priceRub, stock, position
      FROM product_variants
      WHERE product_id = ?
      ORDER BY position ASC
    `,
      )
      .all(id);

    result.variants = variants.map((v) => ({
      ...v,
      images: db
        .prepare(
          "SELECT url FROM product_images WHERE productId = ? AND variant_id = ? ORDER BY position ASC",
        )
        .all(id, v.id)
        .map((r) => r.url),
    }));
    // Для обратной совместимости, показываем изображения первого варианта как изображения товара
    result.images =
      result.variants.length > 0 &&
      result.variants[0].images &&
      result.variants[0].images.length > 0
        ? result.variants[0].images
        : [];
    // Обновляем доступность на основе вариантов
    result.isAvailable = result.variants.some(
      (v) => v.stock === null || v.stock > 0,
    );
  } else {
    // Обычный товар без вариантов
    const productImages = db
      .prepare(
        "SELECT url FROM product_images WHERE productId = ? AND variant_id IS NULL ORDER BY position ASC",
      )
      .all(id)
      .map((r) => r.url);
    result.images = productImages;
    // Флаг для фронтенда - нужно загрузить обложку категории
    result.needsCategoryImage =
      p.useCategoryImage && productImages.length === 0;
  }

  res.json(result);
});

publicRouter.get("/api/cross-sells", (req, res) => {
  const { category, limit } = req.query;
  if (!category) {
    return res.json([]);
  }

  const categoryRow = db
    .prepare("SELECT id FROM categories WHERE slug = ?")
    .get(String(category));
  if (!categoryRow) {
    return res.json([]);
  }

  const maxItems = Math.min(Math.max(parseInt(limit ?? "6", 10) || 6, 1), 12);

  // ОПТИМИЗАЦИЯ: не загружаем cover_image категории
  const rows = db
    .prepare(
      `
    SELECT 
      cs.id,
      cs.[order],
      p.id AS productId,
      p.title,
      p.priceRub,
      p.description,
      p.variant AS variant,
      p.strength AS strength,
      p.cost_price AS costPrice,
      p.stock AS stock,
      p.min_stock AS minStock,
      p.use_category_image AS useCategoryImage,
      p.has_variants AS hasVariants,
      p.createdAt,
      p.categoryId,
      p.groupId,
      g.slug as groupSlug,
      g.name as groupName
    FROM category_cross_sells cs
    JOIN products p ON p.id = cs.productId
    LEFT JOIN category_groups g ON p.groupId = g.id
    WHERE cs.categoryId = ?
      AND (
        (p.has_variants = 0 AND (p.stock IS NULL OR p.stock > 0))
        OR
        (p.has_variants = 1 AND EXISTS (
          SELECT 1 FROM product_variants pv 
          WHERE pv.product_id = p.id 
          AND (pv.stock IS NULL OR pv.stock > 0)
        ))
      )
    ORDER BY cs.[order] ASC
    LIMIT ?
  `,
    )
    .all(categoryRow.id, maxItems);

  const imageStmt = db.prepare(
    "SELECT url FROM product_images WHERE productId = ? AND variant_id IS NULL ORDER BY position ASC",
  );
  const linkStmt = db.prepare(
    "SELECT label, url FROM product_links WHERE productId = ? ORDER BY position ASC",
  );
  const badgeStmt = db.prepare(`
    SELECT type, label, color
    FROM product_badges
    WHERE product_id = ?
    ORDER BY rowid ASC
  `);
  const variantStmt = db.prepare(`
    SELECT id, product_id, name, color_code AS colorCode, color_image AS colorImage, color_display_mode AS colorDisplayMode, price_rub AS priceRub, stock, position
    FROM product_variants
    WHERE product_id = ?
    ORDER BY position ASC
  `);
  const variantImgStmt = db.prepare(
    "SELECT url FROM product_images WHERE productId = ? AND variant_id = ? ORDER BY position ASC",
  );

  const payload = rows.map((row) => {
    const stockValue = typeof row.stock === "number" ? row.stock : null;

    const result = {
      id: row.productId,
      title: row.title,
      priceRub: row.priceRub,
      description: row.description,
      variant: row.variant,
      strength: row.strength,
      costPrice: typeof row.costPrice === "number" ? row.costPrice : null,
      stock: stockValue,
      minStock: typeof row.minStock === "number" ? row.minStock : null,
      isAvailable: stockValue === null ? true : stockValue > 0,
      createdAt: row.createdAt,
      categoryId: row.categoryId,
      groupId: row.groupId,
      groupSlug: row.groupSlug,
      groupName: row.groupName,
      links: linkStmt
        .all(row.productId)
        .map((link) => ({ label: link.label ?? "", url: link.url })),
      badges: badgeStmt.all(row.productId).map((badge) => ({
        type: badge.type || null,
        label: badge.label || null,
        color: badge.color || null,
      })),
    };

    if (row.hasVariants) {
      // Для товаров с вариантами получаем варианты и их изображения
      const variants = variantStmt.all(row.productId);
      result.variants = variants.map((v) => ({
        ...v,
        images: variantImgStmt.all(row.productId, v.id).map((r) => r.url),
      }));
      // Для обратной совместимости, показываем изображения первого варианта как изображения товара
      result.images =
        result.variants.length > 0 &&
        result.variants[0].images &&
        result.variants[0].images.length > 0
          ? result.variants[0].images
          : [];
      // Обновляем доступность на основе вариантов
      result.isAvailable = result.variants.some(
        (v) => v.stock === null || v.stock > 0,
      );
    } else {
      // Обычный товар без вариантов
      const productImages = imageStmt.all(row.productId).map((r) => r.url);
      result.images = productImages;
      // Флаг для фронтенда
      result.needsCategoryImage =
        row.useCategoryImage && productImages.length === 0;
    }

    return result;
  });

  res.json(payload);
});

// Public settings (only specific settings that are safe to expose)
publicRouter.get("/api/settings", (req, res) => {
  try {
    const getSettingValue = (key, defaultValue = "") => {
      const row = db
        .prepare("SELECT value FROM settings WHERE key = ?")
        .get(key);
      return row?.value || defaultValue;
    };

    res.json({
      manager_telegram: getSettingValue("manager_telegram", "dmitriy_mityuk"),
      // Минимальная сумма для доставки
      min_delivery_amount: getSettingValue("min_delivery_amount", "0"),
      min_delivery_banner_image: getSettingValue(
        "min_delivery_banner_image",
        "",
      ),
      min_delivery_banner_button_text: getSettingValue(
        "min_delivery_banner_button_text",
        "Понятно",
      ),
      min_delivery_banner_button_color: getSettingValue(
        "min_delivery_banner_button_color",
        "#FFD700",
      ),
      // Баннер условий доставки (fullscreen)
      delivery_conditions_image: getSettingValue(
        "delivery_conditions_image",
        "",
      ),
      // Редирект в Telegram после заказа
      order_redirect_telegram: getSettingValue("order_redirect_telegram", ""),
      order_redirect_text_template: getSettingValue(
        "order_redirect_text_template",
        "Мой номер заказа - #{order_number}",
      ),
    });
  } catch (error) {
    console.error("[public] Failed to get settings:", error);
    // Возвращаем дефолтные значения в случае ошибки
    res.json({
      manager_telegram: "dmitriy_mityuk",
      min_delivery_amount: "0",
      min_delivery_banner_image: "",
      min_delivery_banner_button_text: "Понятно",
      min_delivery_banner_button_color: "#FFD700",
      delivery_conditions_image: "",
      order_redirect_telegram: "",
      order_redirect_text_template: "Мой номер заказа - #{order_number}",
    });
  }
});

publicRouter.get("/api/telegram/username-status", async (req, res) => {
  try {
    const telegramId = typeof req.query.telegram_id === "string" ? req.query.telegram_id.trim() : "";

    if (!telegramId) {
      return res.status(400).json({
        ok: false,
        error: "telegram_id_required",
        message: "Не указан Telegram ID",
      });
    }

    return res.json(await resolveTelegramUsernameStatus(telegramId));
  } catch (error) {
    console.error("[public] Failed to check telegram username status:", error);
    return res.status(500).json({
      ok: false,
      error: "username_status_failed",
      message: "Не удалось проверить username",
    });
  }
});

// Get customer profile (public endpoint for Mini App)
publicRouter.get("/api/customer/me", async (req, res) => {
  try {
    const telegramId = typeof req.query.telegram_id === "string" ? req.query.telegram_id.trim() : "";

    if (!telegramId) {
      return res.status(400).json({
        error: "telegram_id_required",
        message: "Не указан Telegram ID",
      });
    }

    const customer = db.prepare(`
      SELECT id, telegram_id, telegram_username, first_name, last_name,
             phone, total_orders, total_spent, photo_url, photo_updated_at,
             created_at
      FROM customers
      WHERE telegram_id = ?
    `).get(telegramId);

    if (!customer) {
      return res.json({
        found: false,
        telegram_id: telegramId,
        first_name: null,
        last_name: null,
        telegram_username: null,
        photo_url: null,
        total_orders: 0,
        total_spent: 0,
        member_since: null,
      });
    }

    // Try to fetch/update photo from Telegram
    let photoUrl = customer.photo_url || null;
    const photoAge = customer.photo_updated_at
      ? Date.now() - new Date(customer.photo_updated_at).getTime()
      : Infinity;
    const PHOTO_CACHE_MS = 24 * 60 * 60 * 1000; // 24 hours

    if (photoAge > PHOTO_CACHE_MS && TELEGRAM_BOT_TOKEN) {
      try {
        const chat = await fetchTelegramChat(telegramId);
        if (chat?.photo?.big_file_id) {
          const fileResp = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(chat.photo.big_file_id)}`
          );
          const fileData = await fileResp.json();
          if (fileData?.ok && fileData.result?.file_path) {
            photoUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
          }
        } else {
          // User has no photo
          photoUrl = null;
        }

        db.prepare(`
          UPDATE customers
          SET photo_url = ?,
              photo_updated_at = DATETIME('now'),
              updated_at = DATETIME('now')
          WHERE id = ?
        `).run(photoUrl, customer.id);
      } catch (photoError) {
        console.warn("[public] Failed to fetch Telegram photo:", photoError.message);
        // Keep existing cached photo
      }
    }

    res.json({
      found: true,
      id: customer.id,
      telegram_id: customer.telegram_id,
      telegram_username: customer.telegram_username || null,
      first_name: customer.first_name || null,
      last_name: customer.last_name || null,
      photo_url: photoUrl,
      total_orders: customer.total_orders || 0,
      total_spent: customer.total_spent || 0,
      member_since: customer.created_at || null,
    });
  } catch (error) {
    console.error("[public] Failed to get customer profile:", error);
    res.status(500).json({
      error: "profile_failed",
      message: "Не удалось загрузить профиль",
    });
  }
});

publicRouter.get("/api/orders/my-active", (req, res) => {
  try {
    const telegramId =
      typeof req.query.telegram_id === "string" ? req.query.telegram_id.trim() : "";
    const telegramUsername =
      typeof req.query.telegram_username === "string"
        ? req.query.telegram_username.trim()
        : "";

    if (!telegramId && !telegramUsername) {
      return res.status(400).json({
        error: "customer_identity_required",
        message: "Нужен telegram_id или telegram_username",
      });
    }

    const order = findOwnedActiveOrder({
      telegramId,
      telegramUsername,
    });

    if (!order) {
      return res.json({ found: false });
    }

    return res.json(serializeCustomerOrder(order));
  } catch (error) {
    console.error("[public] Failed to get active order:", error);
    return res.status(500).json({
      error: "active_order_failed",
      message: "Не удалось загрузить активный заказ",
    });
  }
});

publicRouter.post("/api/orders/:id/cancel-by-customer", (req, res) => {
  try {
    const { id } = req.params;
    const telegramId =
      typeof req.body?.telegram_id === "string" ? req.body.telegram_id.trim() : "";
    const telegramUsername =
      typeof req.body?.telegram_username === "string"
        ? req.body.telegram_username.trim()
        : "";

    const order = findOwnedActiveOrder({
      orderId: id,
      telegramId,
      telegramUsername,
    });

    if (!order) {
      return res.status(404).json({
        error: "not_found",
        message: "Активный заказ не найден",
      });
    }

    const tx = db.transaction(() => {
      releaseOrderLoyaltyReservations(id);

      const updateFields = [
        "status = 'cancelled'",
        "previous_status = ?",
        "cancelled_at = DATETIME('now')",
        "updated_at = DATETIME('now')",
      ];
      const updateValues = [order.status];

      clearPromoUsageForOrder(order);

      if (order.status === "in_progress") {
        const orderItems = db
          .prepare("SELECT * FROM order_items WHERE order_id = ?")
          .all(id);

        if (order.stock_deducted) {
          restoreStockForOrderItems(orderItems);
          updateFields.push("stock_deducted = 0");
        }
        updateFields.push("needs_manager_action = 1");
        updateFields.push("manager_action_type = 'cancelled_by_customer'");
        updateFields.push("manager_action_note = 'Клиент отменил уже собранный заказ'");
        updateFields.push("manager_action_resolved_at = NULL");
      } else {
        updateFields.push("needs_manager_action = 0");
        updateFields.push("manager_action_type = NULL");
        updateFields.push("manager_action_note = NULL");
        updateFields.push("manager_action_resolved_at = NULL");
      }

      updateValues.push(id);

      db.prepare(
        `UPDATE orders SET ${updateFields.join(", ")} WHERE id = ?`,
      ).run(...updateValues);
    });

    tx();
    recordOrderStatusChange(id, order.status, "cancelled", "Клиент отменил заказ");

    return res.json({
      success: true,
      order_id: id,
      status: "cancelled",
      needs_manager_action: order.status === "in_progress" ? 1 : 0,
    });
  } catch (error) {
    console.error("[public] Cancel by customer error:", error);
    return res.status(500).json({
      error: "cancel_failed",
      message: error.message || "Не удалось отменить заказ",
    });
  }
});

publicRouter.put("/api/orders/:id/modify-by-customer", (req, res) => {
  try {
    const { id } = req.params;
    const {
      telegram_id,
      telegram_username,
      first_name,
      last_name,
      phone,
      delivery_type = "pickup",
      delivery_address,
      notes,
      items,
      promo_code,
    } = req.body || {};

    const telegramId = typeof telegram_id === "string" ? telegram_id.trim() : "";
    const telegramUsername =
      typeof telegram_username === "string" ? telegram_username.trim() : "";

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "items_required",
        message: "Товары обязательны",
      });
    }

    const order = findOwnedActiveOrder({
      orderId: id,
      telegramId,
      telegramUsername,
    });

    if (!order) {
      return res.status(404).json({
        error: "not_found",
        message: "Активный заказ не найден",
      });
    }

    const normalizedUsername = normalizeTelegramUsername(
      telegramUsername || order.resolved_telegram_username || order.telegram_username,
    );

    if (!normalizedUsername) {
      return res.status(400).json({
        error: "telegram_username_required",
        message: "Укажите Telegram username",
      });
    }

    if (delivery_type === "delivery") {
      if (!phone || !String(phone).trim()) {
        return res.status(400).json({
          error: "phone_required",
          message: "Укажите телефон для доставки",
        });
      }
      if (!delivery_address || !String(delivery_address).trim()) {
        return res.status(400).json({
          error: "address_required",
          message: "Укажите адрес доставки",
        });
      }
    }

    const previousItems = db
      .prepare(
        `
        SELECT *
        FROM order_items
        WHERE order_id = ?
        ORDER BY rowid ASC
      `,
      )
      .all(id);

    const previousStatus = order.status;

    const tx = db.transaction(() => {
      if (order.stock_deducted) {
        restoreStockForOrderItems(previousItems);
      }
      releaseOrderLoyaltyReservations(id);

      if (order.customer_id) {
        resetCustomerLoyaltyOnUsernameChange({
          customerId: order.customer_id,
          previousUsername: order.telegram_username,
          nextUsername: normalizedUsername,
        });
      }

      const normalizedPromoCode =
        promo_code && String(promo_code).trim()
          ? String(promo_code).trim().toUpperCase()
          : null;
      const orderBuild = buildPublicOrderItems({
        items,
        customerId: order.customer_id || null,
        promoCodeText: normalizedPromoCode,
      });

      let nextPromoDiscount = 0;
      let nextPromoCodeId = null;
      let nextPromoResult = null;
      if (normalizedPromoCode) {
        nextPromoResult = validatePromoCode(normalizedPromoCode, orderBuild.totalAmount);
        if (!nextPromoResult.valid) {
          throw new Error(
            nextPromoResult.message || "РќРµРґРµР№СЃС‚РІРёС‚РµР»СЊРЅС‹Р№ РїСЂРѕРјРѕРєРѕРґ",
          );
        }
        nextPromoDiscount = Number(nextPromoResult.calculated_discount || 0);
        nextPromoCodeId = nextPromoResult.promo.id;
      }

      const nextFinalAmount = Math.max(
        0,
        orderBuild.totalAmount -
          nextPromoDiscount -
          Number(orderBuild.totalLoyaltyDiscount || 0),
      );
      const nextProfit = nextFinalAmount - orderBuild.totalCost;
      const nextManagerActionNote = buildManagerActionNote({
        previousItems,
        nextItems: orderBuild.items,
        previousPromoCodeText: order.promo_code_text || null,
        nextPromoCodeText: normalizedPromoCode,
      });

      clearPromoUsageForOrder(order);
      db.prepare("DELETE FROM order_items WHERE order_id = ?").run(id);

      const updatedItemStmt = db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, product_title, group_name, base_product_title, base_product_id, variant_id, variant_name, quantity,
          price_per_unit, cost_per_unit, manual_discount_amount, loyalty_discount_amount, loyalty_units_applied, discount_amount, total_price, total_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of orderBuild.items) {
        updatedItemStmt.run(
          item.id,
          id,
          item.product_id,
          item.product_title,
          item.group_name,
          item.base_product_title,
          item.base_product_id,
          item.variant_id || null,
          item.variant_name,
          item.quantity,
          item.price_per_unit,
          item.cost_per_unit,
          item.manual_discount_amount,
          item.loyalty_discount_amount,
          item.loyalty_units_applied,
          item.discount_amount,
          item.total_price,
          item.total_cost,
        );
      }

      applyOrderLoyaltyReservations({
        customerId: order.customer_id || null,
        orderId: id,
        application: orderBuild.application,
      });

      db.prepare(
        `
        UPDATE orders
        SET status = 'new',
            previous_status = ?,
            delivery_type = ?,
            delivery_address = ?,
            notes = ?,
            phone = ?,
            telegram_username = ?,
            total_amount = ?,
            discount_amount = ?,
            discount_percent = 0,
            final_amount = ?,
            profit = ?,
            promo_code_id = ?,
            promo_code_text = ?,
            needs_manager_action = 1,
            manager_action_type = 'modified',
            manager_action_note = ?,
            manager_action_resolved_at = NULL,
            stock_deducted = 0,
            cancelled_at = NULL,
            updated_at = DATETIME('now')
        WHERE id = ?
      `,
      ).run(
        previousStatus,
        delivery_type,
        delivery_type === "delivery" ? delivery_address || null : null,
        notes || null,
        delivery_type === "delivery" ? phone || null : null,
        normalizedUsername,
        orderBuild.totalAmount,
        nextPromoDiscount,
        nextFinalAmount,
        nextProfit,
        nextPromoCodeId,
        normalizedPromoCode,
        nextManagerActionNote,
        id,
      );

      if (order.customer_id) {
        db.prepare(
          `
          UPDATE customers
          SET telegram_username = ?,
              first_name = COALESCE(?, first_name),
              last_name = COALESCE(?, last_name),
              phone = COALESCE(?, phone),
              updated_at = DATETIME('now')
          WHERE id = ?
        `,
        ).run(
          normalizedUsername,
          first_name || null,
          last_name || null,
          delivery_type === "delivery" ? phone || null : null,
          order.customer_id,
        );
      }

      if (nextPromoCodeId && nextPromoResult) {
        db.prepare(
          `
          INSERT INTO promo_usage (id, promo_code_id, order_id, customer_id, discount_applied)
          VALUES (?, ?, ?, ?, ?)
        `,
        ).run(
          generateId("pu"),
          nextPromoCodeId,
          id,
          order.customer_id || null,
          nextPromoDiscount,
        );
        db.prepare(
          "UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = ?",
        ).run(nextPromoCodeId);
      }

      return;

      let totalAmount = 0;
      let totalCost = 0;
      const nextItems = [];

      for (const item of items) {
        if (!item?.product_id) {
          throw new Error("invalid_item");
        }

        const product = db
          .prepare("SELECT * FROM products WHERE id = ?")
          .get(item.product_id);

        if (!product) {
          throw new Error(`Товар не найден: ${item.product_id}`);
        }

        const quantity = Number(item.quantity || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error("invalid_item_quantity");
        }

        let stockToCheck = product.stock;
        let variantData = null;

        if (item.variant_id) {
          variantData = db
            .prepare("SELECT * FROM product_variants WHERE id = ?")
            .get(item.variant_id);
          if (!variantData) {
            throw new Error(`Вариант не найден: ${item.variant_id}`);
          }
          stockToCheck = variantData.stock;
        } else if (product.has_variants) {
          stockToCheck = null;
        }

        if (stockToCheck !== null && Number(stockToCheck) < quantity) {
          const itemTitle = item.variant_name
            ? `${product.title} (${item.variant_name})`
            : product.title;
          throw new Error(`Недостаточно товара: ${itemTitle}`);
        }

        const pricePerUnit =
          item.price_per_unit || variantData?.price_rub || product.priceRub;
        const costPerUnit = Number(product.cost_price || 0);
        const totalPrice = Number(pricePerUnit) * quantity;
        const totalItemCost = costPerUnit * quantity;

        totalAmount += totalPrice;
        totalCost += totalItemCost;

        const groupName = product.groupId
          ? db
              .prepare("SELECT name FROM category_groups WHERE id = ?")
              .get(product.groupId)?.name || null
          : null;

        nextItems.push({
          id: generateId("oi"),
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          product_title: item.variant_name
            ? `${product.title} - ${item.variant_name}`
            : product.title || "Без названия",
          group_name: groupName,
          base_product_title:
            item.product_title || product.title || "Без названия",
          base_product_id: item.product_id,
          variant_name: item.variant_name || null,
          quantity,
          price_per_unit: Number(pricePerUnit),
          cost_per_unit: costPerUnit,
          discount_amount: 0,
          total_price: totalPrice,
          total_cost: totalItemCost,
        });
      }

      let promoDiscount = 0;
      let promoCodeId = null;
      let promoCodeText = null;
      let promoResult = null;

      clearPromoUsageForOrder(order);

      if (promo_code && String(promo_code).trim()) {
        promoResult = validatePromoCode(String(promo_code), totalAmount);
        if (!promoResult.valid) {
          throw new Error(
            promoResult.message || "Недействительный промокод",
          );
        }

        promoDiscount = Number(promoResult.calculated_discount || 0);
        promoCodeId = promoResult.promo.id;
        promoCodeText = String(promo_code).trim().toUpperCase();
      }

      const finalAmount = totalAmount - promoDiscount;
      const profit = finalAmount - totalCost;
      const managerActionNote = buildManagerActionNote({
        previousItems,
        nextItems,
        previousPromoCodeText: order.promo_code_text || null,
        nextPromoCodeText: promoCodeText,
      });

      db.prepare("DELETE FROM order_items WHERE order_id = ?").run(id);

      const itemStmt = db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, product_title, group_name, base_product_title, base_product_id, variant_id, variant_name, quantity,
          price_per_unit, cost_per_unit, discount_amount, total_price, total_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of nextItems) {
        itemStmt.run(
          item.id,
          id,
          item.product_id,
          item.product_title,
          item.group_name,
          item.base_product_title,
          item.base_product_id,
          item.variant_id || null,
          item.variant_name,
          item.quantity,
          item.price_per_unit,
          item.cost_per_unit,
          item.discount_amount,
          item.total_price,
          item.total_cost,
        );
      }

      db.prepare(
        `
        UPDATE orders
        SET status = 'new',
            previous_status = ?,
            delivery_type = ?,
            delivery_address = ?,
            notes = ?,
            phone = ?,
            telegram_username = ?,
            total_amount = ?,
            discount_amount = ?,
            discount_percent = 0,
            final_amount = ?,
            profit = ?,
            promo_code_id = ?,
            promo_code_text = ?,
            needs_manager_action = 1,
            manager_action_type = 'modified',
            manager_action_note = ?,
            manager_action_resolved_at = NULL,
            stock_deducted = 0,
            cancelled_at = NULL,
            updated_at = DATETIME('now')
        WHERE id = ?
      `,
      ).run(
        previousStatus,
        delivery_type,
        delivery_type === "delivery" ? delivery_address || null : null,
        notes || null,
        delivery_type === "delivery" ? phone || null : null,
        normalizedUsername,
        totalAmount,
        promoDiscount,
        finalAmount,
        profit,
        promoCodeId,
        promoCodeText,
        managerActionNote,
        id,
      );

      if (order.customer_id) {
        db.prepare(
          `
          UPDATE customers
          SET telegram_username = ?,
              first_name = COALESCE(?, first_name),
              last_name = COALESCE(?, last_name),
              phone = COALESCE(?, phone),
              updated_at = DATETIME('now')
          WHERE id = ?
        `,
        ).run(
          normalizedUsername,
          first_name || null,
          last_name || null,
          delivery_type === "delivery" ? phone || null : null,
          order.customer_id,
        );
      }

      if (promoCodeId && promoResult) {
        db.prepare(
          `
          INSERT INTO promo_usage (id, promo_code_id, order_id, customer_id, discount_applied)
          VALUES (?, ?, ?, ?, ?)
        `,
        ).run(
          generateId("pu"),
          promoCodeId,
          id,
          order.customer_id || null,
          promoDiscount,
        );
        db.prepare(
          "UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = ?",
        ).run(promoCodeId);
      }
    });

    tx();

    if (previousStatus !== "new") {
      recordOrderStatusChange(
        id,
        previousStatus,
        "new",
        "Клиент изменил заказ, требуется пересборка",
      );
    }

    const updatedOrder = findOwnedActiveOrder({
      orderId: id,
      telegramId,
      telegramUsername: normalizedUsername,
    });

    return res.json(serializeCustomerOrder(updatedOrder || { ...order, id, status: "new" }));
  } catch (error) {
    console.error("[public] Modify by customer error:", error);
    if (
      [
        "invalid_item",
        "invalid_item_quantity",
        "promo_and_loyalty_conflict",
        "loyalty_category_not_available",
        "loyalty_balance_not_enough",
      ].includes(error.message)
    ) {
      return res.status(400).json({
        error: error.message,
        message: error.message,
      });
    }
    return res.status(500).json({
      error: "modify_failed",
      message: error.message || "Не удалось обновить заказ",
    });
  }
});

// Helper functions
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getNextNumber(table, field) {
  const row = db.prepare(`SELECT MAX(${field}) as maxNum FROM ${table}`).get();
  return (row?.maxNum || 0) + 1;
}

// Validate promo code helper
function validatePromoCode(code, orderAmount) {
  if (!code || typeof code !== 'string' || !code.trim()) {
    return { valid: false, error: 'not_found', message: 'Промокод не указан' };
  }

  const cleanCode = code.trim().toUpperCase();
  const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(cleanCode);

  if (!promo) {
    return { valid: false, error: 'not_found', message: 'Промокод не найден' };
  }

  if (!promo.active) {
    return { valid: false, error: 'inactive', message: 'Промокод неактивен' };
  }

  const now = new Date().toISOString();

  if (promo.valid_from && now < promo.valid_from) {
    return { valid: false, error: 'not_started', message: 'Промокод еще не действует' };
  }

  if (promo.valid_until && now > promo.valid_until) {
    return { valid: false, error: 'expired', message: 'Срок действия промокода истек' };
  }

  if (promo.max_uses > 0 && promo.current_uses >= promo.max_uses) {
    return { valid: false, error: 'max_uses_reached', message: 'Промокод уже использован максимальное количество раз' };
  }

  if (promo.min_order_amount > 0 && orderAmount < promo.min_order_amount) {
    return { valid: false, error: 'min_amount_not_met', message: `Минимальная сумма заказа для этого промокода: ${promo.min_order_amount} BYN` };
  }

  let calculatedDiscount = 0;
  if (promo.discount_type === 'fixed') {
    calculatedDiscount = Math.min(promo.discount_value, orderAmount);
  } else if (promo.discount_type === 'percent') {
    calculatedDiscount = Math.round(orderAmount * promo.discount_value / 100 * 100) / 100;
  }

  return {
    valid: true,
    promo,
    discount_type: promo.discount_type,
    discount_value: promo.discount_value,
    calculated_discount: calculatedDiscount,
    description: promo.description,
  };
}

// Validate promo code (public endpoint)
publicRouter.post("/api/promo/validate", (req, res) => {
  try {
    const { code, order_amount = 0 } = req.body;
    const result = validatePromoCode(code, Number(order_amount));

    if (result.valid) {
      res.json({
        valid: true,
        discount_type: result.discount_type,
        discount_value: result.discount_value,
        calculated_discount: result.calculated_discount,
        description: result.description,
      });
    } else {
      res.json({
        valid: false,
        error: result.error,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("[public] Validate promo error:", error);
    res.status(500).json({ valid: false, error: "failed", message: "Ошибка проверки промокода" });
  }
});

function upsertPublicCustomer({
  telegramId,
  telegramUsername,
  firstName,
  lastName,
  phone,
}) {
  if (!telegramId) {
    return null;
  }

  const existing = db
    .prepare("SELECT * FROM customers WHERE telegram_id = ?")
    .get(telegramId);

  if (existing) {
    resetCustomerLoyaltyOnUsernameChange({
      customerId: existing.id,
      previousUsername: existing.telegram_username,
      nextUsername: telegramUsername,
    });

    db.prepare(
      `
      UPDATE customers
      SET telegram_username = ?,
          first_name = ?,
          last_name = ?,
          phone = COALESCE(?, phone),
          last_visit_at = DATETIME('now'),
          updated_at = DATETIME('now')
      WHERE id = ?
    `,
    ).run(
      telegramUsername || null,
      firstName || null,
      lastName || null,
      phone || null,
      existing.id,
    );

    return existing.id;
  }

  const customerId = generateId("cust");
  db.prepare(
    `
    INSERT INTO customers (
      id, telegram_id, telegram_username, first_name, last_name, phone,
      first_visit_at, last_visit_at, total_orders, total_spent
    ) VALUES (?, ?, ?, ?, ?, ?, DATETIME('now'), DATETIME('now'), 0, 0)
  `,
  ).run(
    customerId,
    telegramId,
    telegramUsername || null,
    firstName || null,
    lastName || null,
    phone || null,
  );

  return customerId;
}

function buildPublicOrderItems({
  items,
  customerId = null,
  promoCodeText = null,
  existingOrderId = null,
}) {
  let totalAmount = 0;
  let totalCost = 0;

  const preparedItems = items.map((item) => {
    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(item.product_id);
    if (!product) {
      throw new Error(`РўРѕРІР°СЂ РЅРµ РЅР°Р№РґРµРЅ: ${item.product_id}`);
    }

    const quantity = Number(item.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("invalid_item_quantity");
    }

    let stockToCheck = product.stock;
    let variantData = null;

    if (item.variant_id) {
      variantData = db
        .prepare("SELECT * FROM product_variants WHERE id = ?")
        .get(item.variant_id);
      if (!variantData) {
        throw new Error(`Р’Р°СЂРёР°РЅС‚ РЅРµ РЅР°Р№РґРµРЅ: ${item.variant_id}`);
      }
      stockToCheck = variantData.stock;
    } else if (product.has_variants) {
      stockToCheck = null;
    }

    if (stockToCheck !== null && Number(stockToCheck) < quantity) {
      const itemTitle = item.variant_name
        ? `${product.title} (${item.variant_name})`
        : product.title;
      throw new Error(`РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ С‚РѕРІР°СЂР°: ${itemTitle}`);
    }

    const pricePerUnit =
      item.price_per_unit || variantData?.price_rub || product.priceRub;
    const costPerUnit = Number(product.cost_price || 0);
    const groupName = product.groupId
      ? db
          .prepare("SELECT name FROM category_groups WHERE id = ?")
          .get(product.groupId)?.name || null
      : null;

    totalAmount += Number(pricePerUnit) * quantity;
    totalCost += costPerUnit * quantity;

    return {
      id: item.id || generateId("oi"),
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      product_title: item.variant_name
        ? `${product.title} - ${item.variant_name}`
        : product.title || "Р‘РµР· РЅР°Р·РІР°РЅРёСЏ",
      group_name: groupName,
      base_product_title:
        item.product_title || product.title || "Р‘РµР· РЅР°Р·РІР°РЅРёСЏ",
      base_product_id: item.product_id,
      variant_name: item.variant_name || null,
      quantity,
      price_per_unit: Number(pricePerUnit),
      cost_per_unit: costPerUnit,
      manual_discount_amount: 0,
      loyalty_units_applied: Number(item.loyalty_units_applied || 0),
    };
  });

  const application = buildLoyaltyApplication({
    customerId,
    items: preparedItems,
    promoCodeText,
    existingOrderId,
  });

  const finalizedItems = application.items.map((item) => ({
    id: item.id,
    product_id: item.product_id,
    variant_id: item.variant_id || null,
    product_title: item.product_title,
    group_name: item.group_name || null,
    base_product_title: item.base_product_title,
    base_product_id: item.base_product_id,
    variant_name: item.variant_name || null,
    quantity: Number(item.quantity || 0),
    price_per_unit: Number(item.price_per_unit || 0),
    cost_per_unit: Number(item.cost_per_unit || 0),
    manual_discount_amount: Number(item.manual_discount_amount || 0),
    loyalty_discount_amount: Number(item.loyalty_discount_amount || 0),
    loyalty_units_applied: Number(item.loyalty_units_applied || 0),
    discount_amount: Number(item.discount_amount || 0),
    total_price: Number(item.total_price || 0),
    total_cost: Number(item.cost_per_unit || 0) * Number(item.quantity || 0),
  }));

  return {
    items: finalizedItems,
    totalAmount,
    totalCost,
    totalLoyaltyDiscount: Number(application.total_loyalty_discount || 0),
    application,
  };
}

// Create order (public endpoint)
publicRouter.post("/api/orders", async (req, res) => {
  try {
    const {
      telegram_id,
      telegram_username,
      first_name,
      last_name,
      phone,
      delivery_type = "pickup",
      delivery_address,
      notes,
      items,
      promo_code,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "items_required", message: "Товары обязательны" });
    }

    const normalizedUsername = normalizeTelegramUsername(telegram_username);

    // Validate telegram_username (required)
    if (!normalizedUsername) {
      return res
        .status(400)
        .json({
          error: "telegram_username_required",
          message: "Укажите Telegram username",
        });
    }

    if (!/^[a-zA-Z0-9_]{5,32}$/.test(normalizedUsername)) {
      return res
        .status(400)
        .json({
          error: "telegram_username_invalid",
          message: "Username должен содержать от 5 до 32 символов",
        });
    }

    let verifiedTelegramUsername = normalizedUsername;

    if (telegram_id) {
      const usernameStatus = await resolveTelegramUsernameStatus(String(telegram_id));
      
      // Если Telegram API подтвердил username - используем его
      if (usernameStatus.status === "confirmed" && usernameStatus.username) {
        verifiedTelegramUsername = normalizeTelegramUsername(usernameStatus.username);
      } 
      // Если API вернул "missing" (пользователь точно без username) - блокируем
      else if (usernameStatus.status === "missing") {
        return res
          .status(400)
          .json({
            error: "telegram_username_required",
            message: usernameStatus.message || "Для оформления заказа нужен Telegram username",
          });
      }
      // Если API недоступен (retry/chat not found), но клиент передал username - доверяем клиенту
      // initDataUnsafe подписан Telegram и не может быть подделан
      else if (usernameStatus.status === "retry" && normalizedUsername) {
        verifiedTelegramUsername = normalizedUsername;
      }
      // API недоступен и клиент не передал username - блокируем
      else {
        return res
          .status(400)
          .json({
            error: "telegram_username_not_verified",
            message: "Не удалось проверить username. Закройте магазин и откройте заново.",
          });
      }
    }

    const existingActiveOrder = findOwnedActiveOrder({
      telegramId: telegram_id ? String(telegram_id) : "",
      telegramUsername: verifiedTelegramUsername,
    });

    if (existingActiveOrder) {
      return res.status(409).json({
        error: "active_order_exists",
        message: "У вас уже есть активный заказ. Его можно только изменить или отменить.",
        order_id: existingActiveOrder.id,
        order_number: existingActiveOrder.order_number,
      });
    }

    // Validate delivery requirements
    if (delivery_type === "delivery") {
      if (!phone || !phone.trim()) {
        return res
          .status(400)
          .json({
            error: "phone_required",
            message: "Укажите телефон для доставки",
          });
      }
      if (!delivery_address || !delivery_address.trim()) {
        return res
          .status(400)
          .json({
            error: "address_required",
            message: "Укажите адрес доставки",
          });
      }

      // Check minimum delivery amount
      const minDeliveryRow = db
        .prepare("SELECT value FROM settings WHERE key = ?")
        .get("min_delivery_amount");
      const minDeliveryAmount = parseFloat(minDeliveryRow?.value || "0") || 0;

      if (minDeliveryAmount > 0) {
        // Pre-calculate total amount to check against minimum
        let preCalcTotal = 0;
        for (const item of items) {
          const product = db
            .prepare("SELECT priceRub FROM products WHERE id = ?")
            .get(item.product_id);
          if (product) {
            const pricePerUnit = item.price_per_unit || product.priceRub;
            preCalcTotal += pricePerUnit * item.quantity;
          }
        }

        if (preCalcTotal < minDeliveryAmount) {
          return res.status(400).json({
            error: "min_delivery_amount_not_met",
            message: `Минимальная сумма заказа для доставки: ${minDeliveryAmount} BYN. Сейчас в корзине: ${preCalcTotal.toFixed(2)} BYN`,
            min_amount: minDeliveryAmount,
            current_amount: preCalcTotal,
          });
        }
      }
    }

    const tx = db.transaction(() => {
      const resolvedCustomerId = upsertPublicCustomer({
        telegramId: telegram_id ? String(telegram_id) : "",
        telegramUsername: verifiedTelegramUsername || null,
        firstName: first_name || null,
        lastName: last_name || null,
        phone: phone || null,
      });

      const createdOrderId = generateId("order");
      const createdOrderNumber = getNextNumber("orders", "order_number");
      const normalizedPromoCode =
        promo_code && String(promo_code).trim()
          ? String(promo_code).trim().toUpperCase()
          : null;

      const orderBuild = buildPublicOrderItems({
        items,
        customerId: resolvedCustomerId,
        promoCodeText: normalizedPromoCode,
      });

      let createdPromoDiscount = 0;
      let createdPromoCodeId = null;
      let createdPromoResult = null;
      if (normalizedPromoCode) {
        createdPromoResult = validatePromoCode(normalizedPromoCode, orderBuild.totalAmount);
        if (!createdPromoResult.valid) {
          throw new Error(
            createdPromoResult.message || "РќРµРґРµР№СЃС‚РІРёС‚РµР»СЊРЅС‹Р№ РїСЂРѕРјРѕРєРѕРґ",
          );
        }
        createdPromoDiscount = Number(createdPromoResult.calculated_discount || 0);
        createdPromoCodeId = createdPromoResult.promo.id;
      }

      const createdFinalAmount = Math.max(
        0,
        orderBuild.totalAmount - createdPromoDiscount - orderBuild.totalLoyaltyDiscount,
      );
      const createdProfit = createdFinalAmount - orderBuild.totalCost;

      db.prepare(
        `
        INSERT INTO orders (
          id, order_number, customer_id, status, delivery_type, delivery_address,
          total_amount, discount_amount, discount_percent, final_amount, profit, notes, phone, telegram_username,
          promo_code_id, promo_code_text
        ) VALUES (?, ?, ?, 'new', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        createdOrderId,
        createdOrderNumber,
        resolvedCustomerId,
        delivery_type,
        delivery_type === "delivery" ? delivery_address || null : null,
        orderBuild.totalAmount,
        createdPromoDiscount,
        createdFinalAmount,
        createdProfit,
        notes || null,
        delivery_type === "delivery" ? phone || null : null,
        verifiedTelegramUsername || null,
        createdPromoCodeId,
        normalizedPromoCode,
      );

      const createdItemStmt = db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, product_title, group_name, base_product_title, base_product_id, variant_id, variant_name, quantity,
          price_per_unit, cost_per_unit, manual_discount_amount, loyalty_discount_amount, loyalty_units_applied, discount_amount, total_price, total_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of orderBuild.items) {
        createdItemStmt.run(
          item.id,
          createdOrderId,
          item.product_id,
          item.product_title,
          item.group_name,
          item.base_product_title,
          item.base_product_id,
          item.variant_id || null,
          item.variant_name,
          item.quantity,
          item.price_per_unit,
          item.cost_per_unit,
          item.manual_discount_amount,
          item.loyalty_discount_amount,
          item.loyalty_units_applied,
          item.discount_amount,
          item.total_price,
          item.total_cost,
        );
      }

      applyOrderLoyaltyReservations({
        customerId: resolvedCustomerId,
        orderId: createdOrderId,
        application: orderBuild.application,
      });

      if (createdPromoCodeId && createdPromoResult) {
        db.prepare(`
          INSERT INTO promo_usage (id, promo_code_id, order_id, customer_id, discount_applied)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          generateId("pu"),
          createdPromoCodeId,
          createdOrderId,
          resolvedCustomerId || null,
          createdPromoDiscount,
        );

        db.prepare(
          "UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = ?",
        ).run(createdPromoCodeId);
      }

      if (resolvedCustomerId) {
        db.prepare(
          `
          UPDATE customers
          SET total_orders = total_orders + 1,
              total_spent = total_spent + ?,
              last_order_at = DATETIME('now'),
              updated_at = DATETIME('now')
          WHERE id = ?
        `,
        ).run(createdFinalAmount, resolvedCustomerId);
      }

      return { orderId: createdOrderId, orderNumber: createdOrderNumber };

      // Find or create customer
      let customerId = null;

      if (telegram_id) {
        const existing = db
          .prepare("SELECT id FROM customers WHERE telegram_id = ?")
          .get(telegram_id);
        if (existing) {
          customerId = existing.id;
          // Update customer info
          db.prepare(
            `
            UPDATE customers
            SET telegram_username = ?,
                first_name = ?,
                last_name = ?,
                phone = COALESCE(?, phone),
                last_visit_at = DATETIME('now'),
                updated_at = DATETIME('now')
            WHERE id = ?
          `,
          ).run(
            verifiedTelegramUsername || null,
            first_name || null,
            last_name || null,
            phone || null,
            customerId,
          );
        } else {
          // Create new customer
          customerId = generateId("cust");
          db.prepare(
            `
            INSERT INTO customers (
              id, telegram_id, telegram_username, first_name, last_name, phone,
              first_visit_at, last_visit_at, total_orders, total_spent
            ) VALUES (?, ?, ?, ?, ?, ?, DATETIME('now'), DATETIME('now'), 0, 0)
          `,
          ).run(
            customerId,
            telegram_id,
            verifiedTelegramUsername || null,
            first_name || null,
            last_name || null,
            phone || null,
          );
        }
      }

      // Generate order
      const orderId = generateId("order");
      const orderNumber = getNextNumber("orders", "order_number");

      // Calculate totals
      let totalAmount = 0;
      let totalCost = 0;

      const orderItems = items.map((item) => {
        const product = db
          .prepare("SELECT * FROM products WHERE id = ?")
          .get(item.product_id);
        if (!product) {
          throw new Error(`Товар не найден: ${item.product_id}`);
        }

        // Check stock - для товаров с вариантами проверяем stock варианта
        let stockToCheck = product.stock;
        let variantData = null;

        if (item.variant_id) {
          // Товар с вариантом - проверяем stock варианта
          variantData = db
            .prepare("SELECT * FROM product_variants WHERE id = ?")
            .get(item.variant_id);
          if (variantData) {
            stockToCheck = variantData.stock;
          }
        } else if (product.has_variants) {
          // Товар имеет варианты, но variant_id не указан - пропускаем проверку stock базового товара
          // т.к. stock хранится в вариантах
          stockToCheck = null;
        }

        if (stockToCheck !== null && stockToCheck < item.quantity) {
          const itemTitle = item.variant_name
            ? `${product.title} (${item.variant_name})`
            : product.title;
          throw new Error(`Недостаточно товара: ${itemTitle}`);
        }

        const pricePerUnit =
          item.price_per_unit || variantData?.price_rub || product.priceRub;
        const costPerUnit = product.cost_price || 0;
        const totalPrice = pricePerUnit * item.quantity;
        const totalItemCost = costPerUnit * item.quantity;

        totalAmount += totalPrice;
        totalCost += totalItemCost;

        const groupName = product.groupId
          ? db
              .prepare("SELECT name FROM category_groups WHERE id = ?")
              .get(product.groupId)?.name || null
          : null;

        return {
          id: generateId("oi"),
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          product_title: item.variant_name
            ? `${product.title} - ${item.variant_name}`
            : product.title || "Без названия",
          group_name: groupName,
          base_product_title:
            item.product_title || product.title || "Без названия",
          base_product_id: item.product_id,
          variant_name: item.variant_name || null,
          quantity: item.quantity,
          price_per_unit: pricePerUnit,
          cost_per_unit: costPerUnit,
          discount_amount: 0,
          total_price: totalPrice,
          total_cost: totalItemCost,
          has_variants: product.has_variants,
        };
      });

      // Validate and apply promo code
      let promoDiscount = 0;
      let promoCodeId = null;
      let promoCodeText = null;
      let promoResult = null;

      if (promo_code && promo_code.trim()) {
        promoResult = validatePromoCode(promo_code, totalAmount);
        if (!promoResult.valid) {
          throw new Error(promoResult.message || 'Недействительный промокод');
        }
        promoDiscount = promoResult.calculated_discount;
        promoCodeId = promoResult.promo.id;
        promoCodeText = promo_code.trim().toUpperCase();
      }

      const finalAmount = totalAmount - promoDiscount;
      const profit = finalAmount - totalCost;

      // Insert order
      db.prepare(
        `
        INSERT INTO orders (
          id, order_number, customer_id, status, delivery_type, delivery_address,
          total_amount, discount_amount, discount_percent, final_amount, profit, notes, phone, telegram_username,
          promo_code_id, promo_code_text
        ) VALUES (?, ?, ?, 'new', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        orderId,
        orderNumber,
        customerId,
        delivery_type,
        delivery_address || null,
        totalAmount,
        promoDiscount,
        finalAmount,
        profit,
        notes || null,
        phone || null,
        verifiedTelegramUsername || null,
        promoCodeId,
        promoCodeText,
      );

      // Insert order items
      const itemStmt = db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, product_title, group_name, base_product_title, base_product_id, variant_id, variant_name, quantity,
          price_per_unit, cost_per_unit, discount_amount, total_price, total_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of orderItems) {
        itemStmt.run(
          item.id,
          orderId,
          item.product_id,
          item.product_title,
          item.group_name,
          item.base_product_title,
          item.base_product_id,
          item.variant_id || null,
          item.variant_name,
          item.quantity,
          item.price_per_unit,
          item.cost_per_unit,
          item.discount_amount,
          item.total_price,
          item.total_cost,
        );

        // ВАЖНО: НЕ списываем сток при создании заказа!
        // Сток списывается только при переходе в статус "Собран" (in_progress)
        // Это защита от абуза - конкуренты могут создавать фейковые заказы
        // и товары будут пропадать из наличия без реальных продаж
      }

      // Record promo usage and increment counter
      if (promoCodeId && promoResult) {
        db.prepare(`
          INSERT INTO promo_usage (id, promo_code_id, order_id, customer_id, discount_applied)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          generateId('pu'),
          promoCodeId,
          orderId,
          customerId || null,
          promoDiscount,
        );

        db.prepare('UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = ?').run(promoCodeId);
      }

      // Update customer stats
      if (customerId) {
        db.prepare(
          `
          UPDATE customers
          SET total_orders = total_orders + 1,
              total_spent = total_spent + ?,
              last_order_at = DATETIME('now'),
              updated_at = DATETIME('now')
          WHERE id = ?
        `,
        ).run(finalAmount, customerId);
      }

      return { orderId, orderNumber };
    });

    const result = tx();

    res.json({
      success: true,
      order_id: result.orderId,
      order_number: result.orderNumber,
      message: "Заказ успешно создан",
    });
  } catch (error) {
    console.error("[public] Create order error:", error);
    if (
      [
        "invalid_item_quantity",
        "promo_and_loyalty_conflict",
        "loyalty_category_not_available",
        "loyalty_balance_not_enough",
      ].includes(error.message)
    ) {
      return res.status(400).json({
        error: error.message,
        message: error.message,
      });
    }
    res.status(500).json({
      error: "failed",
      message: error.message || "Не удалось создать заказ",
    });
  }
});
