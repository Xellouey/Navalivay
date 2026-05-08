import express from "express";
import rateLimit from "express-rate-limit";
import { db } from "../db.js";
import {
  applyOrderLoyaltyReservations,
  buildLoyaltyApplication,
  releaseOrderLoyaltyReservations,
} from "../loyalty.js";
import { requireTelegramMiniAppAuth } from "../telegram-miniapp-auth.js";
import {
  normalizePromoCode,
  releasePromoUsageForOrder,
  reservePromoUsageForOrder,
  validatePromoCode as validatePromoCodeForOrder,
} from "../promo-code-service.js";
import {
  getWholesaleTierById,
  getWholesaleUnitPriceForProduct,
  getWholesalePricedGroupIds,
  resolveWholesaleContextFromRequest,
  validateWholesaleMinimum,
} from "../wholesale-service.js";
import {
  activatePendingBansForCustomer,
  getActiveBlockForTelegramId,
  getPendingBanForUsername,
  serializeBlock,
} from "../utils/customer-blocks.js";
import {
  listActiveAgreements,
  validateAcceptedAgreementIds,
  buildAcceptedSnapshot,
} from "../utils/agreements.js";
import {
  confirmVerificationOnAccess,
  isCustomerVerified,
} from "../utils/business-bot.js";

export const publicRouter = express.Router();

/** Розница: цена варианта из БД, если > 0; иначе цена строки товара / опт. Опт: всегда effectivePrice. */
function resolveVariantPublicPriceRub(variantRow, effectivePrice, isWholesaleTier) {
  if (isWholesaleTier) {
    return effectivePrice;
  }
  const raw = variantRow?.priceRub;
  const n = raw != null && raw !== "" ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) {
    return n;
  }
  return effectivePrice;
}

const MAX_SQL_VARS = 900;
const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN || "";
const allowInsecureTelegramFallback =
  !["production", "test"].includes(String(process.env.NODE_ENV || "").toLowerCase()) &&
  process.env.ALLOW_INSECURE_TELEGRAM_AUTH !== "0";
const publicMiniAppReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
const publicMiniAppMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getNextNumber(table, field) {
  const row = db.prepare(`SELECT MAX(${field}) as maxNum FROM ${table}`).get();
  return (row?.maxNum || 0) + 1;
}

function throwPromoValidationError(result) {
  const error = new Error(result?.error || "invalid_promo");
  error.userMessage = result?.message || "Недействительный промокод";
  throw error;
}

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

function getMinDeliveryAmount() {
  const minDeliveryRow = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get("min_delivery_amount");
  return parseFloat(minDeliveryRow?.value || "0") || 0;
}

function ensureMinDeliveryAmountSatisfied(totalAmount) {
  const minDeliveryAmount = getMinDeliveryAmount();
  if (minDeliveryAmount <= 0) {
    return null;
  }

  if (Number(totalAmount || 0) >= minDeliveryAmount) {
    return null;
  }

  return {
    error: "min_delivery_amount_not_met",
    message: `Минимальная сумма заказа для доставки: ${minDeliveryAmount} BYN. Сейчас в корзине: ${Number(totalAmount || 0).toFixed(2)} BYN`,
    min_amount: minDeliveryAmount,
    current_amount: Number(totalAmount || 0),
  };
}

function buildWholesaleErrorPayload(error) {
  return {
    error: error?.code || "invalid_wholesale_link",
    message: error?.message || "Оптовая ссылка недействительна",
  };
}

function resolveWholesaleContextOrSendError(req, res) {
  try {
    return resolveWholesaleContextFromRequest(req);
  } catch (error) {
    res.status(error?.statusCode || 400).json(buildWholesaleErrorPayload(error));
    return null;
  }
}

function buildStoredWholesaleContext(order) {
  if (!order || Number(order.is_wholesale || 0) !== 1 || !order.wholesale_tier_id) {
    return null;
  }

  const tier = getWholesaleTierById(order.wholesale_tier_id);
  if (!tier) {
    return null;
  }

  return {
    isWholesale: true,
    tier: {
      ...tier,
      label: order.wholesale_tier_label || tier.label,
      minOrderAmount: Number(
        order.wholesale_min_amount ?? tier.minOrderAmount ?? 0,
      ),
    },
    code: tier.code,
    secret: "",
    minOrderAmount: Number(order.wholesale_min_amount ?? tier.minOrderAmount ?? 0),
    label: order.wholesale_tier_label || tier.label,
  };
}

function applyWholesaleTierFilter(whereClauses, whereParams, tierId, column = "p.groupId") {
  const normalizedTierId = typeof tierId === "string" ? tierId.trim() : "";
  if (!normalizedTierId) {
    whereClauses.push("1 = 0");
    return;
  }

  whereClauses.push(`EXISTS (
    SELECT 1
    FROM category_group_wholesale_prices gwp
    WHERE gwp.group_id = ${column}
      AND gwp.tier_id = ?
      AND gwp.price_byn > 0
  )`);
  whereParams.push(normalizedTierId);
}

async function resolveVerifiedOrderUsername(authIdentity, submittedUsername) {
  const normalizedSubmitted = normalizeTelegramUsername(submittedUsername);
  const verifiedFromAuth = normalizeTelegramUsername(authIdentity?.telegramUsername);

  if (verifiedFromAuth) {
    return verifiedFromAuth;
  }

  const telegramId = authIdentity?.telegramId ? String(authIdentity.telegramId).trim() : "";
  if (telegramId) {
    const usernameStatus = await resolveTelegramUsernameStatus(telegramId);

    if (usernameStatus.status === "confirmed" && usernameStatus.username) {
      return normalizeTelegramUsername(usernameStatus.username);
    }

    if (usernameStatus.status === "missing") {
      const error = new Error(
        usernameStatus.message || "Для оформления заказа нужен Telegram username",
      );
      error.code = "telegram_username_required";
      throw error;
    }

    if (normalizedSubmitted && allowInsecureTelegramFallback) {
      return normalizedSubmitted;
    }

    const error = new Error(
      "Не удалось проверить username. Закройте магазин и откройте заново.",
    );
    error.code = "telegram_username_not_verified";
    throw error;
  }

  return normalizedSubmitted;
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
  releasePromoUsageForOrder(order);
}

