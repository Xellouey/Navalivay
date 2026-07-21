import express from "express";
import { db } from "../db.js";
import { authMiddleware } from "../auth.js";
import { archiveOldDeliveredOrders } from "../cleanup-delivered-orders.js";
import {
  getBusinessPeriodRange,
  toSqliteUtcString,
} from "../utils/business-time.js";
import {
  applyOrderLoyaltyReservations,
  awardLoyaltyForOrder,
  buildLoyaltyApplication,
  releaseOrderLoyaltyReservations,
} from "../loyalty.js";
import { accrueWheelSpinsForOrder } from "../wheel/wheel-service.js";
import {
  consumePromoUsageForOrder,
  releasePromoUsageForOrder,
  reservePromoUsageForOrder,
} from "../promo-code-service.js";
import {
  autoNotifyForStatusChange,
  autoNotifyOrderAcceptedAfterRecipientWarmup,
} from "../utils/auto-notify.js";
import { buildCrmOrderPollSummary } from "../utils/crm-order-polling.js";
import { buildCrmOrdersSearch } from "../utils/crm-order-search.js";
import {
  describeAutoNotifyReason,
  enrichOrdersWithRelations,
} from "../utils/crm-order-enrichment.js";
import {
  buildKanbanBoardSync,
  fetchEnrichedOrdersByIds,
  fetchKanbanBoardOrders,
} from "../utils/crm-kanban-board.js";
import { buildTotalControlGroups } from "../utils/total-control-groups.js";
import { syncGroupParking } from "../utils/group-parking.js";
import { attachFirstOrderToReferral } from "../utils/referral-authorization.js";

export const crmOperationsRouter = express.Router();

crmOperationsRouter.get(
  "/api/admin/crm/total-control-groups",
  authMiddleware,
  (_req, res) => {
    try {
      res.json({ items: buildTotalControlGroups(db) });
    } catch (error) {
      console.error("[crm] Get total control groups error:", error);
      res.status(500).json({ error: "total_control_groups_failed" });
    }
  },
);

// Helper для генерации ID
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Helper для получения следующего номера
function getNextNumber(table, field) {
  const row = db.prepare(`SELECT MAX(${field}) as maxNum FROM ${table}`).get();
  return (row?.maxNum || 0) + 1;
}

function recordStatusChange(orderId, previousStatus, newStatus, note) {
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
    console.warn("[crm] Failed to record status history:", error.message);
  }
}

function getProductTotalStock(productId) {
  const product = db
    .prepare("SELECT stock, warehouse_stock, has_variants FROM products WHERE id = ?")
    .get(productId);
  if (!product) return 0;
  return Number(product.has_variants || 0) === 1
    ? Number(db.prepare(`
        SELECT COALESCE(SUM(stock + warehouse_stock), 0) AS total
        FROM product_variants
        WHERE product_id = ?
      `).get(productId)?.total || 0)
    : Number(product.stock || 0) + Number(product.warehouse_stock || 0);
}

function syncGroupsForProducts(productIds) {
  const ids = Array.from(new Set(productIds.filter(Boolean).map(String)));
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  const groups = db.prepare(`
    SELECT DISTINCT groupId
    FROM products
    WHERE id IN (${placeholders}) AND groupId IS NOT NULL
  `).all(...ids);
  for (const row of groups) {
    try {
      syncGroupParking(row.groupId);
    } catch (error) {
      console.error("[crm] Procurement group parking sync failed:", error);
    }
  }
}

// Helper для расчета средней себестоимости (метод CloudShop)
function calculateAverageCost(productId, newQuantity, newCostPerUnit) {
  const product = db
    .prepare("SELECT cost_price FROM products WHERE id = ?")
    .get(productId);

  if (!product) return newCostPerUnit;

  const currentStock = getProductTotalStock(productId);
  const currentCost = product.cost_price || 0;

  if (currentStock === 0) {
    return newCostPerUnit;
  }

  const totalCost = currentStock * currentCost + newQuantity * newCostPerUnit;
  const totalQuantity = currentStock + newQuantity;

  return totalCost / totalQuantity;
}

function applyDiscounts(totalAmount, discountAmount, discountPercent) {
  let finalAmount = Number(totalAmount || 0) - Number(discountAmount || 0);
  if (finalAmount < 0) {
    finalAmount = 0;
  }

  const percent = Number(discountPercent || 0);
  if (percent > 0) {
    finalAmount = finalAmount * (1 - percent / 100);
  }

  return finalAmount < 0 ? 0 : finalAmount;
}

function buildAdminOrderItemsWithLoyalty({
  items,
  customerId = null,
  promoCodeText = null,
}) {
  let totalAmount = 0;
  let totalCost = 0;

  const preparedItems = items.map((item) => {
    if (!item || !item.product_id) {
      throw new Error("invalid_item");
    }

    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(item.product_id);
    if (!product) {
      throw new Error(`Product not found: ${item.product_id}`);
    }

    const quantity = Math.max(1, Math.round(Number(item.quantity || 0)));
    const manualDiscountAmount = Math.max(
      0,
      Number(item.manual_discount_amount ?? item.discount_amount ?? 0),
    );

    let variantData = null;
    if (item.variant_id) {
      variantData = db
        .prepare("SELECT * FROM product_variants WHERE id = ?")
        .get(item.variant_id);
      if (!variantData) {
        throw new Error(`Variant not found: ${item.variant_id}`);
      }
    }

    const pricePerUnit = Number(
      item.price_per_unit !== undefined
        ? item.price_per_unit
        : variantData?.price_rub ?? product.priceRub,
    );
    const costPerUnit = Number(product.cost_price || 0);

    totalAmount += pricePerUnit * quantity;
    totalCost += costPerUnit * quantity;

    let groupName = item.group_name || null;
    if (!groupName && product.groupId) {
      groupName =
        db.prepare("SELECT name FROM category_groups WHERE id = ?").get(product.groupId)
          ?.name || null;
    }

    let variantName = item.variant_name || null;
    if (item.variant_id && !variantName) {
      variantName = variantData?.name || null;
    }

    const baseProductTitle =
      item.base_product_title || product.title || "Без названия";
    const productTitle = variantName
      ? `${baseProductTitle} - ${variantName}`
      : item.product_title || product.title || "Без названия";

    return {
      id: item.id || generateId("oi"),
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      product_title: productTitle,
      group_name: groupName,
      base_product_id: item.base_product_id || item.product_id || null,
      base_product_title: baseProductTitle,
      variant_name: variantName,
      quantity,
      price_per_unit: pricePerUnit,
      cost_per_unit: costPerUnit,
      manual_discount_amount: manualDiscountAmount,
      loyalty_units_applied: Number(item.loyalty_units_applied || 0),
    };
  });

  const application = buildLoyaltyApplication({
    customerId,
    items: preparedItems,
    promoCodeText,
  });

  return {
    items: application.items.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      product_title: item.product_title,
      group_name: item.group_name || null,
      base_product_id: item.base_product_id || null,
      base_product_title: item.base_product_title || null,
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
    })),
    totalAmount,
    totalCost,
    totalLoyaltyDiscount: Number(application.total_loyalty_discount || 0),
    application,
  };
}

// =========================
// ORDERS (Заказы)
// =========================
crmOperationsRouter.get("/api/admin/crm/orders/poll-summary", authMiddleware, (req, res) => {
  try {
    const summary = buildCrmOrderPollSummary({ db });
    res.json(summary);
  } catch (error) {
    console.error("[crm] Get orders poll summary error:", error);
    res.status(500).json({ error: "failed", message: error.message });
  }
});

// Канбан: только релевантные заказы (без delivered/completed), полный payload для карточек.
crmOperationsRouter.get("/api/admin/crm/orders/board", authMiddleware, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 200);
    const orders = fetchKanbanBoardOrders({ db, limit });
    res.json({
      orders,
      pagination: {
        page: 1,
        limit,
        total: orders.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    console.error("[crm] Get kanban board orders error:", error);
    res.status(500).json({ error: "failed", message: error.message });
  }
});

// Инкрементальная синхронизация канбана после poll-summary (только изменённые id).
crmOperationsRouter.get("/api/admin/crm/orders/board-sync", authMiddleware, (req, res) => {
  try {
    const since = req.query.since ? String(req.query.since).trim() : null;
    const sync = buildKanbanBoardSync({ db, since: since || null });
    const orders = fetchEnrichedOrdersByIds({ db, orderIds: sync.changedOrderIds });
    res.json({
      ...sync,
      orders,
    });
  } catch (error) {
    console.error("[crm] Get kanban board sync error:", error);
    res.status(500).json({ error: "failed", message: error.message });
  }
});