function describeOrderItem(item) {
  const lineName = item.group_name || item.groupName || null;
  const baseTitle =
    item.base_product_title ||
    item.product_title ||
    item.title ||
    item.product_id ||
    "товар";
  const titledItem = item.variant_name ? `${baseTitle} (${item.variant_name})` : baseTitle;
  return lineName ? `${lineName} - ${titledItem}` : titledItem;
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
  const wholesaleTier = order.wholesale_tier_id
    ? getWholesaleTierById(order.wholesale_tier_id)
    : null;

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
    is_wholesale: Number(order.is_wholesale || 0),
    wholesale_tier_id: order.wholesale_tier_id || null,
    wholesale_code: wholesaleTier?.code || null,
    wholesale_secret: wholesaleTier?.secretKey || null,
    wholesale_tier_label: order.wholesale_tier_label || null,
    wholesale_min_amount: order.wholesale_min_amount === null || order.wholesale_min_amount === undefined
      ? null
      : Number(order.wholesale_min_amount),
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

publicRouter.get("/api/wholesale/context", (req, res) => {
  const wholesaleContext = resolveWholesaleContextOrSendError(req, res);
  if (!wholesaleContext) {
    if (res.headersSent) {
      return;
    }
    return res.status(400).json({
      error: "wholesale_required",
      message: "Не указана оптовая ссылка",
    });
  }

  return res.json({
    ok: true,
    is_wholesale: true,
    wholesale_code: wholesaleContext.tier.code,
    wholesale_label: wholesaleContext.tier.label,
    wholesale_min_amount: Number(wholesaleContext.tier.minOrderAmount || 0),
    restrictions: {
      hide_banners: true,
      disable_loyalty: true,
      disable_promos: true,
      replace_bottom_tab_bar: true,
    },
  });
});

publicRouter.get("/api/categories", (req, res) => {
  const wholesaleContext = resolveWholesaleContextOrSendError(req, res);
  if (!wholesaleContext && res.headersSent) {
    return;
  }

  const pricedGroupIds = wholesaleContext?.tier
    ? getWholesalePricedGroupIds(wholesaleContext.tier.id)
    : [];

  // РћРџРўРРњРР—РђР¦РРЇ: РЅРµ Р·Р°РіСЂСѓР¶Р°РµРј cover_image РІ СЃРїРёСЃРєРµ - СЌРєРѕРЅРѕРјРёС‚ ~8MB С‚СЂР°С„РёРєР°
  // Р¤СЂРѕРЅС‚РµРЅРґ Р·Р°РіСЂСѓР¶Р°РµС‚ РѕР±Р»РѕР¶РєРё РѕС‚РґРµР»СЊРЅРѕ С‡РµСЂРµР· /api/categories/:id/image
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

  let groupsRaw = db
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

  if (wholesaleContext?.tier) {
    const parentById = new Map(
      groupsRaw.map((group) => [
        String(group.id),
        group.parent_group_id ? String(group.parent_group_id) : null,
      ]),
    );
    const visibleGroupIds = new Set(pricedGroupIds.map((id) => String(id)));

    pricedGroupIds.forEach((groupId) => {
      let cursor = parentById.get(String(groupId));
      while (cursor) {
        if (visibleGroupIds.has(cursor)) {
          break;
        }
        visibleGroupIds.add(cursor);
        cursor = parentById.get(cursor) || null;
      }
    });

    groupsRaw = groupsRaw.filter((group) => visibleGroupIds.has(String(group.id)));
  }

  const categoryCountWhere = [
    `(
      (p.has_variants = 0 AND (p.stock IS NULL OR p.stock > 0))
      OR
      (p.has_variants = 1 AND EXISTS (
        SELECT 1 FROM product_variants pv 
        WHERE pv.product_id = p.id 
          AND (pv.stock IS NULL OR pv.stock > 0)
      ))
    )`,
  ];
  const categoryCountParams = [];

  if (wholesaleContext?.tier) {
    applyWholesaleTierFilter(
      categoryCountWhere,
      categoryCountParams,
      wholesaleContext.tier.id,
    );
  }

  const categoryCountRows = db
    .prepare(
      `
    SELECT categoryId, COUNT(DISTINCT p.id) as total
    FROM products p
    WHERE ${categoryCountWhere.join(" AND ")}
    GROUP BY categoryId
  `,
    )
    .all(...categoryCountParams);

  const groupCountWhere = [
    "groupId IS NOT NULL",
    `(
      (p.has_variants = 0 AND (p.stock IS NULL OR p.stock > 0))
      OR
      (p.has_variants = 1 AND EXISTS (
        SELECT 1 FROM product_variants pv 
        WHERE pv.product_id = p.id 
          AND (pv.stock IS NULL OR pv.stock > 0)
      ))
    )`,
  ];
  const groupCountParams = [];

  if (wholesaleContext?.tier) {
    applyWholesaleTierFilter(
      groupCountWhere,
      groupCountParams,
      wholesaleContext.tier.id,
    );
  }

  const groupCountRows = db
    .prepare(
      `
    SELECT groupId, COUNT(DISTINCT p.id) as total
    FROM products p
    WHERE ${groupCountWhere.join(" AND ")}
    GROUP BY groupId
  `,
    )
    .all(...groupCountParams);

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
  const wholesaleContext = resolveWholesaleContextOrSendError(req, res);
  if (!wholesaleContext && res.headersSent) {
    return;
  }

  if (wholesaleContext) {
    return res.json([]);
  }

  const rows = db
    .prepare(
      "SELECT id, image, href, active, [order], openInNewTab FROM banners WHERE active = 1 ORDER BY [order] ASC",
    )
    .all();
  return res.json(rows);
});

// Endpoint РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ РѕР±Р»РѕР¶РєРё РєР°С‚РµРіРѕСЂРёРё РѕС‚РґРµР»СЊРЅРѕ (РѕРїС‚РёРјРёР·Р°С†РёСЏ С‚СЂР°С„РёРєР°)
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

// Endpoint РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ РѕР±Р»РѕР¶РєРё РіСЂСѓРїРїС‹ РєР°С‚РµРіРѕСЂРёР№
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
  const wholesaleContext = resolveWholesaleContextOrSendError(req, res);
  if (!wholesaleContext && res.headersSent) {
    return;
  }

  const { category, group, sort } = req.query;

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

  whereClauses.unshift(`(
    (p.has_variants = 0 AND (p.stock IS NULL OR p.stock > 0))
    OR
    (p.has_variants = 1 AND EXISTS (
      SELECT 1 FROM product_variants pv 
      WHERE pv.product_id = p.id 
      AND (pv.stock IS NULL OR pv.stock > 0)
    ))
  )`);

  if (wholesaleContext?.tier) {
    applyWholesaleTierFilter(whereClauses, whereParams, wholesaleContext.tier.id);
  }

  const where = `WHERE ${whereClauses.join(" AND ")}`;
  const effectivePriceExpr = wholesaleContext?.tier
    ? `(SELECT gwp.price_byn FROM category_group_wholesale_prices gwp WHERE gwp.group_id = p.groupId AND gwp.tier_id = ? LIMIT 1)`
    : `p.priceRub`;

  let orderBy = "ORDER BY effectivePriceRub ASC";
  switch (String(sort || "price_asc")) {
    case "price_desc":
      orderBy = "ORDER BY effectivePriceRub DESC";
      break;
    case "newest":
      orderBy = "ORDER BY p.createdAt DESC";
      break;
    case "oldest":
      orderBy = "ORDER BY p.createdAt ASC";
      break;
    default:
      orderBy = "ORDER BY effectivePriceRub ASC";
  }

  const countSql = `SELECT COUNT(*) as total FROM products p ${where}`;
  const total = whereParams.length
    ? db.prepare(countSql).get(...whereParams).total
    : db.prepare(countSql).get().total;

  const sql = `
    SELECT 
      p.id, 
      p.categoryId, 
      p.groupId,
      p.title, 
      p.priceRub, 
      ${effectivePriceExpr} AS effectivePriceRub,
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
  const sqlParams = wholesaleContext?.tier
    ? [wholesaleContext.tier.id, ...whereParams, limit, offset]
    : [...whereParams, limit, offset];
  const products = db.prepare(sql).all(...sqlParams);

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

  const enriched = products
    .map((p) => {
      const stockValue = typeof p.stock === "number" ? p.stock : null;
      const effectivePrice = Number(
        wholesaleContext?.tier ? p.effectivePriceRub ?? 0 : p.priceRub ?? 0,
      );

      if (wholesaleContext?.tier && (!Number.isFinite(effectivePrice) || effectivePrice <= 0)) {
        return null;
      }

      const result = {
        ...p,
        priceRub: effectivePrice,
        stock: stockValue,
        costPrice: typeof p.costPrice === "number" ? p.costPrice : null,
        minStock: typeof p.minStock === "number" ? p.minStock : null,
        badges: badgesByProduct.get(p.id) ?? [],
        isAvailable: stockValue === null ? true : stockValue > 0,
        links: linksByProduct.get(p.id) ?? [],
        isWholesale: Boolean(wholesaleContext?.tier),
        wholesaleCode: wholesaleContext?.tier?.code || null,
        wholesaleMinAmount: wholesaleContext?.tier
          ? Number(wholesaleContext.tier.minOrderAmount || 0)
          : null,
      };

      if (p.hasVariants) {
        const variants = variantsByProduct.get(p.id) ?? [];
        result.variants = variants.map((v) => ({
          ...v,
          priceRub: resolveVariantPublicPriceRub(v, effectivePrice, Boolean(wholesaleContext?.tier)),
          images: variantImagesByProduct.get(p.id)?.get(v.id) ?? [],
        }));
        result.images =
          result.variants.length > 0 &&
          result.variants[0].images &&
          result.variants[0].images.length > 0
            ? result.variants[0].images
            : [];
        result.isAvailable = result.variants.some(
          (v) => v.stock === null || v.stock > 0,
        );
      } else {
        const productImages = baseImagesByProduct.get(p.id) ?? [];
        result.images = productImages;
        result.needsCategoryImage =
          p.useCategoryImage && productImages.length === 0;
      }

      return result;
    })
    .filter(Boolean);

  res.json({
    products: enriched,
    total,
    hasMore: offset + limit < total,
    is_wholesale: Boolean(wholesaleContext?.tier),
    wholesale_code: wholesaleContext?.tier?.code || null,
    wholesale_min_amount: wholesaleContext?.tier
      ? Number(wholesaleContext.tier.minOrderAmount || 0)
      : null,
  });
});

publicRouter.get("/api/product/:id", (req, res) => {
  const wholesaleContext = resolveWholesaleContextOrSendError(req, res);
  if (!wholesaleContext && res.headersSent) {
    return;
  }

  const id = req.params.id;
  const effectivePriceExpr = wholesaleContext?.tier
    ? `(SELECT gwp.price_byn FROM category_group_wholesale_prices gwp WHERE gwp.group_id = p.groupId AND gwp.tier_id = ? LIMIT 1)`
    : `p.priceRub`;

  const p = db
    .prepare(
      `
    SELECT 
      p.id,
      p.categoryId,
      p.groupId,
      p.title,
      p.priceRub,
      ${effectivePriceExpr} AS effectivePriceRub,
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
    .get(...(wholesaleContext?.tier ? [wholesaleContext.tier.id, id] : [id]));
  if (!p) return res.status(404).json({ error: "Not found" });

  const effectivePrice = Number(
    wholesaleContext?.tier ? p.effectivePriceRub ?? 0 : p.priceRub ?? 0,
  );
  if (wholesaleContext?.tier && (!Number.isFinite(effectivePrice) || effectivePrice <= 0)) {
    return res.status(404).json({ error: "Not found" });
  }

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
    priceRub: effectivePrice,
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
    isWholesale: Boolean(wholesaleContext?.tier),
    wholesaleCode: wholesaleContext?.tier?.code || null,
    wholesaleMinAmount: wholesaleContext?.tier
      ? Number(wholesaleContext.tier.minOrderAmount || 0)
      : null,
  };

  if (p.hasVariants) {
    // Р”Р»СЏ С‚РѕРІР°СЂРѕРІ СЃ РІР°СЂРёР°РЅС‚Р°РјРё РїРѕР»СѓС‡Р°РµРј РІР°СЂРёР°РЅС‚С‹ Рё РёС… РёР·РѕР±СЂР°Р¶РµРЅРёСЏ
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
      priceRub: resolveVariantPublicPriceRub(v, effectivePrice, Boolean(wholesaleContext?.tier)),
      images: db
        .prepare(
          "SELECT url FROM product_images WHERE productId = ? AND variant_id = ? ORDER BY position ASC",
        )
        .all(id, v.id)
        .map((r) => r.url),
    }));
    // Р”Р»СЏ РѕР±СЂР°С‚РЅРѕР№ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё, РїРѕРєР°Р·С‹РІР°РµРј РёР·РѕР±СЂР°Р¶РµРЅРёСЏ РїРµСЂРІРѕРіРѕ РІР°СЂРёР°РЅС‚Р° РєР°Рє РёР·РѕР±СЂР°Р¶РµРЅРёСЏ С‚РѕРІР°СЂР°
    result.images =
      result.variants.length > 0 &&
      result.variants[0].images &&
      result.variants[0].images.length > 0
        ? result.variants[0].images
        : [];
    // РћР±РЅРѕРІР»СЏРµРј РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ РЅР° РѕСЃРЅРѕРІРµ РІР°СЂРёР°РЅС‚РѕРІ
    result.isAvailable = result.variants.some(
      (v) => v.stock === null || v.stock > 0,
    );
  } else {
    // РћР±С‹С‡РЅС‹Р№ С‚РѕРІР°СЂ Р±РµР· РІР°СЂРёР°РЅС‚РѕРІ
    const productImages = db
      .prepare(
        "SELECT url FROM product_images WHERE productId = ? AND variant_id IS NULL ORDER BY position ASC",
      )
      .all(id)
      .map((r) => r.url);
    result.images = productImages;
    // Р¤Р»Р°Рі РґР»СЏ С„СЂРѕРЅС‚РµРЅРґР° - РЅСѓР¶РЅРѕ Р·Р°РіСЂСѓР·РёС‚СЊ РѕР±Р»РѕР¶РєСѓ РєР°С‚РµРіРѕСЂРёРё
    result.needsCategoryImage =
      p.useCategoryImage && productImages.length === 0;
  }

  res.json(result);
});

publicRouter.get("/api/cross-sells", (req, res) => {
  const wholesaleContext = resolveWholesaleContextOrSendError(req, res);
  if (!wholesaleContext && res.headersSent) {
    return;
  }

  if (wholesaleContext) {
    return res.json([]);
  }

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

  // РћРџРўРРњРР—РђР¦РРЇ: РЅРµ Р·Р°РіСЂСѓР¶Р°РµРј cover_image РєР°С‚РµРіРѕСЂРёРё
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
      // Р”Р»СЏ С‚РѕРІР°СЂРѕРІ СЃ РІР°СЂРёР°РЅС‚Р°РјРё РїРѕР»СѓС‡Р°РµРј РІР°СЂРёР°РЅС‚С‹ Рё РёС… РёР·РѕР±СЂР°Р¶РµРЅРёСЏ
      const variants = variantStmt.all(row.productId);
      result.variants = variants.map((v) => ({
        ...v,
        images: variantImgStmt.all(row.productId, v.id).map((r) => r.url),
      }));
      // Р”Р»СЏ РѕР±СЂР°С‚РЅРѕР№ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё, РїРѕРєР°Р·С‹РІР°РµРј РёР·РѕР±СЂР°Р¶РµРЅРёСЏ РїРµСЂРІРѕРіРѕ РІР°СЂРёР°РЅС‚Р° РєР°Рє РёР·РѕР±СЂР°Р¶РµРЅРёСЏ С‚РѕРІР°СЂР°
      result.images =
        result.variants.length > 0 &&
        result.variants[0].images &&
        result.variants[0].images.length > 0
          ? result.variants[0].images
          : [];
      // РћР±РЅРѕРІР»СЏРµРј РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ РЅР° РѕСЃРЅРѕРІРµ РІР°СЂРёР°РЅС‚РѕРІ
      result.isAvailable = result.variants.some(
        (v) => v.stock === null || v.stock > 0,
      );
    } else {
      // РћР±С‹С‡РЅС‹Р№ С‚РѕРІР°СЂ Р±РµР· РІР°СЂРёР°РЅС‚РѕРІ
      const productImages = imageStmt.all(row.productId).map((r) => r.url);
      result.images = productImages;
      // Р¤Р»Р°Рі РґР»СЏ С„СЂРѕРЅС‚РµРЅРґР°
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
      telegram_bot_username: (process.env.TELEGRAM_BOT_USERNAME || "")
        .trim()
        .replace(/^@/, ""),
      /** Короткое имя Mini App из @BotFather (сегмент t.me/bot/NAME/…). Пусто = только main-ссылка. */
      telegram_mini_app_short_name: (process.env.TELEGRAM_MINI_APP_SHORT_NAME || "")
        .trim()
        .replace(/^\/+|\/+$/g, ""),
      // РњРёРЅРёРјР°Р»СЊРЅР°СЏ СЃСѓРјРјР° РґР»СЏ РґРѕСЃС‚Р°РІРєРё
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
      // Р‘Р°РЅРЅРµСЂ СѓСЃР»РѕРІРёР№ РґРѕСЃС‚Р°РІРєРё (fullscreen)
      delivery_conditions_image: getSettingValue(
        "delivery_conditions_image",
        "",
      ),
      // Р РµРґРёСЂРµРєС‚ РІ Telegram РїРѕСЃР»Рµ Р·Р°РєР°Р·Р°
      order_redirect_telegram: getSettingValue("order_redirect_telegram", ""),
      order_redirect_text_template: getSettingValue(
        "order_redirect_text_template",
        "Мой номер заказа - #{order_number}",
      ),
    });
  } catch (error) {
    console.error("[public] Failed to get settings:", error);
    // Р’РѕР·РІСЂР°С‰Р°РµРј РґРµС„РѕР»С‚РЅС‹Рµ Р·РЅР°С‡РµРЅРёСЏ РІ СЃР»СѓС‡Р°Рµ РѕС€РёР±РєРё
    res.json({
      manager_telegram: "dmitriy_mityuk",
      telegram_bot_username: "",
      telegram_mini_app_short_name: "",
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

// Подтверждение бот-кода доступа: клиент пришёл в Mini App с кодом из чата
// (deep-link `?startapp=NV-XXXXXX` распарсивается на фронте и передаётся
// сюда). Если код совпал с записью у клиента по telegram_id — клиент
// маркируется как verified. Старые клиенты (total_orders > 0) считаются
// verified автоматически, см. isCustomerVerified.
publicRouter.post(
  "/api/customer/bot-verify",
  publicMiniAppMutationLimiter,
  requireTelegramMiniAppAuth({ allowInsecureFallback: allowInsecureTelegramFallback }),
  (req, res) => {
    try {
      const telegramId = String(req.telegramAuth?.telegramId || "").trim();
      if (!telegramId) {
        return res.status(400).json({ error: "telegram_id_required" });
      }
      const code = String(req.body?.code ?? "").trim();
      const confirmed = confirmVerificationOnAccess({
        telegramId,
        code: code || null,
      });
      const verified = isCustomerVerified(telegramId);
      res.json({ ok: confirmed, verified });
    } catch (err) {
      console.error("[public] bot-verify error:", err);
      res.status(500).json({ error: "failed", message: err.message });
    }
  },
);

// Активные соглашения для чекаута (публично, без auth — клиент должен видеть
// заголовки и body чтобы прочитать в модалке перед оформлением заказа).
// Body шлём целиком — это короткие маркетинговые/юридические тексты, не
// чувствительные данные. Под rate-limiter'ом для консистентности с другими
// public read-эндпоинтами.
publicRouter.get("/api/agreements", publicMiniAppReadLimiter, (req, res) => {
  try {
    res.json({ items: listActiveAgreements() });
  } catch (err) {
    console.error("[public] List agreements error:", err);
    res.status(500).json({ error: "failed", message: err.message });
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

publicRouter.get(
  "/api/customer/me",
  publicMiniAppReadLimiter,
  requireTelegramMiniAppAuth({ allowInsecureFallback: allowInsecureTelegramFallback }),
  async (req, res) => {
    try {
      const telegramId = String(req.telegramAuth?.telegramId || "").trim();
      const telegramUsername = normalizeTelegramUsername(req.telegramAuth?.telegramUsername);

      let customer = null;
      if (telegramId) {
        customer = db.prepare(`
          SELECT id, telegram_id, telegram_username, first_name, last_name,
                 phone, total_orders, total_spent, photo_url, photo_updated_at,
                 created_at
          FROM customers
          WHERE telegram_id = ?
        `).get(telegramId);
      }

      if (!customer && telegramUsername) {
        customer = db.prepare(`
          SELECT id, telegram_id, telegram_username, first_name, last_name,
                 phone, total_orders, total_spent, photo_url, photo_updated_at,
                 created_at
          FROM customers
          WHERE LOWER(COALESCE(telegram_username, '')) = LOWER(?)
          LIMIT 1
        `).get(telegramUsername);
      }

      if (!customer) {
        return res.json({
          found: false,
          telegram_id: telegramId || null,
          first_name: null,
          last_name: null,
          telegram_username: telegramUsername || null,
          photo_url: null,
          total_orders: 0,
          total_spent: 0,
          member_since: null,
        });
      }

      let photoUrl = customer.photo_url || null;
      const photoAge = customer.photo_updated_at
        ? Date.now() - new Date(customer.photo_updated_at).getTime()
        : Infinity;
      const PHOTO_CACHE_MS = 24 * 60 * 60 * 1000;

      if (telegramId && photoAge > PHOTO_CACHE_MS && TELEGRAM_BOT_TOKEN) {
        try {
          const chat = await fetchTelegramChat(telegramId);
          if (chat?.photo?.big_file_id) {
            const fileResp = await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(chat.photo.big_file_id)}`,
            );
            const fileData = await fileResp.json();
            if (fileData?.ok && fileData.result?.file_path) {
              photoUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
            }
          } else {
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
        }
      }

      // bot_verified: клиент считается верифицированным, если у него есть
      // bot_verified_at либо хотя бы один заказ (старые клиенты). Используем
      // util чтобы логика была в одном месте — те же правила применяются
      // на стороне бота при выдаче доступа.
      const botVerified = isCustomerVerified(customer.telegram_id);

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
        bot_verified: botVerified,
      });
    } catch (error) {
      console.error("[public] Failed to get customer profile:", error);
      res.status(500).json({
        error: "profile_failed",
        message: "Не удалось загрузить профиль",
      });
    }
  },
);

publicRouter.get(
  "/api/orders/my-active",
  publicMiniAppReadLimiter,
  requireTelegramMiniAppAuth({ allowInsecureFallback: allowInsecureTelegramFallback }),
  (req, res) => {
    try {
      const telegramId = String(req.telegramAuth?.telegramId || "").trim();
      const telegramUsername = normalizeTelegramUsername(req.telegramAuth?.telegramUsername);

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
  },
);

publicRouter.post(
  "/api/orders/:id/cancel-by-customer",
  publicMiniAppMutationLimiter,
  requireTelegramMiniAppAuth({ allowInsecureFallback: allowInsecureTelegramFallback }),
  (req, res) => {
    try {
      const { id } = req.params;
      const telegramId = String(req.telegramAuth?.telegramId || "").trim();
      const telegramUsername = normalizeTelegramUsername(req.telegramAuth?.telegramUsername);

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

        releasePromoUsageForOrder(order);

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
  },
);

publicRouter.put(
  "/api/orders/:id/modify-by-customer",
  publicMiniAppMutationLimiter,
  requireTelegramMiniAppAuth({ allowInsecureFallback: allowInsecureTelegramFallback }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
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

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          error: "items_required",
          message: "Товары обязательны",
        });
      }

      const telegramId = String(req.telegramAuth?.telegramId || "").trim();
      const authTelegramUsername = normalizeTelegramUsername(req.telegramAuth?.telegramUsername);
      const order = findOwnedActiveOrder({
        orderId: id,
        telegramId,
        telegramUsername: authTelegramUsername,
      });

      if (!order) {
        return res.status(404).json({
          error: "not_found",
          message: "Активный заказ не найден",
        });
      }

      const normalizedUsername = await resolveVerifiedOrderUsername(
        req.telegramAuth,
        telegram_username || order.resolved_telegram_username || order.telegram_username,
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
      const wholesaleContext = buildStoredWholesaleContext(order);

      if (Number(order.is_wholesale || 0) === 1 && !wholesaleContext) {
        return res.status(400).json({
          error: "wholesale_context_missing",
          message: "Не удалось восстановить оптовый прайс для этого заказа",
        });
      }

      const tx = db.transaction(() => {
        if (order.stock_deducted) {
          restoreStockForOrderItems(previousItems);
        }
        releaseOrderLoyaltyReservations(id);

        const normalizedPromoCode = wholesaleContext
          ? null
          : normalizePromoCode(promo_code);
        const orderBuild = buildPublicOrderItems({
          items,
          customerId: order.customer_id || null,
          promoCodeText: normalizedPromoCode,
          existingOrderId: id,
          wholesaleContext,
        });

        if (delivery_type === "delivery") {
          const minDeliveryError = ensureMinDeliveryAmountSatisfied(orderBuild.totalAmount);
          if (minDeliveryError) {
            const error = new Error(minDeliveryError.message);
            error.code = minDeliveryError.error;
            error.payload = minDeliveryError;
            throw error;
          }
        }

        const wholesaleMinError = validateWholesaleMinimum(
          orderBuild.totalAmount,
          wholesaleContext,
        );
        if (wholesaleMinError) {
          const error = new Error(wholesaleMinError.message);
          error.code = wholesaleMinError.error;
          error.payload = wholesaleMinError;
          throw error;
        }

        let nextPromoDiscount = 0;
        let nextPromoCodeId = null;
        let nextPromoResult = null;
        if (normalizedPromoCode) {
          nextPromoResult = validatePromoCodeForOrder(
            normalizedPromoCode,
            orderBuild.totalAmount,
            { excludeOrderId: id },
          );
          if (!nextPromoResult.valid) {
            throwPromoValidationError(nextPromoResult);
            throw new Error(
              nextPromoResult.message || "Недействительный промокод",
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

        if (!wholesaleContext) {
          applyOrderLoyaltyReservations({
            customerId: order.customer_id || null,
            orderId: id,
            application: orderBuild.application,
          });
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
              is_wholesale = ?,
              wholesale_tier_id = ?,
              wholesale_tier_label = ?,
              wholesale_min_amount = ?,
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
          wholesaleContext ? 1 : 0,
          wholesaleContext?.tier?.id || null,
          wholesaleContext?.tier?.label || null,
          wholesaleContext?.tier
            ? Number(wholesaleContext.tier.minOrderAmount || 0)
            : null,
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
            req.telegramAuth?.firstName || first_name || null,
            req.telegramAuth?.lastName || last_name || null,
            delivery_type === "delivery" ? phone || null : null,
            order.customer_id,
          );
        }

        if (!wholesaleContext && nextPromoCodeId && nextPromoResult) {
          reservePromoUsageForOrder({
            promoCodeId: nextPromoCodeId,
            orderId: id,
            customerId: order.customer_id || null,
            discountApplied: nextPromoDiscount,
            idFactory: () => generateId("pu"),
          });
        }
      });

      tx();
      recordOrderStatusChange(id, previousStatus, "new", "Клиент изменил заказ");

      return res.json({
        success: true,
        order_id: id,
      });
    } catch (error) {
      const errorCode = String(error.code || error.message || "");
      if (error.payload?.error === "min_delivery_amount_not_met") {
        return res.status(400).json(error.payload);
      }
      if (error.payload?.error === "wholesale_min_not_met") {
        return res.status(400).json(error.payload);
      }
      if (
        errorCode === "telegram_username_required" ||
        errorCode === "telegram_username_not_verified" ||
        errorCode === "promo_and_loyalty_conflict" ||
        errorCode === "loyalty_category_not_available" ||
        errorCode === "loyalty_balance_not_enough" ||
        errorCode === "loyalty_category_limit_exceeded" ||
        errorCode === "wholesale_price_unavailable"
      ) {
        return res.status(400).json({
          error: errorCode,
          message: error.userMessage || error.message || errorCode,
        });
      }
      console.error("[public] Modify by customer error:", error);
      return res.status(500).json({
        error: "modify_failed",
        message: error.message || "Не удалось изменить заказ",
      });
    }
  },
);

publicRouter.post(
  "/api/orders",
  publicMiniAppMutationLimiter,
  requireTelegramMiniAppAuth({ allowInsecureFallback: allowInsecureTelegramFallback }),
  async (req, res) => {
    try {
      const {
        telegram_username,
        first_name,
        last_name,
        phone,
        delivery_type = "pickup",
        delivery_address,
        notes,
        items,
        promo_code,
        accepted_agreement_ids,
      } = req.body || {};

      if (!Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ error: "items_required", message: "Товары обязательны" });
      }

      // Соглашения: квик-валидация ДО основной транзакции (быстрый отказ
      // без лишней работы — стоковые проверки, lookup'ы и т.п.). Реальный
      // снимок и финальная проверка происходят ВНУТРИ db.transaction ниже,
      // под write-lock'ом — это закрывает race между чтением agreements
      // и INSERT в orders (admin не может в этот момент вставить новое
      // обязательное соглашение).
      const preliminaryAgreementsCheck = validateAcceptedAgreementIds(accepted_agreement_ids);
      if (!preliminaryAgreementsCheck.ok) {
        return res.status(400).json({
          error: "agreements_required",
          message: "Подтвердите согласие для оформления заказа",
          missing: preliminaryAgreementsCheck.missing,
        });
      }

      const verifiedTelegramUsername = await resolveVerifiedOrderUsername(
        req.telegramAuth,
        telegram_username,
      );

      if (!verifiedTelegramUsername) {
        return res.status(400).json({
          error: "telegram_username_required",
          message: "Укажите Telegram username",
        });
      }

      if (!/^[a-zA-Z0-9_]{5,32}$/.test(verifiedTelegramUsername)) {
        return res.status(400).json({
          error: "telegram_username_invalid",
          message: "Username должен содержать от 5 до 32 символов",
        });
      }

      const telegramId = String(req.telegramAuth?.telegramId || "").trim();
      const existingActiveOrder = findOwnedActiveOrder({
        telegramId,
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

      // Блокировка клиента — отказываем в новом заказе.
      // Сначала pending (превентивный бан по @username, клиент ещё не в БД),
      // потом активный блок по telegram_id (если клиент уже есть).
      //
      // Важно: эта проверка идёт ПОСЛЕ existingActiveOrder. Это намеренно —
      // согласно ТЗ активные заказы заблокированного клиента должны выдаваться
      // как обычно. Если у заблокированного есть активный заказ, он получит
      // 409 active_order_exists вместо 403 customer_blocked — экран блокировки
      // он всё равно увидит при следующем входе через /check-blocks (он же
      // вызывается в App.vue:onMounted).
      const pendingBan = getPendingBanForUsername(verifiedTelegramUsername);
      if (pendingBan) {
        return res.status(403).json({
          error: "customer_blocked",
          block: serializeBlock(pendingBan, "pending"),
        });
      }
      const activeBlock = getActiveBlockForTelegramId(telegramId);
      if (activeBlock) {
        return res.status(403).json({
          error: "customer_blocked",
          block: serializeBlock(activeBlock, "active"),
        });
      }

      const wholesaleContext = resolveWholesaleContextOrSendError(req, res);
      if (!wholesaleContext && res.headersSent) {
        return;
      }

      if (delivery_type === "delivery") {
        if (!phone || !phone.trim()) {
          return res.status(400).json({
            error: "phone_required",
            message: "Укажите телефон для доставки",
          });
        }
        if (!delivery_address || !delivery_address.trim()) {
          return res.status(400).json({
            error: "address_required",
            message: "Укажите адрес доставки",
          });
        }
      }

      const tx = db.transaction(() => {
        // Финальная проверка соглашений: повторяем под write-lock на случай,
        // если между preliminary-проверкой выше и стартом транзакции admin
        // активировал новое обязательное соглашение. Возвращаем sentinel
        // вместо throw — наружный код увидит violation и вернёт 400 без 500.
        const finalAgreementsCheck = validateAcceptedAgreementIds(accepted_agreement_ids);
        if (!finalAgreementsCheck.ok) {
          return { agreementsViolation: finalAgreementsCheck.missing };
        }
        const acceptedAgreementsSnapshot = buildAcceptedSnapshot(accepted_agreement_ids);

        const resolvedCustomerId = upsertPublicCustomer({
          telegramId,
          telegramUsername: verifiedTelegramUsername || null,
          firstName: req.telegramAuth?.firstName || first_name || null,
          lastName: req.telegramAuth?.lastName || last_name || null,
          phone: phone || null,
        });

        const createdOrderId = generateId("order");
        const createdOrderNumber = getNextNumber("orders", "order_number");
        const normalizedPromoCode = wholesaleContext
          ? null
          : normalizePromoCode(promo_code);

        const orderBuild = buildPublicOrderItems({
          items,
          customerId: resolvedCustomerId,
          promoCodeText: normalizedPromoCode,
          wholesaleContext,
        });

        if (delivery_type === "delivery") {
          const minDeliveryError = ensureMinDeliveryAmountSatisfied(orderBuild.totalAmount);
          if (minDeliveryError) {
            const error = new Error(minDeliveryError.message);
            error.code = minDeliveryError.error;
            error.payload = minDeliveryError;
            throw error;
          }
        }

        const wholesaleMinError = validateWholesaleMinimum(
          orderBuild.totalAmount,
          wholesaleContext,
        );
        if (wholesaleMinError) {
          const error = new Error(wholesaleMinError.message);
          error.code = wholesaleMinError.error;
          error.payload = wholesaleMinError;
          throw error;
        }

        let createdPromoDiscount = 0;
        let createdPromoCodeId = null;
        let createdPromoResult = null;
        if (normalizedPromoCode) {
          createdPromoResult = validatePromoCodeForOrder(
            normalizedPromoCode,
            orderBuild.totalAmount,
          );
          if (!createdPromoResult.valid) {
            throwPromoValidationError(createdPromoResult);
            throw new Error(
              createdPromoResult.message || "Недействительный промокод",
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
            promo_code_id, promo_code_text, is_wholesale, wholesale_tier_id, wholesale_tier_label, wholesale_min_amount,
            accepted_agreements
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?
          )
        `,
        ).run(
          createdOrderId,
          createdOrderNumber,
          resolvedCustomerId,
          "new",
          delivery_type,
          delivery_type === "delivery" ? delivery_address || null : null,
          orderBuild.totalAmount,
          createdPromoDiscount,
          0,
          createdFinalAmount,
          createdProfit,
          notes || null,
          delivery_type === "delivery" ? phone || null : null,
          verifiedTelegramUsername || null,
          createdPromoCodeId,
          normalizedPromoCode,
          wholesaleContext ? 1 : 0,
          wholesaleContext?.tier?.id || null,
          wholesaleContext?.tier?.label || null,
          wholesaleContext?.tier
            ? Number(wholesaleContext.tier.minOrderAmount || 0)
            : null,
          acceptedAgreementsSnapshot,
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

        if (!wholesaleContext) {
          applyOrderLoyaltyReservations({
            customerId: resolvedCustomerId,
            orderId: createdOrderId,
            application: orderBuild.application,
          });
        }

        if (!wholesaleContext && createdPromoCodeId && createdPromoResult) {
          reservePromoUsageForOrder({
            promoCodeId: createdPromoCodeId,
            orderId: createdOrderId,
            customerId: resolvedCustomerId || null,
            discountApplied: createdPromoDiscount,
            idFactory: () => generateId("pu"),
          });
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
      });

      const created = tx();
      // Sentinel из транзакции: если активировалось новое соглашение между
      // preliminary-проверкой и началом tx — возвращаем 400 с актуальным
      // missing[].
      if (created?.agreementsViolation) {
        return res.status(400).json({
          error: "agreements_required",
          message: "Подтвердите согласие для оформления заказа",
          missing: created.agreementsViolation,
        });
      }
      return res.json({
        success: true,
        order_id: created.orderId,
        order_number: created.orderNumber,
      });
    } catch (error) {
      const errorCode = String(error.code || error.message || "");
      if (error.payload?.error === "min_delivery_amount_not_met") {
        return res.status(400).json(error.payload);
      }
      if (error.payload?.error === "wholesale_min_not_met") {
        return res.status(400).json(error.payload);
      }
      if (
        errorCode === "telegram_username_required" ||
        errorCode === "telegram_username_not_verified" ||
        errorCode === "promo_and_loyalty_conflict" ||
        errorCode === "loyalty_category_not_available" ||
        errorCode === "loyalty_balance_not_enough" ||
        errorCode === "loyalty_category_limit_exceeded" ||
        errorCode === "wholesale_price_unavailable"
      ) {
        return res.status(400).json({
          error: errorCode,
          message: error.userMessage || error.message || errorCode,
        });
      }
      console.error("[public] Create order error:", error);
      return res.status(500).json({
        error: "create_failed",
        message: error.message || "Не удалось создать заказ",
      });
    }
  },
);



// Validate promo code (public endpoint)
publicRouter.post("/api/promo/validate", (req, res) => {
  try {
    const { code, order_amount = 0, order_id, editing_order_id } = req.body;
    const result = validatePromoCodeForOrder(code, Number(order_amount), {
      excludeOrderId:
        typeof editing_order_id === "string" && editing_order_id.trim()
          ? editing_order_id.trim()
          : typeof order_id === "string" && order_id.trim()
            ? order_id.trim()
            : null,
    });

    if (result.valid) {
      res.json({
        valid: true,
        discount_type: result.discount_type,
        discount_value: result.discount_value,
        calculated_discount: result.calculated_discount,
        description: result.description,
        customer_description: result.customer_description,
        manager_description: result.manager_description,
        has_gift: result.has_gift,
        valid_from_date: result.valid_from_date,
        duration_days: result.duration_days,
        effective_valid_until_date: result.effective_valid_until_date,
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

    // Активация превентивных банов: если @username клиента сменился и
    // именно по новому username админ повесил pending — переносим в активный блок.
    activatePendingBansForCustomer({
      id: existing.id,
      telegram_username: telegramUsername || existing.telegram_username,
    });
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

  // Свежесозданный клиент: проверяем есть ли pending-бан по его @username
  // (превентивный бан, оформленный админом до первого визита). Если есть —
  // переносим в customer_blocks с реальным customer_id.
  activatePendingBansForCustomer({
    id: customerId,
    telegram_username: telegramUsername,
  });

  return customerId;
}

function buildPublicOrderItems({
  items,
  customerId = null,
  promoCodeText = null,
  existingOrderId = null,
  wholesaleContext = null,
}) {
  let totalAmount = 0;
  let totalCost = 0;

  const preparedItems = items.map((item) => {
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

    let pricePerUnit =
      variantData?.price_rub ?? product.priceRub ?? item.price_per_unit ?? 0;

    if (wholesaleContext?.tier) {
      const wholesalePrice = getWholesaleUnitPriceForProduct(
        product,
        wholesaleContext.tier.id,
      );
      if (!Number.isFinite(Number(wholesalePrice)) || Number(wholesalePrice) <= 0) {
        const error = new Error(`Оптовая цена не найдена для товара: ${product.title}`);
        error.code = "wholesale_price_unavailable";
        throw error;
      }
      pricePerUnit = Number(wholesalePrice);
    }

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
        : product.title || "Без названия",
      group_name: groupName,
      base_product_title:
        item.product_title || product.title || "Без названия",
      base_product_id: item.product_id,
      variant_name: item.variant_name || null,
      quantity,
      price_per_unit: Number(pricePerUnit),
      cost_per_unit: costPerUnit,
      manual_discount_amount: 0,
      loyalty_units_applied: Number(item.loyalty_units_applied || 0),
    };
  });

  if (wholesaleContext?.tier) {
    const finalizedItems = preparedItems.map((item) => ({
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
      manual_discount_amount: 0,
      loyalty_discount_amount: 0,
      loyalty_units_applied: 0,
      discount_amount: 0,
      total_price: Number(item.price_per_unit || 0) * Number(item.quantity || 0),
      total_cost: Number(item.cost_per_unit || 0) * Number(item.quantity || 0),
    }));

    return {
      items: finalizedItems,
      totalAmount,
      totalCost,
      totalLoyaltyDiscount: 0,
      application: {
        items: finalizedItems,
        total_loyalty_discount: 0,
      },
    };
  }

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