crmOperationsRouter.get("/api/admin/crm/orders", authMiddleware, (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    const whereClauses = [];
    const params = [];

    if (status) {
      whereClauses.push("o.status = ?");
      params.push(status);
    }

    // Показываем только неархивные заказы
    whereClauses.push("o.archived = 0");

    let orderByClause = "o.created_at DESC";
    let orderByParams = [];

    if (search) {
      const searchTerm = String(search).trim();
      if (searchTerm) {
        const searchSpec = buildCrmOrdersSearch({ searchTerm });
        whereClauses.push(searchSpec.whereClause);
        params.push(...searchSpec.params);
        orderByClause = searchSpec.orderBy;
        orderByParams = searchSpec.orderByParams;
      }
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countSql = `SELECT COUNT(*) as count FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ${whereClause}`;
    const total = db.prepare(countSql).get(...params).count;

    const ordersSql = `
      SELECT
        o.*,
        COALESCE(o.telegram_username, c.telegram_username) as telegram_username,
        c.first_name || ' ' || COALESCE(c.last_name, '') as customer_name,
        c.telegram_id as customer_telegram_id,
        COALESCE(pc.has_gift, 0) as promo_has_gift,
        pc.manager_description as promo_manager_description,
        pc.customer_description as promo_customer_description,
        CASE WHEN ue.access_hash IS NOT NULL THEN 1 ELSE 0 END as has_userbot_access
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN promo_codes pc ON pc.id = o.promo_code_id
      LEFT JOIN userbot_entities ue ON ue.telegram_id = c.telegram_id
      ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT ? OFFSET ?
    `;

    const orders = db
      .prepare(ordersSql)
      .all(...params, ...orderByParams, parseInt(limit), offset);

    const ordersWithItems = enrichOrdersWithRelations(db, orders);

    res.json({
      orders: ordersWithItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[crm] Get orders error:", error);
    res.status(500).json({ error: "failed", message: error.message });
  }
});

// Архивные заказы
crmOperationsRouter.get(
  "/api/admin/crm/orders/archived",
  authMiddleware,
  (req, res) => {
    try {
      const { status, page = 1, limit = 20, search } = req.query;

      const whereClauses = ["o.archived = 1"];
      const params = [];

      if (status) {
        whereClauses.push("o.status = ?");
        params.push(status);
      }

      if (search) {
        const searchTerm = String(search).trim();
        if (searchTerm) {
          whereClauses.push(
            "(CAST(o.order_number AS TEXT) LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.telegram_username LIKE ? OR o.telegram_username LIKE ?)",
          );
          const likePattern = `%${searchTerm}%`;
          params.push(
            likePattern,
            likePattern,
            likePattern,
            likePattern,
            likePattern,
          );
        }
      }

      const whereClause =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const countSql = `SELECT COUNT(*) as count FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ${whereClause}`;
      const total =
        params.length > 0
          ? db.prepare(countSql).get(...params).count
          : db
              .prepare(
                `SELECT COUNT(*) as count FROM orders o WHERE o.archived = 1`,
              )
              .get().count;

      const ordersSql = `
      SELECT 
        o.*,
        COALESCE(o.telegram_username, c.telegram_username) as telegram_username,
        c.first_name || ' ' || COALESCE(c.last_name, '') as customer_name,
        COALESCE(pc.has_gift, 0) as promo_has_gift,
        pc.manager_description as promo_manager_description,
        pc.customer_description as promo_customer_description
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN promo_codes pc ON pc.id = o.promo_code_id
      ${whereClause}
      ORDER BY o.completed_at DESC, o.created_at DESC
      LIMIT ? OFFSET ?
    `;

      const orders =
        params.length > 0
          ? db.prepare(ordersSql).all(...params, parseInt(limit), offset)
          : db
              .prepare(
                `
          SELECT 
            o.*,
            COALESCE(o.telegram_username, c.telegram_username) as telegram_username,
            c.first_name || ' ' || COALESCE(c.last_name, '') as customer_name,
            COALESCE(pc.has_gift, 0) as promo_has_gift,
            pc.manager_description as promo_manager_description,
            pc.customer_description as promo_customer_description
          FROM orders o
          LEFT JOIN customers c ON c.id = o.customer_id
          LEFT JOIN promo_codes pc ON pc.id = o.promo_code_id
          WHERE o.archived = 1
          ORDER BY o.completed_at DESC, o.created_at DESC
          LIMIT ? OFFSET ?
        `,
              )
              .all(parseInt(limit), offset);

      let ordersWithItems = orders;
      if (orders.length > 0) {
        const orderIds = orders.map((order) => order.id);
        const placeholders = orderIds.map(() => "?").join(",");
        const itemsRows = db
          .prepare(
            `
        SELECT oi.*, p.description as product_description 
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id IN (${placeholders})
      `,
          )
          .all(...orderIds);

        const itemsByOrder = itemsRows.reduce((acc, item) => {
          const list = acc.get(item.order_id) || [];
          list.push(item);
          acc.set(item.order_id, list);
          return acc;
        }, new Map());

        ordersWithItems = orders.map((order) => ({
          ...order,
          items: itemsByOrder.get(order.id) || [],
        }));
      }

      res.json({
        orders: ordersWithItems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error("[crm] Get archived orders error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Доставленные заказы (включая архивные) - MUST be before /orders/:id
crmOperationsRouter.get(
  "/api/admin/crm/orders/delivered",
  authMiddleware,
  (req, res) => {
    try {
      const { page = 1, limit = 100, search, period = "all" } = req.query;

      const whereClauses = ["o.status IN ('delivered','completed')"];
      const params = [];

      // Серверная фильтрация по периоду
      if (period === "today") {
        const { start, end } = getBusinessPeriodRange("today");
        whereClauses.push(
          "datetime(COALESCE(o.completed_at, o.paid_at, o.updated_at, o.created_at)) >= ? AND datetime(COALESCE(o.completed_at, o.paid_at, o.updated_at, o.created_at)) < ?",
        );
        params.push(toSqliteUtcString(start), toSqliteUtcString(end));
      } else if (period === "week") {
        whereClauses.push("COALESCE(o.completed_at, o.paid_at, o.updated_at, o.created_at) >= DATETIME('now', '-7 days')");
      } else if (period === "month") {
        whereClauses.push("COALESCE(o.completed_at, o.paid_at, o.updated_at, o.created_at) >= DATETIME('now', '-30 days')");
      }

      if (search) {
        const searchTerm = String(search).trim();
        if (searchTerm) {
          whereClauses.push(
            "(CAST(o.order_number AS TEXT) LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.telegram_username LIKE ? OR o.telegram_username LIKE ?)",
          );
          const likePattern = `%${searchTerm}%`;
          params.push(likePattern, likePattern, likePattern, likePattern, likePattern);
        }
      }

      const whereClause = `WHERE ${whereClauses.join(" AND ")}`;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const countSql = `SELECT COUNT(*) as count FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ${whereClause}`;
      const total = db.prepare(countSql).get(...params).count;

      const ordersSql = `
        SELECT
          o.*,
          COALESCE(o.telegram_username, c.telegram_username) as telegram_username,
          c.first_name || ' ' || COALESCE(c.last_name, '') as customer_name,
          COALESCE(pc.has_gift, 0) as promo_has_gift,
          pc.manager_description as promo_manager_description,
          pc.customer_description as promo_customer_description
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        LEFT JOIN promo_codes pc ON pc.id = o.promo_code_id
        ${whereClause}
        ORDER BY COALESCE(o.completed_at, o.paid_at, o.updated_at, o.created_at) DESC
        LIMIT ? OFFSET ?
      `;

      const orders = db.prepare(ordersSql).all(...params, parseInt(limit), offset);

      // Считаем статистику по ВСЕМ заказам периода (не только по странице)
      const statsSql = `
        SELECT
          COUNT(*) as totalCount,
          COALESCE(SUM(CASE WHEN o.discount_amount > 0 THEN o.total_amount - o.discount_amount ELSE o.total_amount END), 0) as totalAmount,
          SUM(CASE WHEN o.delivery_type = 'delivery' THEN 1 ELSE 0 END) as deliveryCount,
          COALESCE(SUM(CASE WHEN o.delivery_type = 'delivery' THEN (CASE WHEN o.discount_amount > 0 THEN o.total_amount - o.discount_amount ELSE o.total_amount END) ELSE 0 END), 0) as deliveryAmount,
          SUM(CASE WHEN o.delivery_type = 'pickup' OR o.delivery_type IS NULL THEN 1 ELSE 0 END) as pickupCount,
          COALESCE(SUM(CASE WHEN o.delivery_type = 'pickup' OR o.delivery_type IS NULL THEN (CASE WHEN o.discount_amount > 0 THEN o.total_amount - o.discount_amount ELSE o.total_amount END) ELSE 0 END), 0) as pickupAmount
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        ${whereClause}
      `;
      const stats = db.prepare(statsSql).get(...params);

      let ordersWithItems = orders;
      if (orders.length > 0) {
        const orderIds = orders.map((order) => order.id);
        const placeholders = orderIds.map(() => "?").join(",");
        const itemsRows = db
          .prepare(
            `SELECT oi.*, p.description as product_description
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id IN (${placeholders})`,
          )
          .all(...orderIds);

        const itemsByOrder = itemsRows.reduce((acc, item) => {
          const list = acc.get(item.order_id) || [];
          list.push(item);
          acc.set(item.order_id, list);
          return acc;
        }, new Map());

        ordersWithItems = orders.map((order) => ({
          ...order,
          items: itemsByOrder.get(order.id) || [],
        }));
      }

      res.json({
        orders: ordersWithItems,
        stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error("[crm] Fetch delivered orders error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

crmOperationsRouter.get(
  "/api/admin/crm/orders/:id",
  authMiddleware,
  (req, res) => {
    try {
      const { id } = req.params;

      const order = db
        .prepare(
          `
      SELECT 
        o.*,
        COALESCE(o.telegram_username, c.telegram_username) as telegram_username,
        c.first_name,
        c.last_name,
        c.phone,
        COALESCE(pc.has_gift, 0) as promo_has_gift,
        pc.manager_description as promo_manager_description,
        pc.customer_description as promo_customer_description
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN promo_codes pc ON pc.id = o.promo_code_id
      WHERE o.id = ?
    `,
        )
        .get(id);

      if (!order) {
        return res.status(404).json({ error: "not_found" });
      }

      const items = db
        .prepare(
          `
      SELECT oi.*, p.description as product_description 
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `,
        )
        .all(id);

      res.json({ ...order, items });
    } catch (error) {
      console.error("[crm] Get order error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Создание заказа (свободная продажа или из корзины)
crmOperationsRouter.post(
  "/api/admin/crm/orders",
  authMiddleware,
  (req, res) => {
    try {
      const {
        customer_id,
        delivery_type = "pickup",
        delivery_address,
        items,
        discount_amount = 0,
        discount_percent = 0,
        notes,
      } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items_required" });
      }

      const orderId = generateId("order");
      const orderNumber = getNextNumber("orders", "order_number");

      // Рассчитываем суммы
      let totalAmount = 0;
      let totalCost = 0;
      let itemsSubtotal = 0;

      let orderItems = items.map((item) => {
        const product = db
          .prepare("SELECT * FROM products WHERE id = ?")
          .get(item.product_id);
        if (!product) {
          throw new Error(`Product not found: ${item.product_id}`);
        }

        // Проверяем наличие на складе и получаем данные варианта
        // Для вариантов - проверяем сток варианта, для обычных товаров - сток продукта
        let variantData = null;
        if (item.variant_id) {
          variantData = db
            .prepare("SELECT * FROM product_variants WHERE id = ?")
            .get(item.variant_id);
          if (!variantData) {
            throw new Error(`Variant not found: ${item.variant_id}`);
          }
          if (variantData.stock < item.quantity) {
            throw new Error(
              `Insufficient stock for variant ${item.variant_id}`,
            );
          }
        } else if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.title}`);
        }

        // Для товаров с вариантами: base_product = сам product, variant_name = имя варианта
        let baseProductId = null;
        let baseProductTitle = null;
        let variantName = null;

        if (item.variant_id && variantData) {
          // variant_id указан — product_id это базовый продукт
          baseProductId = item.product_id;
          baseProductTitle = product.title || "Без названия";
          variantName = variantData.name || null;
        }

        const pricePerUnit = item.price_per_unit || product.priceRub;
        const costPerUnit = product.cost_price || 0;
        const itemDiscount = item.discount_amount || 0;
        const totalPrice = pricePerUnit * item.quantity - itemDiscount;
        const totalItemCost = costPerUnit * item.quantity;

        totalAmount += pricePerUnit * item.quantity;
        itemsSubtotal += totalPrice;
        totalCost += totalItemCost;

        // Получаем group_name для отображения линейки
        let groupName = null;
        if (product.groupId) {
          const group = db
            .prepare("SELECT name FROM category_groups WHERE id = ?")
            .get(product.groupId);
          if (group) {
            groupName = group.name;
          }
        }

        // product_title включает имя варианта (цвет) для корректного отображения
        const productTitle = variantName
          ? `${product.title} - ${variantName}`
          : product.title || "Без названия";

        return {
          id: generateId("oi"),
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          product_title: productTitle,
          variant_name: variantName,
          group_name: groupName,
          base_product_id: baseProductId,
          base_product_title: baseProductTitle,
          quantity: item.quantity,
          price_per_unit: pricePerUnit,
          cost_per_unit: costPerUnit,
          discount_amount: itemDiscount,
          total_price: totalPrice,
          total_cost: totalItemCost,
        };
      });

      // Применяем скидки
      const orderBuild = buildAdminOrderItemsWithLoyalty({
        items,
        customerId: customer_id || null,
      });
      orderItems = orderBuild.items;
      totalAmount = Number(orderBuild.totalAmount || 0);
      totalCost = Number(orderBuild.totalCost || 0);
      itemsSubtotal = orderItems.reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0,
      );

      const finalAmount = applyDiscounts(
        itemsSubtotal,
        discount_amount,
        discount_percent,
      );
      const profit = finalAmount - totalCost;

      // Создаем заказ в транзакции
      const tx = db.transaction(() => {
        // Вставляем заказ
        db.prepare(
          `
        INSERT INTO orders (
          id, order_number, customer_id, status, delivery_type, delivery_address,
          total_amount, discount_amount, discount_percent, final_amount, profit, notes
        ) VALUES (?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        ).run(
          orderId,
          orderNumber,
          customer_id || null,
          delivery_type,
          delivery_address || null,
          totalAmount,
          discount_amount,
          discount_percent,
          finalAmount,
          profit,
          notes || null,
        );

        attachFirstOrderToReferral(customer_id, orderId);

        // Вставляем позиции
        const itemStmt = db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, variant_id, product_title, group_name, base_product_id, base_product_title, variant_name, quantity,
          price_per_unit, cost_per_unit, manual_discount_amount, loyalty_discount_amount, loyalty_units_applied, discount_amount, total_price, total_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

        for (const item of orderItems) {
          itemStmt.run(
            item.id,
            orderId,
            item.product_id,
            item.variant_id,
            item.product_title,
            item.group_name,
            item.base_product_id,
            item.base_product_title,
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

          // ВАЖНО: НЕ списываем сток при создании заказа!
          // Сток списывается только при переходе в статус "Собран" (in_progress)
          // Это защита от абуза - конкуренты могут создавать фейковые заказы
        }

        // Обновляем статистику клиента
        applyOrderLoyaltyReservations({
          customerId: customer_id || null,
          orderId,
          application: orderBuild.application,
        });

        if (customer_id) {
          db.prepare(
            `
          UPDATE customers 
          SET total_orders = total_orders + 1,
              total_spent = total_spent + ?,
              last_order_at = DATETIME('now'),
              updated_at = DATETIME('now')
          WHERE id = ?
        `,
          ).run(finalAmount, customer_id);
        }

      });

      tx();

      const order = db
        .prepare("SELECT * FROM orders WHERE id = ?")
        .get(orderId);
      const items_result = db
        .prepare(`
          SELECT oi.*, p.description as product_description 
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `)
        .all(orderId);

      recordStatusChange(orderId, null, order.status, "Создан заказ");

      res.json({ ...order, items: items_result });

      if (customer_id) {
        setImmediate(() => {
          void autoNotifyOrderAcceptedAfterRecipientWarmup({ orderId }).catch((notifyErr) => {
            console.error("[crm] deferred order-accepted notify error:", notifyErr);
          });
        });
      }
    } catch (error) {
      console.error("[crm] Create order error:", error);
      const clientErrors = new Set([
        "items_required",
        "invalid_item",
        "invalid_item_quantity",
        "promo_and_loyalty_conflict",
        "loyalty_category_not_available",
        "loyalty_balance_not_enough",
        "loyalty_category_limit_exceeded",
      ]);
      const isClientError =
        clientErrors.has(error.message) ||
        error.message.startsWith("Insufficient stock") ||
        error.message.startsWith("Product not found") ||
        error.message.startsWith("Variant not found");
      if (isClientError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Обновление заказа (редактирование, статус)
crmOperationsRouter.patch(
  "/api/admin/crm/orders/:id",
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        status,
        delivery_address,
        notes,
        items,
        discount_amount,
        discount_percent,
        payment_type,
        payment_account_id,
        paid_amount,
        payment_notes,
        reactivate,
      } = req.body || {};

      if (
        payment_type !== undefined &&
        payment_type !== null &&
        payment_type !== "cash"
      ) {
        return res.status(400).json({ error: "invalid_payment_type" });
      }

      const allowedStatuses = [
        "new",
        "in_progress",
        "completed",
        "delivered",
        "cancelled",
      ];
      if (status !== undefined && !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "invalid_status" });
      }

      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
      if (!order) {
        return res.status(404).json({ error: "not_found" });
      }

      const shouldUpdateDiscount =
        discount_amount !== undefined || discount_percent !== undefined;
      const updatedDiscountAmount =
        discount_amount !== undefined
          ? Number(discount_amount)
          : Number(order.discount_amount || 0);
      const updatedDiscountPercent =
        discount_percent !== undefined
          ? Number(discount_percent)
          : Number(order.discount_percent || 0);

      let desiredStatus = order.status;
      if (reactivate && order.status === "cancelled") {
        desiredStatus = order.previous_status || "in_progress";
      }
      if (status !== undefined) {
        desiredStatus = status;
      }

      let statusChangeNote = null;
      const hasItemsPayload = Array.isArray(items);
      const workingStatuses = ["in_progress", "completed", "delivered"];

      // Захват «реального» статуса до транзакции для anti-double-notify (см.
      // ниже). Заполняется первой инструкцией внутри tx(), чтобы значение
      // отражало состояние БД на момент после получения write-лока, а не
      // снимок из строки 904 (он мог устареть, если параллельный PATCH
      // успел зафиксироваться).
      let statusAtTxStart = order.status;

      const tx = db.transaction(() => {
        // Перечитываем статус под write-лок'ом транзакции. better-sqlite3
        // в WAL-режиме выполняет db.transaction() как IMMEDIATE — write-лок
        // берётся при первой записи, но мы хотим дополнительно убедиться,
        // что дальнейшие проверки `order.status` соответствуют реальности
        // на момент старта транзакции. Это закрывает race window:
        //
        //   PATCH A:  SELECT order (status='new') ... begin tx ... commit
        //   PATCH B:  SELECT order (status='new', стейл!) ... begin tx (после A)
        //
        // Без этого re-read обе транзакции считали бы, что статус был 'new',
        // и обе вызывали бы auto-notify, отправляя клиенту дубль.
        const fresh = db
          .prepare(`SELECT status, stock_deducted, previous_status FROM orders WHERE id = ?`)
          .get(id);
        if (fresh) {
          statusAtTxStart = fresh.status;
        }

        const updateFields = [];
        const updateValues = [];

        if (delivery_address !== undefined) {
          updateFields.push("delivery_address = ?");
          updateValues.push(delivery_address || null);
        }
        if (notes !== undefined) {
          updateFields.push("notes = ?");
          updateValues.push(notes || null);
        }
        if (payment_type !== undefined) {
          updateFields.push("payment_type = ?");
          updateValues.push(payment_type || null);
        }
        if (payment_account_id !== undefined) {
          updateFields.push("payment_account_id = ?");
          updateValues.push(payment_account_id || null);
        }
        if (payment_notes !== undefined) {
          updateFields.push("payment_notes = ?");
          updateValues.push(payment_notes || null);
        }
        if (paid_amount !== undefined) {
          const parsedPaid = Number(paid_amount) || 0;
          if (parsedPaid < 0) {
            throw new Error("invalid_paid_amount");
          }
          if (parsedPaid === 0) {
            updateFields.push("paid_amount = NULL");
            updateFields.push("paid_at = NULL");
          } else {
            updateFields.push("paid_amount = ?");
            updateValues.push(parsedPaid);
            updateFields.push("paid_at = DATETIME('now')");
          }
        }

        if (reactivate || status !== undefined) {
          updateFields.push("status = ?");
          updateValues.push(desiredStatus);

          // СПИСАНИЕ СТОКА: При переходе в "рабочий" статус (in_progress, completed, delivered)
          // если сток еще не был списан
          if (
            workingStatuses.includes(desiredStatus) &&
            !order.stock_deducted &&
            !hasItemsPayload
          ) {
            const orderItems = db
              .prepare("SELECT * FROM order_items WHERE order_id = ?")
              .all(id);

            // Сначала проверяем достаточность стока
            for (const item of orderItems) {
              if (item.variant_id) {
                const variant = db
                  .prepare("SELECT stock FROM product_variants WHERE id = ?")
                  .get(item.variant_id);
                if (
                  variant &&
                  variant.stock !== null &&
                  variant.stock < item.quantity
                ) {
                  throw new Error(
                    `Недостаточно товара на складе: ${item.product_title || item.product_id}`,
                  );
                }
              } else if (item.product_id) {
                const product = db
                  .prepare("SELECT stock, title FROM products WHERE id = ?")
                  .get(item.product_id);
                if (
                  product &&
                  product.stock !== null &&
                  product.stock < item.quantity
                ) {
                  throw new Error(
                    `Недостаточно товара на складе: ${product.title || item.product_id}`,
                  );
                }
              }
            }

            // Теперь списываем сток
            for (const item of orderItems) {
              if (item.variant_id) {
                db.prepare(
                  "UPDATE product_variants SET stock = stock - ? WHERE id = ?",
                ).run(item.quantity, item.variant_id);
              } else if (item.product_id) {
                db.prepare(
                  "UPDATE products SET stock = stock - ? WHERE id = ?",
                ).run(item.quantity, item.product_id);
              }
            }
            updateFields.push("stock_deducted = 1");
          }

          if (
            !workingStatuses.includes(desiredStatus) &&
            order.stock_deducted &&
            desiredStatus !== "cancelled" &&
            !hasItemsPayload
          ) {
            const orderItems = db
              .prepare("SELECT * FROM order_items WHERE order_id = ?")
              .all(id);
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
            updateFields.push("stock_deducted = 0");
          }

          if (desiredStatus === "cancelled" && order.status !== "cancelled") {
            updateFields.push("previous_status = ?");
            updateValues.push(order.status);
            releaseOrderLoyaltyReservations(id);
            updateFields.push("cancelled_at = DATETIME('now')");
            statusChangeNote = "Заказ отменён";

            // ВОЗВРАТ СТОКА: При отмене заказа, если сток был списан
            if (order.stock_deducted && !hasItemsPayload) {
              const orderItems = db
                .prepare("SELECT * FROM order_items WHERE order_id = ?")
                .all(id);
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
              updateFields.push("stock_deducted = 0");
            }

            // ОТКАТ ПРОМОКОДА: При отмене заказа возвращаем использование промокода
            if (order.promo_code_id) {
              releasePromoUsageForOrder(id);
            }
          } else if (desiredStatus !== "cancelled") {
            updateFields.push("previous_status = NULL");
            updateFields.push("cancelled_at = NULL");
            if (order.status === "cancelled") {
              statusChangeNote = "Заказ восстановлен";
            }
          }

          if (["completed", "delivered"].includes(desiredStatus)) {
            updateFields.push("completed_at = DATETIME('now')");
          } else if (
            order.status === "completed" ||
            order.status === "delivered"
          ) {
            updateFields.push("completed_at = NULL");
          }
        }

        if (updateFields.length > 0) {
          updateFields.push("updated_at = DATETIME('now')");
          updateValues.push(id);
          db.prepare(
            `UPDATE orders SET ${updateFields.join(", ")} WHERE id = ?`,
          ).run(...updateValues);
        }

        if (Array.isArray(items)) {
          // Проверяем, изменились ли позиции (product_id, variant_id, quantity)
          // Если позиции не изменились, не нужно возвращать и списывать сток заново
          const oldItems = db
            .prepare("SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ? ORDER BY product_id, variant_id")
            .all(id);
          
          const newItemsSorted = [...items]
            .map((item) => ({
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              quantity: Number(item.quantity || 0),
            }))
            .sort((a, b) => {
              if (a.product_id !== b.product_id) return a.product_id.localeCompare(b.product_id);
              return (a.variant_id || '').localeCompare(b.variant_id || '');
            });
          
          const oldItemsSorted = oldItems
            .map((item) => ({
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              quantity: Number(item.quantity || 0),
            }))
            .sort((a, b) => {
              if (a.product_id !== b.product_id) return a.product_id.localeCompare(b.product_id);
              return (a.variant_id || '').localeCompare(b.variant_id || '');
            });
          
          const itemsChanged =
            newItemsSorted.length !== oldItemsSorted.length ||
            newItemsSorted.some((newItem, idx) => {
              const oldItem = oldItemsSorted[idx];
              return (
                !oldItem ||
                newItem.product_id !== oldItem.product_id ||
                newItem.variant_id !== oldItem.variant_id ||
                newItem.quantity !== oldItem.quantity
              );
            });
          
          // Возвращаем старый сток ТОЛЬКО если позиции изменились И сток был ранее списан
          // Сохраняем информацию о старых позициях для правильной проверки стока
          const oldItemsMap = new Map();
          const shouldRestoreDeductedStock =
            order.stock_deducted &&
            (itemsChanged || !workingStatuses.includes(desiredStatus));
          if (shouldRestoreDeductedStock) {
            for (const oldItem of oldItems) {
              // Сохраняем количество для каждого варианта/товара
              const key = oldItem.variant_id || oldItem.product_id;
              oldItemsMap.set(key, oldItem.quantity);
              
              if (oldItem.variant_id) {
                db.prepare(
                  "UPDATE product_variants SET stock = stock + ? WHERE id = ?",
                ).run(oldItem.quantity, oldItem.variant_id);
              } else if (oldItem.product_id) {
                db.prepare(
                  "UPDATE products SET stock = stock + ? WHERE id = ?",
                ).run(oldItem.quantity, oldItem.product_id);
              }
            }
          }

          releaseOrderLoyaltyReservations(id);
          const orderBuild = buildAdminOrderItemsWithLoyalty({
            items,
            customerId: order.customer_id || null,
            promoCodeText: order.promo_code_text || null,
          });
          const rebuiltItems = orderBuild.items;
          const shouldKeepExistingDeduction =
            workingStatuses.includes(desiredStatus) &&
            order.stock_deducted &&
            !itemsChanged;
          const shouldDeductUpdatedItems =
            workingStatuses.includes(desiredStatus) &&
            (!order.stock_deducted || itemsChanged);
          const nextStockDeducted =
            shouldKeepExistingDeduction || shouldDeductUpdatedItems ? 1 : 0;

          db.prepare("DELETE FROM order_items WHERE order_id = ?").run(id);

          let totalAmount = Number(orderBuild.totalAmount || 0);
          let totalCost = Number(orderBuild.totalCost || 0);
          let itemsSubtotal = 0;

          const itemStmt = db.prepare(`
          INSERT INTO order_items (
            id, order_id, product_id, variant_id, product_title, group_name, base_product_id, base_product_title, variant_name, quantity,
            price_per_unit, cost_per_unit, manual_discount_amount, loyalty_discount_amount, loyalty_units_applied, discount_amount, total_price, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

          for (const item of rebuiltItems) {
            if (!item || !item.product_id) {
              throw new Error("invalid_item");
            }

            const product = db
              .prepare("SELECT * FROM products WHERE id = ?")
              .get(item.product_id);
            if (!product) {
              throw new Error(`Product not found: ${item.product_id}`);
            }

            const quantity = Number(item.quantity || 0);
            if (!Number.isFinite(quantity) || quantity <= 0) {
              throw new Error("invalid_item_quantity");
            }

            const pricePerUnit = Number(
              item.price_per_unit !== undefined
                ? item.price_per_unit
                : product.priceRub,
            );
            const costPerUnit = Number(product.cost_price || 0);
            const itemDiscount = Number(item.discount_amount || 0);

            // Проверяем сток ТОЛЬКО если заказ уже был собран (stock_deducted = 1) И позиции изменились
            // Если stock_deducted = 0, сток не будет списываться, проверка не нужна
            // Если позиции не изменились, сток уже списан, проверка не нужна
            if (shouldDeductUpdatedItems) {
              if (item.variant_id) {
                const variant = db
                  .prepare("SELECT stock FROM product_variants WHERE id = ?")
                  .get(item.variant_id);
                if (!variant) {
                  throw new Error(`Variant not found: ${item.variant_id}`);
                }
                // Учитываем уже возвращенный сток из этого заказа
                const availableStock = Number(variant.stock || 0);
                if (availableStock < quantity) {
                  throw new Error(
                    `Insufficient stock for variant ${item.variant_id}`,
                  );
                }
              } else {
                // Учитываем уже возвращенный сток из этого заказа
                const availableStock = Number(product.stock || 0);
                if (availableStock < quantity) {
                  throw new Error(
                    `Insufficient stock for ${product.title || product.id}`,
                  );
                }
              }
            }

            const totalPrice = pricePerUnit * quantity - itemDiscount;
            const totalItemCost = costPerUnit * quantity;

            totalAmount += pricePerUnit * quantity;
            itemsSubtotal += totalPrice;
            totalCost += totalItemCost;

            let groupName = item.group_name || null;
            if (!groupName && product.groupId) {
              const group = db
                .prepare("SELECT name FROM category_groups WHERE id = ?")
                .get(product.groupId);
              if (group) {
                groupName = group.name;
              }
            }

            // Получаем variant_name из запроса или из БД, если variant_id есть
            let variantName = item.variant_name || null;
            if (item.variant_id && !variantName) {
              const variant = db
                .prepare("SELECT name FROM product_variants WHERE id = ?")
                .get(item.variant_id);
              if (variant) {
                variantName = variant.name;
              }
            }

            itemStmt.run(
              item.id || generateId("oi"),
              id,
              item.product_id,
              item.variant_id || null,
              product.title || "Без названия",
              item.group_name || groupName,
              item.base_product_id || null,
              item.base_product_title || null,
              item.variant_name || variantName,
              quantity,
              pricePerUnit,
              costPerUnit,
              Number(item.manual_discount_amount || 0),
              Number(item.loyalty_discount_amount || 0),
              Number(item.loyalty_units_applied || 0),
              itemDiscount,
              totalPrice,
              totalItemCost,
            );

            // Списываем сток ТОЛЬКО если заказ уже был собран (stock_deducted = 1) И позиции изменились
            // Если позиции не изменились, сток уже списан, не нужно списывать заново
            if (shouldDeductUpdatedItems) {
              if (item.variant_id) {
                db.prepare(
                  "UPDATE product_variants SET stock = stock - ? WHERE id = ?",
                ).run(quantity, item.variant_id);
              } else {
                db.prepare(
                  "UPDATE products SET stock = stock - ? WHERE id = ?",
                ).run(quantity, item.product_id);
              }
            }
          }

          applyOrderLoyaltyReservations({
            customerId: order.customer_id || null,
            orderId: id,
            application: orderBuild.application,
          });
          totalAmount = Number(orderBuild.totalAmount || 0);
          totalCost = Number(orderBuild.totalCost || 0);

          const finalAmount = applyDiscounts(
            itemsSubtotal,
            updatedDiscountAmount,
            updatedDiscountPercent,
          );
          const profit = finalAmount - totalCost;

          db.prepare(
            `
          UPDATE orders
          SET total_amount = ?, final_amount = ?, profit = ?,
              discount_amount = ?, discount_percent = ?, updated_at = DATETIME('now')
          WHERE id = ?
        `,
          ).run(
            totalAmount,
            finalAmount,
            profit,
            updatedDiscountAmount,
            updatedDiscountPercent,
            id,
          );
          db.prepare(
            `UPDATE orders SET stock_deducted = ?, updated_at = DATETIME('now') WHERE id = ?`,
          ).run(nextStockDeducted, id);
        } else if (shouldUpdateDiscount) {
          const totals = db
            .prepare(
              `
              SELECT 
                COALESCE(SUM(total_price), 0) as items_subtotal,
                COALESCE(SUM(total_cost), 0) as total_cost
              FROM order_items
              WHERE order_id = ?
            `,
            )
            .get(id);
          const itemsSubtotal = Number(totals?.items_subtotal || 0);
          const totalCost = Number(totals?.total_cost || 0);
          const finalAmount = applyDiscounts(
            itemsSubtotal,
            updatedDiscountAmount,
            updatedDiscountPercent,
          );
          const profit = finalAmount - totalCost;

          db.prepare(
            `
          UPDATE orders
          SET discount_amount = ?, discount_percent = ?, final_amount = ?, profit = ?, updated_at = DATETIME('now')
          WHERE id = ?
        `,
          ).run(
            updatedDiscountAmount,
            updatedDiscountPercent,
            finalAmount,
            profit,
            id,
          );
        }

        if (order.promo_code_id) {
          const updatedPromoOrder = db
            .prepare("SELECT discount_amount, completed_at FROM orders WHERE id = ?")
            .get(id);

          if (desiredStatus === "cancelled") {
            releasePromoUsageForOrder(id);
          } else if (["completed", "delivered"].includes(desiredStatus)) {
            consumePromoUsageForOrder({
              orderId: id,
              promoCodeId: order.promo_code_id,
              customerId: order.customer_id || null,
              discountApplied: Number(updatedPromoOrder?.discount_amount || 0),
              consumedAt: updatedPromoOrder?.completed_at || new Date().toISOString(),
              idFactory: () => generateId("pu"),
            });
          } else if (
            order.status === "cancelled" ||
            ["completed", "delivered"].includes(order.status)
          ) {
            reservePromoUsageForOrder({
              promoCodeId: order.promo_code_id,
              orderId: id,
              customerId: order.customer_id || null,
              discountApplied: Number(updatedPromoOrder?.discount_amount || 0),
              idFactory: () => generateId("pu"),
            });
          }
        }

        if (desiredStatus === "delivered") {
          awardLoyaltyForOrder(id);
          try {
            accrueWheelSpinsForOrder(id);
          } catch (wheelError) {
            console.error("[wheel] accrual on PATCH /orders/:id failed", wheelError);
          }
        } else if (desiredStatus === "completed") {
          // `completed` is a CRM-internal transitional state. Loyalty
          // historically also fired here for tier upgrades on
          // not-yet-issued orders, but wheel accrual must wait for the
          // physical `delivered` step (see docs/wheel-architecture.md
          // and S10 audit note).
          awardLoyaltyForOrder(id);
        }
      });

      tx();

      const updated = db
        .prepare(
          `
          SELECT
            o.*,
            COALESCE(o.telegram_username, c.telegram_username) as telegram_username,
            c.first_name,
            c.last_name,
            c.phone,
            COALESCE(pc.has_gift, 0) as promo_has_gift,
            pc.manager_description as promo_manager_description,
            pc.customer_description as promo_customer_description
          FROM orders o
          LEFT JOIN customers c ON c.id = o.customer_id
          LEFT JOIN promo_codes pc ON pc.id = o.promo_code_id
          WHERE o.id = ?
        `,
        )
        .get(id);
      const updatedItems = db
        .prepare(`
          SELECT oi.*, p.description as product_description 
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `)
        .all(id);

      // Используем statusAtTxStart (свежее SELECT под write-лок'ом транзакции),
      // а не order.status (снимок до tx). См. комментарий внутри tx().
      if (updated.status !== statusAtTxStart) {
        recordStatusChange(
          id,
          statusAtTxStart,
          updated.status,
          statusChangeNote || "Изменение статуса",
        );
      }

      // Авто-уведомление клиенту при смене статуса (Костя 8.05.2026: «нужно
      // нажали собрано → ему отослалось»). Любая ошибка отправки не должна
      // ломать PATCH — фронт показывает плашку по полю auto_notification.
      //
      // Anti-double-notify: сравниваем updated.status со statusAtTxStart
      // (статус под write-лок'ом транзакции), а не с order.status (снимок
      // ДО tx). Это гарантирует, что при двух параллельных PATCH одного
      // заказа auto-notify сработает только у того запроса, чей tx реально
      // выполнил переход. Второй увидит updated.status === statusAtTxStart
      // и пропустит отправку — клиенту не уйдёт дубль.
      //
      // Race window (acknowledged): tx() со сменой статуса уже зафиксирован
      // выше, recordStatusChange() — отдельная вставка после tx(). Если
      // процесс упадёт здесь, в БД может оказаться new статус без записи
      // в bot_message_log, а у клиента — отправленное сообщение Telegram
      // (или наоборот). Это допустимо: альтернатива (sendMessage внутри
      // транзакции SQLite) держала бы блокировку на сетевом таймауте, что
      // куда хуже. Менеджер видит факт отправки/skip в UI по плашке
      // saveSuccess сразу после ответа, может перезапустить через
      // /bot/send-custom если что-то не дошло.
      const statusChanged = updated.status !== statusAtTxStart;
      res.json({
        ...updated,
        items: updatedItems,
        auto_notification: statusChanged ? { pending: true } : null,
      });

      if (statusChanged) {
        setImmediate(() => {
          void autoNotifyForStatusChange({
            orderId: id,
            newStatus: updated.status,
            previousStatus: statusAtTxStart,
            reactivate: Boolean(reactivate),
          }).catch((notifyErr) => {
            console.error("[crm] deferred auto-notify error:", notifyErr);
          });
        });
      }
    } catch (error) {
      console.error("[crm] Update order error:", error);
      const clientErrors = new Set([
        "invalid_payment_type",
        "invalid_status",
        "invalid_paid_amount",
        "invalid_item",
        "invalid_item_quantity",
        "invalid_quantity",
        "invalid_cost",
        "items_required",
        "promo_and_loyalty_conflict",
        "loyalty_category_not_available",
        "loyalty_balance_not_enough",
        "loyalty_category_limit_exceeded",
      ]);

      // Проверяем клиентские ошибки (которые должны вернуть 400, а не 500)
      const isClientError =
        clientErrors.has(error.message) ||
        error.message.startsWith("Недостаточно товара") ||
        error.message.startsWith("Insufficient stock") ||
        error.message.startsWith("Product not found") ||
        error.message.startsWith("Variant not found");

      if (isClientError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// История статусов заказа (must be after /delivered to avoid route conflict)
crmOperationsRouter.get(
  "/api/admin/crm/orders/:id/history",
  authMiddleware,
  (req, res) => {
    try {
      const { id } = req.params;
      const history = db
        .prepare(
          `SELECT * FROM order_status_history WHERE order_id = ? ORDER BY changed_at DESC`,
        )
        .all(id);
      res.json(history);
    } catch (error) {
      console.error("[crm] Fetch order history error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Resolve manager action (менеджер подтвердил что увидел изменение/отмену)
crmOperationsRouter.post(
  "/api/admin/crm/orders/:id/resolve-action",
  authMiddleware,
  (req, res) => {
    try {
      const { id } = req.params;

      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
      if (!order) {
        return res.status(404).json({ error: "not_found" });
      }

      if (!order.needs_manager_action) {
        return res.status(400).json({ error: "no_action_required" });
      }

      const tx = db.transaction(() => {
        if (order.manager_action_type === "modified") {
          // Измененный заказ - возвращаем в "Новые" для пересборки
          // Если сток был списан (заказ был собран до изменения), возвращаем сток
          if (order.stock_deducted) {
            const orderItems = db
              .prepare("SELECT * FROM order_items WHERE order_id = ?")
              .all(id);
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

          db.prepare(
            `UPDATE orders SET
              needs_manager_action = 0,
              manager_action_resolved_at = DATETIME('now'),
              status = 'new',
              stock_deducted = 0,
              updated_at = DATETIME('now')
            WHERE id = ?`,
          ).run(id);

          recordStatusChange(id, order.status, "new", "Менеджер принял изменения, заказ на пересборку");
        } else if (order.manager_action_type === "cancelled_by_customer") {
          // Отмененный покупателем - просто сбрасываем флаг, заказ остается cancelled
          db.prepare(
            `UPDATE orders SET
              needs_manager_action = 0,
              manager_action_resolved_at = DATETIME('now'),
              updated_at = DATETIME('now')
            WHERE id = ?`,
          ).run(id);

          recordStatusChange(id, order.status, order.status, "Менеджер подтвердил отмену, заказ разобран");
        } else {
          // Неизвестный тип - просто сбрасываем флаг
          db.prepare(
            `UPDATE orders SET
              needs_manager_action = 0,
              manager_action_resolved_at = DATETIME('now'),
              updated_at = DATETIME('now')
            WHERE id = ?`,
          ).run(id);
        }
      });

      tx();

      const updated = db
        .prepare(
          `
          SELECT
            o.*,
            COALESCE(o.telegram_username, c.telegram_username) as telegram_username,
            c.first_name,
            c.last_name,
            c.phone,
            COALESCE(pc.has_gift, 0) as promo_has_gift,
            pc.manager_description as promo_manager_description,
            pc.customer_description as promo_customer_description
          FROM orders o
          LEFT JOIN customers c ON c.id = o.customer_id
          LEFT JOIN promo_codes pc ON pc.id = o.promo_code_id
          WHERE o.id = ?
        `,
        )
        .get(id);
      const updatedItems = db
        .prepare(`
          SELECT oi.*, p.description as product_description
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `)
        .all(id);

      const customerName = (() => {
        if (!updated.customer_id) return null;
        const c = db.prepare("SELECT first_name, last_name FROM customers WHERE id = ?").get(updated.customer_id);
        return c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : null;
      })();

      res.json({ ...updated, customer_name: customerName, items: updatedItems });
    } catch (error) {
      console.error("[crm] Resolve manager action error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Выдача заказа с фиксацией оплаты
crmOperationsRouter.post(
  "/api/admin/crm/orders/:id/issue",
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { payment_type, payment_account_id, amount, payment_notes } =
        req.body;

      if (!payment_type || payment_type !== "cash") {
        return res.status(400).json({ error: "invalid_payment_type" });
      }

      if (!payment_account_id) {
        return res.status(400).json({ error: "payment_account_required" });
      }

      const parsedAmount = Number(amount);
      if (!parsedAmount || parsedAmount <= 0) {
        return res.status(400).json({ error: "invalid_amount" });
      }

      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
      if (!order) {
        return res.status(404).json({ error: "not_found" });
      }

      if (order.status !== "in_progress" && order.status !== "completed") {
        return res.status(400).json({ error: "invalid_status_state" });
      }

      if (order.paid_amount && Number(order.paid_amount) > 0) {
        return res.status(400).json({ error: "already_paid" });
      }

      const account = db
        .prepare("SELECT * FROM cash_accounts WHERE id = ?")
        .get(payment_account_id);
      if (!account) {
        return res.status(404).json({ error: "account_not_found" });
      }

      const description = `Оплата заказа #${order.order_number} (наличные)`;
      const transactionId = generateId("trans");
      const previousStatus = order.status;

      const tx = db.transaction(() => {
        const completedAt = new Date().toISOString();
        db.prepare(
          `
        UPDATE orders
        SET status = 'delivered',
            previous_status = ?,
            payment_type = ?,
            payment_account_id = ?,
            paid_amount = ?,
            paid_at = DATETIME('now'),
            payment_notes = ?,
            completed_at = ?,
            updated_at = DATETIME('now')
        WHERE id = ?
      `,
        ).run(
          previousStatus,
          payment_type,
          payment_account_id,
          parsedAmount,
          payment_notes || null,
          completedAt,
          id,
        );

        db.prepare(
          `
        INSERT INTO cash_transactions (id, account_id, type, amount, description, order_id)
        VALUES (?, ?, 'income', ?, ?, ?)
      `,
        ).run(transactionId, payment_account_id, parsedAmount, description, id);

        db.prepare(
          "UPDATE cash_accounts SET balance = balance + ? WHERE id = ?",
        ).run(parsedAmount, payment_account_id);

        consumePromoUsageForOrder({
          orderId: id,
          promoCodeId: order.promo_code_id || null,
          customerId: order.customer_id || null,
          discountApplied: Number(order.discount_amount || 0),
          consumedAt: completedAt,
          idFactory: () => generateId("pu"),
        });

        awardLoyaltyForOrder(id);
        try {
          accrueWheelSpinsForOrder(id);
        } catch (wheelError) {
          console.error("[wheel] accrual on /issue failed", wheelError);
        }
      });

      tx();

      const updatedOrder = db
        .prepare(
          `
      SELECT 
        o.*,
        c.telegram_username,
        c.first_name || ' ' || COALESCE(c.last_name, '') as customer_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ?
    `,
        )
        .get(id);

      const transaction = db
        .prepare(
          `
      SELECT 
        ct.*,
        ca.name as account_name
      FROM cash_transactions ct
      JOIN cash_accounts ca ON ca.id = ct.account_id
      WHERE ct.id = ?
    `,
        )
        .get(transactionId);

      recordStatusChange(
        id,
        previousStatus,
        updatedOrder.status,
        "Выдача заказа",
      );

      // Авто-уведомление клиенту о выдаче (Pavel 10.05.2026: «когда пробил
      // заказ — не отправляет»). Раньше /issue имел отдельный поток без
      // вызова auto-notify, поэтому статус delivered шёл молча. Сейчас
      // дёргаем тот же helper что в PATCH /orders/:id.
      const statusChangedOnIssue = updatedOrder.status !== previousStatus;
      res.json({
        order: updatedOrder,
        transaction,
        auto_notification: statusChangedOnIssue ? { pending: true } : null,
      });

      if (statusChangedOnIssue) {
        setImmediate(() => {
          void autoNotifyForStatusChange({
            orderId: id,
            newStatus: updatedOrder.status,
            previousStatus,
            reactivate: false,
          }).catch((notifyErr) => {
            console.error("[crm] deferred /issue auto-notify error:", notifyErr);
          });
        });
      }
    } catch (error) {
      console.error("[crm] Issue order error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Удаление оплаты заказа
crmOperationsRouter.delete(
  "/api/admin/crm/orders/:id/payment",
  authMiddleware,
  (req, res) => {
    try {
      const { id } = req.params;

      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
      if (!order) {
        return res.status(404).json({ error: "not_found" });
      }

      if (!order.paid_amount || Number(order.paid_amount) <= 0) {
        return res.status(400).json({ error: "payment_not_found" });
      }

      const transactions = db
        .prepare("SELECT * FROM cash_transactions WHERE order_id = ?")
        .all(id);

      if (!transactions.length) {
        return res.status(400).json({ error: "transaction_not_found" });
      }

      const restoredStatus = order.previous_status || "in_progress";

      const tx = db.transaction(() => {
        for (const transaction of transactions) {
          db.prepare("DELETE FROM cash_transactions WHERE id = ?").run(
            transaction.id,
          );

          if (transaction.account_id && transaction.amount) {
            if (transaction.type === "income") {
              db.prepare(
                "UPDATE cash_accounts SET balance = balance - ? WHERE id = ?",
              ).run(transaction.amount, transaction.account_id);
            } else if (transaction.type === "expense") {
              db.prepare(
                "UPDATE cash_accounts SET balance = balance + ? WHERE id = ?",
              ).run(transaction.amount, transaction.account_id);
            }
          }
        }

        db.prepare(
          `
        UPDATE orders
        SET status = ?,
            payment_type = NULL,
            payment_account_id = NULL,
            paid_amount = NULL,
            paid_at = NULL,
            payment_notes = NULL,
            previous_status = NULL,
            completed_at = NULL,
            updated_at = DATETIME('now')
        WHERE id = ?
      `,
        ).run(restoredStatus, id);

        if (order.promo_code_id) {
          if (["completed", "delivered"].includes(restoredStatus)) {
            consumePromoUsageForOrder({
              orderId: id,
              promoCodeId: order.promo_code_id,
              customerId: order.customer_id || null,
              discountApplied: Number(order.discount_amount || 0),
              idFactory: () => generateId("pu"),
            });
          } else {
            reservePromoUsageForOrder({
              promoCodeId: order.promo_code_id,
              orderId: id,
              customerId: order.customer_id || null,
              discountApplied: Number(order.discount_amount || 0),
              idFactory: () => generateId("pu"),
            });
          }
        }
      });

      tx();

      const updatedOrder = db
        .prepare("SELECT * FROM orders WHERE id = ?")
        .get(id);
      const updatedItems = db
        .prepare(`
          SELECT oi.*, p.description as product_description 
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `)
        .all(id);

      recordStatusChange(
        id,
        order.status,
        updatedOrder.status,
        "Оплата отменена",
      );

      res.json({ ...updatedOrder, items: updatedItems });
    } catch (error) {
      console.error("[crm] Remove order payment error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// =========================
// PROCUREMENTS (Закупки)
// =========================
crmOperationsRouter.get(
  "/api/admin/crm/procurements",
  authMiddleware,
  (req, res) => {
    try {
      const procurements = db
        .prepare(
          `
      SELECT p.*, e.first_name || ' ' || e.last_name as employee_name
      FROM procurements p
      LEFT JOIN employees e ON e.id = p.employee_id
      ORDER BY p.created_at DESC
    `,
        )
        .all();

      res.json(procurements);
    } catch (error) {
      console.error("[crm] Get procurements error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

crmOperationsRouter.get(
  "/api/admin/crm/procurements/:id",
  authMiddleware,
  (req, res) => {
    try {
      const { id } = req.params;

      const procurement = db
        .prepare("SELECT * FROM procurements WHERE id = ?")
        .get(id);
      if (!procurement) {
        return res.status(404).json({ error: "not_found" });
      }

      const items = db
        .prepare(
          `
      SELECT pi.*,
             CASE WHEN pv.name IS NOT NULL THEN p.title || ' (' || pv.name || ')' ELSE p.title END as product_title,
             p.stock, p.warehouse_stock, p.cost_price as product_cost_price, p.min_stock, cg.name as group_name,
             pv.name as variant_name, pv.stock as variant_stock,
             pv.warehouse_stock as variant_warehouse_stock,
             CASE
               WHEN COALESCE(p.has_variants, 0) = 1 THEN (
                 SELECT COALESCE(SUM(all_variants.stock + all_variants.warehouse_stock), 0)
                 FROM product_variants all_variants
                 WHERE all_variants.product_id = p.id
               )
               ELSE COALESCE(p.stock, 0) + COALESCE(p.warehouse_stock, 0)
             END as base_total_stock,
             COALESCE(
               (SELECT url FROM product_images WHERE productId = pi.product_id AND variant_id = pi.variant_id ORDER BY position LIMIT 1),
               (SELECT url FROM product_images WHERE productId = pi.product_id AND variant_id IS NULL ORDER BY position LIMIT 1),
               (SELECT url FROM product_images WHERE productId = pi.product_id ORDER BY position LIMIT 1),
               cg.cover_image,
               (SELECT cover_image FROM categories WHERE id = p.categoryId)
             ) as product_image
      FROM procurement_items pi
      JOIN products p ON p.id = pi.product_id
      LEFT JOIN category_groups cg ON cg.id = p.groupId
      LEFT JOIN product_variants pv ON pv.id = pi.variant_id
      WHERE pi.procurement_id = ?
    `,
        )
        .all(id);

      res.json({ ...procurement, items });
    } catch (error) {
      console.error("[crm] Get procurement error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Создание закупки
crmOperationsRouter.post(
  "/api/admin/crm/procurements",
  authMiddleware,
  (req, res) => {
    try {
      const { supplier_name, items, notes } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items_required" });
      }

      const procurementId = generateId("proc");
      const procurementNumber = getNextNumber(
        "procurements",
        "procurement_number",
      );

      let totalAmount = 0;

      const tx = db.transaction(() => {
        // Создаем закупку
        db.prepare(
          `
        INSERT INTO procurements (id, procurement_number, supplier_name, total_amount, status, notes)
        VALUES (?, ?, ?, 0, 'draft', ?)
      `,
        ).run(
          procurementId,
          procurementNumber,
          supplier_name || null,
          notes || null,
        );

        // Добавляем позиции
        for (const item of items) {
          // Проверяем, это вариант или обычный товар
          let productId = item.product_id;
          let variantId = item.variant_id || null;
          
          // Если передан variant_id, получаем product_id из варианта
          if (variantId) {
            const variant = db
              .prepare("SELECT product_id FROM product_variants WHERE id = ?")
              .get(variantId);
            if (!variant) throw new Error('variant_not_found');
            if (String(productId) !== String(variant.product_id)) throw new Error('variant_product_mismatch');
          }
          
          const product = db
            .prepare("SELECT * FROM products WHERE id = ?")
            .get(productId);
          if (!product) {
            throw new Error(`Product not found: ${productId}`);
          }
          if (Number(product.has_variants || 0) === 1 && !variantId) throw new Error('variant_required');
          if (Number(product.has_variants || 0) === 0 && variantId) throw new Error('variant_not_allowed');

          const quantity = Number(item.quantity || 0);
          const costPerUnit = Number(item.cost_per_unit || 0);
          const warehouseQuantity = Number(item.warehouse_quantity || 0);
          if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('invalid_quantity');
          if (!Number.isFinite(costPerUnit) || costPerUnit < 0) throw new Error('invalid_cost');
          if (!Number.isInteger(warehouseQuantity) || warehouseQuantity < 0 || warehouseQuantity > quantity) {
            throw new Error('invalid_warehouse_quantity');
          }
          const totalCost = quantity * costPerUnit;
          totalAmount += totalCost;

          db.prepare(
            `
          INSERT INTO procurement_items (id, procurement_id, product_id, variant_id, quantity, warehouse_quantity, cost_per_unit, total_cost)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
          ).run(
            generateId("pi"),
            procurementId,
            productId,
            variantId,
            quantity,
            warehouseQuantity,
            costPerUnit,
            totalCost,
          );
        }

        // Обновляем общую сумму
        db.prepare("UPDATE procurements SET total_amount = ? WHERE id = ?").run(
          totalAmount,
          procurementId,
        );
      });

      tx();

      const procurement = db
        .prepare("SELECT * FROM procurements WHERE id = ?")
        .get(procurementId);
      const procurementItems = db
        .prepare(
          `
      SELECT pi.*,
             CASE WHEN pv.name IS NOT NULL THEN p.title || ' (' || pv.name || ')' ELSE p.title END as product_title,
             p.stock, p.warehouse_stock, p.cost_price as product_cost_price, p.min_stock, cg.name as group_name,
             pv.name as variant_name, pv.stock as variant_stock,
             pv.warehouse_stock as variant_warehouse_stock,
             CASE
               WHEN COALESCE(p.has_variants, 0) = 1 THEN (
                 SELECT COALESCE(SUM(all_variants.stock + all_variants.warehouse_stock), 0)
                 FROM product_variants all_variants
                 WHERE all_variants.product_id = p.id
               )
               ELSE COALESCE(p.stock, 0) + COALESCE(p.warehouse_stock, 0)
             END as base_total_stock,
             COALESCE(
               (SELECT url FROM product_images WHERE productId = pi.product_id AND variant_id = pi.variant_id ORDER BY position LIMIT 1),
               (SELECT url FROM product_images WHERE productId = pi.product_id AND variant_id IS NULL ORDER BY position LIMIT 1),
               (SELECT url FROM product_images WHERE productId = pi.product_id ORDER BY position LIMIT 1),
               cg.cover_image,
               (SELECT cover_image FROM categories WHERE id = p.categoryId)
             ) as product_image
      FROM procurement_items pi
      JOIN products p ON p.id = pi.product_id
      LEFT JOIN category_groups cg ON cg.id = p.groupId
      LEFT JOIN product_variants pv ON pv.id = pi.variant_id
      WHERE pi.procurement_id = ?
    `,
        )
        .all(procurementId);

      res.json({ ...procurement, items: procurementItems });
    } catch (error) {
      console.error("[crm] Create procurement error:", error);
      if ([
        "invalid_quantity",
        "invalid_cost",
        "invalid_warehouse_quantity",
        "variant_not_found",
        "variant_product_mismatch",
        "variant_required",
        "variant_not_allowed",
      ].includes(error.message)) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Обновление черновика закупки
crmOperationsRouter.patch(
  "/api/admin/crm/procurements/:id",
  authMiddleware,
  (req, res) => {
    try {
      const { id } = req.params;
      const { supplier_name, notes, items } = req.body || {};

      const procurement = db
        .prepare("SELECT * FROM procurements WHERE id = ?")
        .get(id);
      if (!procurement) {
        return res.status(404).json({ error: "not_found" });
      }

      if (procurement.status !== "draft") {
        return res.status(400).json({ error: "edit_not_allowed" });
      }

      const tx = db.transaction(() => {
        if (supplier_name !== undefined || notes !== undefined) {
          db.prepare(
            `
          UPDATE procurements
          SET supplier_name = ?, notes = ?
          WHERE id = ?
        `,
          ).run(
            supplier_name !== undefined
              ? supplier_name || null
              : procurement.supplier_name,
            notes !== undefined ? notes || null : procurement.notes,
            id,
          );
        }

        if (Array.isArray(items)) {
          if (items.length === 0) {
            throw new Error("items_required");
          }

          db.prepare(
            "DELETE FROM procurement_items WHERE procurement_id = ?",
          ).run(id);

          let totalAmount = 0;
          const itemStmt = db.prepare(`
          INSERT INTO procurement_items (id, procurement_id, product_id, variant_id, quantity, warehouse_quantity, cost_per_unit, total_cost)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

          for (const item of items) {
            if (!item || !item.product_id) {
              throw new Error("invalid_item");
            }

            // Проверяем, это вариант или обычный товар
            let productId = item.product_id;
            let variantId = item.variant_id || null;
            
            // Если передан variant_id, получаем product_id из варианта
            if (variantId) {
              const variant = db
                .prepare("SELECT product_id FROM product_variants WHERE id = ?")
                .get(variantId);
              if (!variant) throw new Error("variant_not_found");
              if (String(productId) !== String(variant.product_id)) throw new Error("variant_product_mismatch");
            }

            const product = db
              .prepare("SELECT * FROM products WHERE id = ?")
              .get(productId);
            if (!product) {
              throw new Error(`Product not found: ${productId}`);
            }
            if (Number(product.has_variants || 0) === 1 && !variantId) throw new Error("variant_required");
            if (Number(product.has_variants || 0) === 0 && variantId) throw new Error("variant_not_allowed");

            const quantity = Number(item.quantity || 0);
            const costPerUnit = Number(item.cost_per_unit || 0);
            const warehouseQuantity = Number(item.warehouse_quantity || 0);

            if (!Number.isInteger(quantity) || quantity <= 0) {
              throw new Error("invalid_quantity");
            }

            if (!Number.isFinite(costPerUnit) || costPerUnit < 0) {
              throw new Error("invalid_cost");
            }
            if (!Number.isInteger(warehouseQuantity) || warehouseQuantity < 0 || warehouseQuantity > quantity) {
              throw new Error("invalid_warehouse_quantity");
            }

            const totalCost = costPerUnit * quantity;
            totalAmount += totalCost;

            itemStmt.run(
              generateId("pi"),
              id,
              productId,
              variantId,
              quantity,
              warehouseQuantity,
              costPerUnit,
              totalCost,
            );
          }

          db.prepare(
            "UPDATE procurements SET total_amount = ? WHERE id = ?",
          ).run(totalAmount, id);
        }
      });

      tx();

      const updated = db
        .prepare("SELECT * FROM procurements WHERE id = ?")
        .get(id);
      const updatedItems = db
        .prepare(
          `
      SELECT pi.*,
             CASE WHEN pv.name IS NOT NULL THEN p.title || ' (' || pv.name || ')' ELSE p.title END as product_title,
             p.stock, p.warehouse_stock, p.cost_price as product_cost_price, p.min_stock, cg.name as group_name,
             pv.name as variant_name, pv.stock as variant_stock,
             pv.warehouse_stock as variant_warehouse_stock,
             CASE
               WHEN COALESCE(p.has_variants, 0) = 1 THEN (
                 SELECT COALESCE(SUM(all_variants.stock + all_variants.warehouse_stock), 0)
                 FROM product_variants all_variants
                 WHERE all_variants.product_id = p.id
               )
               ELSE COALESCE(p.stock, 0) + COALESCE(p.warehouse_stock, 0)
             END as base_total_stock,
             COALESCE(
               (SELECT url FROM product_images WHERE productId = pi.product_id AND variant_id = pi.variant_id ORDER BY position LIMIT 1),
               (SELECT url FROM product_images WHERE productId = pi.product_id AND variant_id IS NULL ORDER BY position LIMIT 1),
               (SELECT url FROM product_images WHERE productId = pi.product_id ORDER BY position LIMIT 1),
               cg.cover_image,
               (SELECT cover_image FROM categories WHERE id = p.categoryId)
             ) as product_image
      FROM procurement_items pi
      JOIN products p ON p.id = pi.product_id
      LEFT JOIN category_groups cg ON cg.id = p.groupId
      LEFT JOIN product_variants pv ON pv.id = pi.variant_id
      WHERE pi.procurement_id = ?
    `,
        )
        .all(id);

      res.json({ ...updated, items: updatedItems });
    } catch (error) {
      console.error("[crm] Update procurement error:", error);
      const clientErrors = new Set([
        "items_required",
        "invalid_item",
        "invalid_quantity",
        "invalid_cost",
        "invalid_warehouse_quantity",
        "variant_not_found",
        "variant_product_mismatch",
        "variant_required",
        "variant_not_allowed",
        "edit_not_allowed",
      ]);
      if (clientErrors.has(error.message)) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Удаление закупки
crmOperationsRouter.delete(
  "/api/admin/crm/procurements/:id",
  authMiddleware,
  (req, res) => {
    try {
      const { id } = req.params;

      const procurement = db
        .prepare("SELECT * FROM procurements WHERE id = ?")
        .get(id);
      if (!procurement) {
        return res.status(404).json({ error: "not_found" });
      }

      const items = db
        .prepare("SELECT * FROM procurement_items WHERE procurement_id = ? ORDER BY rowid ASC")
        .all(id);

      const tx = db.transaction(() => {
        if (procurement.status === "completed") {
          for (const item of [...items].reverse()) {
            const product = db
              .prepare("SELECT * FROM products WHERE id = ?")
              .get(item.product_id);
            if (!product) {
              continue;
            }

            const quantity = Number(item.quantity || 0);
            const warehouseQuantity = Number(item.warehouse_quantity || 0);
            const retailQuantity = quantity - warehouseQuantity;
            const costPerUnit = Number(item.cost_per_unit || 0);
            const stockTable = item.variant_id ? "product_variants" : "products";
            const stockId = item.variant_id || item.product_id;
            const stockRow = db.prepare(`
              SELECT stock, warehouse_stock FROM ${stockTable} WHERE id = ?
            `).get(stockId);

            if (
              !stockRow
              || Number(stockRow.stock || 0) < retailQuantity
              || Number(stockRow.warehouse_stock || 0) < warehouseQuantity
            ) {
              throw new Error(`insufficient_stock_to_rollback:${product.id}`);
            }

            const currentTotalStock = getProductTotalStock(item.product_id);
            const previousStock = currentTotalStock - quantity;
            let previousCost = 0;
            if (previousStock > 0) {
              const currentCost = Number(product.cost_price || 0);
              previousCost =
                (currentCost * currentTotalStock - quantity * costPerUnit) /
                previousStock;
              if (previousCost < 0) {
                previousCost = 0;
              }
            }

            db.prepare(
              `UPDATE ${stockTable}
               SET stock = stock - ?, warehouse_stock = warehouse_stock - ?
               WHERE id = ?`,
            ).run(retailQuantity, warehouseQuantity, stockId);
            db.prepare('UPDATE products SET cost_price = ? WHERE id = ?').run(
              previousStock > 0 ? previousCost : 0,
              item.product_id,
            );
          }

          if (procurement.expense_transaction_id) {
            const transaction = db
              .prepare("SELECT * FROM cash_transactions WHERE id = ?")
              .get(procurement.expense_transaction_id);
            if (transaction) {
              db.prepare("DELETE FROM cash_transactions WHERE id = ?").run(
                transaction.id,
              );
              if (transaction.account_id && transaction.amount) {
                if (transaction.type === "expense") {
                  db.prepare(
                    "UPDATE cash_accounts SET balance = balance + ? WHERE id = ?",
                  ).run(transaction.amount, transaction.account_id);
                } else if (transaction.type === "income") {
                  db.prepare(
                    "UPDATE cash_accounts SET balance = balance - ? WHERE id = ?",
                  ).run(transaction.amount, transaction.account_id);
                }
              }
            }
          }
        }

        db.prepare(
          "DELETE FROM procurement_items WHERE procurement_id = ?",
        ).run(id);
        db.prepare("DELETE FROM procurements WHERE id = ?").run(id);
      });

      tx();
      syncGroupsForProducts(items.map((item) => item.product_id));

      res.json({ ok: true });
    } catch (error) {
      console.error("[crm] Delete procurement error:", error);
      if (
        error.message &&
        error.message.startsWith("insufficient_stock_to_rollback")
      ) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Удаление оплаты по закупке
crmOperationsRouter.delete(
  "/api/admin/crm/procurements/:id/payment",
  authMiddleware,
  (req, res) => {
    try {
      const { id } = req.params;

      const procurement = db
        .prepare("SELECT * FROM procurements WHERE id = ?")
        .get(id);
      if (!procurement) {
        return res.status(404).json({ error: "not_found" });
      }

      if (!procurement.expense_transaction_id) {
        return res.status(400).json({ error: "payment_not_found" });
      }

      const transaction = db
        .prepare("SELECT * FROM cash_transactions WHERE id = ?")
        .get(procurement.expense_transaction_id);

      const tx = db.transaction(() => {
        if (transaction) {
          db.prepare("DELETE FROM cash_transactions WHERE id = ?").run(
            transaction.id,
          );
          if (transaction.account_id && transaction.amount) {
            if (transaction.type === "expense") {
              db.prepare(
                "UPDATE cash_accounts SET balance = balance + ? WHERE id = ?",
              ).run(transaction.amount, transaction.account_id);
            } else if (transaction.type === "income") {
              db.prepare(
                "UPDATE cash_accounts SET balance = balance - ? WHERE id = ?",
              ).run(transaction.amount, transaction.account_id);
            }
          }
        }

        db.prepare(
          "UPDATE procurements SET expense_transaction_id = NULL WHERE id = ?",
        ).run(id);
      });

      tx();

      const updated = db
        .prepare("SELECT * FROM procurements WHERE id = ?")
        .get(id);
      res.json(updated);
    } catch (error) {
      console.error("[crm] Remove procurement payment error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Подтверждение закупки (увеличение остатков)
crmOperationsRouter.post(
  "/api/admin/crm/procurements/:id/complete",
  authMiddleware,
  (req, res) => {
    try {
      const { id } = req.params;

      const procurement = db
        .prepare("SELECT * FROM procurements WHERE id = ?")
        .get(id);
      if (!procurement) {
        return res.status(404).json({ error: "not_found" });
      }

      if (procurement.status === "completed") {
        return res.status(400).json({ error: "already_completed" });
      }

      const items = db
        .prepare("SELECT * FROM procurement_items WHERE procurement_id = ? ORDER BY rowid ASC")
        .all(id);

      const tx = db.transaction(() => {
        for (const item of items) {
          const quantity = Number(item.quantity || 0);
          const warehouseQuantity = Number(item.warehouse_quantity || 0);
          const retailQuantity = quantity - warehouseQuantity;
          const avgCost = calculateAverageCost(
            item.product_id,
            quantity,
            item.cost_per_unit,
          );
          // Проверяем, это вариант или обычный товар
          if (item.variant_id) {
            db.prepare(
              `UPDATE product_variants
               SET stock = stock + ?, warehouse_stock = warehouse_stock + ?
               WHERE id = ?`
            ).run(retailQuantity, warehouseQuantity, item.variant_id);

            db.prepare(
              `UPDATE products SET cost_price = ? WHERE id = ?`
            ).run(avgCost, item.product_id);
          } else {
            db.prepare(
              `
            UPDATE products 
            SET stock = stock + ?,
                warehouse_stock = warehouse_stock + ?,
                cost_price = ?
            WHERE id = ?
          `,
            ).run(retailQuantity, warehouseQuantity, avgCost, item.product_id);
          }
        }

        // Обновляем статус закупки
        db.prepare(
          `
        UPDATE procurements 
        SET status = 'completed', completed_at = DATETIME('now')
        WHERE id = ?
      `,
        ).run(id);

        // Списываем деньги из кассы
        const defaultAccount = db
          .prepare("SELECT id FROM cash_accounts WHERE is_default = 1 LIMIT 1")
          .get();
        if (defaultAccount) {
          const transId = generateId("trans");
          db.prepare(
            `
          INSERT INTO cash_transactions (id, account_id, type, amount, description)
          VALUES (?, ?, 'expense', ?, ?)
        `,
          ).run(
            transId,
            defaultAccount.id,
            procurement.total_amount,
            `Закупка #${procurement.procurement_number}`,
          );

          db.prepare(
            "UPDATE cash_accounts SET balance = balance - ? WHERE id = ?",
          ).run(procurement.total_amount, defaultAccount.id);

          db.prepare(
            `
          UPDATE procurements
          SET expense_transaction_id = ?
          WHERE id = ?
        `,
          ).run(transId, id);
        }
      });

      tx();
      syncGroupsForProducts(items.map((item) => item.product_id));

      const updated = db
        .prepare("SELECT * FROM procurements WHERE id = ?")
        .get(id);
      res.json(updated);
    } catch (error) {
      console.error("[crm] Complete procurement error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// =========================
// ARCHIVING (Архивация старых заказов)
// =========================
crmOperationsRouter.post(
  "/api/admin/crm/archive-delivered-orders",
  authMiddleware,
  (req, res) => {
    try {
      console.log("[crm] Manual archiving triggered");
      const result = archiveOldDeliveredOrders();
      res.json({
        ok: true,
        ...result,
      });
    } catch (error) {
      console.error("[crm] Manual archiving error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Debug endpoint для проверки delivered заказов
crmOperationsRouter.get(
  "/api/admin/crm/debug-delivered-orders",
  authMiddleware,
  (req, res) => {
    try {
      const now = new Date();
      const { start: startOfToday } = getBusinessPeriodRange("today");

      const orders = db
        .prepare(
          `
      SELECT
        id,
        order_number,
        status,
        completed_at,
        created_at,
        CASE
          WHEN completed_at IS NULL THEN 'NULL'
          WHEN completed_at < ? THEN 'OLD (should be deleted)'
          ELSE 'TODAY (should be visible)'
        END as classification
      FROM orders
      WHERE status = 'delivered'
      ORDER BY completed_at DESC
      LIMIT 20
    `,
        )
        .all(startOfToday.toISOString());

      res.json({
        currentTime: now.toISOString(),
        startOfToday: startOfToday.toISOString(),
        orders,
      });
    } catch (error) {
      console.error("[crm] Debug endpoint error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Исправление completed_at для delivered заказов где он NULL
crmOperationsRouter.post(
  "/api/admin/crm/fix-delivered-completed-at",
  authMiddleware,
  (req, res) => {
    try {
      console.log("[crm] Fixing delivered orders without completed_at");

      const ordersToFix = db
        .prepare(
          `
      SELECT id, order_number, created_at, completed_at, paid_at
      FROM orders 
      WHERE status = 'delivered' AND completed_at IS NULL
    `,
        )
        .all();

      if (ordersToFix.length === 0) {
        return res.json({ ok: true, fixed: 0, message: "No orders to fix" });
      }

      const tx = db.transaction(() => {
        for (const order of ordersToFix) {
          const completedDate = order.paid_at || order.created_at;
          let isoDate;

          if (completedDate && completedDate.includes("T")) {
            isoDate = completedDate;
          } else if (completedDate) {
            isoDate = new Date(completedDate + " UTC").toISOString();
          } else {
            isoDate = new Date().toISOString();
          }

          db.prepare("UPDATE orders SET completed_at = ? WHERE id = ?").run(
            isoDate,
            order.id,
          );
        }
      });

      tx();

      res.json({ ok: true, fixed: ordersToFix.length });
    } catch (error) {
      console.error("[crm] Fix completed_at error:", error);
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// Продолжение следует...
