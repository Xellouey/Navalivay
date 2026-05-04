import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';
import {
  getBusinessCalendarDayRange,
  getBusinessCalendarMonthRange,
  getBusinessDayLabel,
  getBusinessPeriodRange,
  shiftBusinessCalendarDate,
  toSqliteUtcString,
} from '../utils/business-time.js';
import {
  PENDING_ACTIVE_PREDICATE,
  computeBlockUntil,
  createBlock,
  deletePendingBan,
  getActiveBlockForCustomerId,
  getActiveBlockForTelegramId,
  serializeBlock,
  unblockCustomerBlock,
} from '../utils/customer-blocks.js';

export const crmRouter = express.Router();

// Helper для генерации ID
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Helper для получения следующего номера
function getNextNumber(table, field) {
  const row = db.prepare(`SELECT MAX(${field}) as maxNum FROM ${table}`).get();
  return (row?.maxNum || 0) + 1;
}

// =========================
// DASHBOARD (Главная CRM)
// =========================
crmRouter.get('/api/admin/crm/dashboard', authMiddleware, (req, res) => {
  try {
    const { period = 'today' } = req.query;
    const offset = Number(req.query.offset || 0) || 0;

    // Произвольный диапазон дат (period=custom): from/to в формате YYYY-MM-DD.
    // Парсим строго как business-tz даты, чтобы границы суток совпадали с
    // остальными ветками (иначе UTC-смещение режет/добавляет ~3 часа).
    let start, end;
    const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (period === 'custom') {
      const m1 = ISO_DATE.exec(String(req.query.from || ''));
      const m2 = ISO_DATE.exec(String(req.query.to || ''));
      if (!m1 || !m2) {
        return res.status(400).json({ error: 'invalid_custom_range', message: 'from/to must be YYYY-MM-DD' });
      }
      const fromRange = getBusinessCalendarDayRange(+m1[1], +m1[2], +m1[3]);
      const toRange = getBusinessCalendarDayRange(+m2[1], +m2[2], +m2[3]);
      if (fromRange.start.getTime() >= toRange.end.getTime()) {
        return res.status(400).json({ error: 'invalid_custom_range', message: 'from must be earlier than to' });
      }
      start = fromRange.start;
      // toRange.end — это уже начало (to+1)-го дня (exclusive), что нам и нужно
      end = toRange.end;
    } else {
      ({ start, end } = getBusinessPeriodRange(period, offset));
    }

    // Параметры топ-линеек
    const topSort = req.query.top_sort === 'quantity' ? 'quantity' : 'profit';
    const topLimitRaw = Number(req.query.top_limit ?? 5);
    const topLimit = Number.isFinite(topLimitRaw) ? Math.min(Math.max(Math.trunc(topLimitRaw), 1), 1000) : 5;
    // Эскейпим LIKE-метасимволы, чтобы поиск по «5_unit» / «100%» не превращался в wildcard
    const rawTopSearch = typeof req.query.top_search === 'string' ? req.query.top_search.trim() : '';
    const topSearch = rawTopSearch.replace(/[\\%_]/g, (ch) => '\\' + ch);

    // Функция для форматирования даты в SQLite-совместимый формат (YYYY-MM-DD HH:MM:SS)
    function toSqliteDate(date) {
      return toSqliteUtcString(date);
    }
    
    // Для статистики заказов используем created_at
    const createdAtFilter = `datetime(created_at) >= '${toSqliteDate(start)}' AND datetime(created_at) < '${toSqliteDate(end)}'`;
    // Для финансовой статистики используем paid_at (дата оплаты/выдачи)
    const paidAtFilter = `datetime(paid_at) >= '${toSqliteDate(start)}' AND datetime(paid_at) < '${toSqliteDate(end)}'`;

    // Выручка, прибыль, количество продаж - по дате ОПЛАТЫ (paid_at)
    const stats = db.prepare(`
      SELECT 
        COALESCE(COUNT(o.id), 0)                              AS total_sales,
        COALESCE(SUM(COALESCE(o.final_amount, o.total_amount)), 0) AS revenue,
        COALESCE(SUM(COALESCE(o.profit, 0)), 0)               AS profit,
        COALESCE(COUNT(DISTINCT o.customer_id), 0)            AS unique_customers
      FROM orders o
      WHERE o.status IN ('completed', 'delivered')
        AND o.paid_at IS NOT NULL
        AND ${paidAtFilter}
    `).get();

    // POS продажи - добавляем к общей статистике
    const posStats = db.prepare(`
      SELECT 
        COALESCE(COUNT(*), 0) AS pos_sales,
        COALESCE(SUM(price), 0) AS pos_revenue,
        COALESCE(SUM(profit), 0) AS pos_profit
      FROM pos_sales
      WHERE status = 'completed'
        AND datetime(completed_at) >= '${toSqliteDate(start)}' 
        AND datetime(completed_at) < '${toSqliteDate(end)}'
    `).get();

    // Объединяем статистику заказов и POS
    const combinedStats = {
      total_sales: (stats.total_sales || 0) + (posStats.pos_sales || 0),
      revenue: (stats.revenue || 0) + (posStats.pos_revenue || 0),
      profit: (stats.profit || 0) + (posStats.pos_profit || 0),
      unique_customers: stats.unique_customers || 0
    };

    // Топ линейки (category groups) - по дате ОПЛАТЫ (paid_at)
    // Whitelist для ORDER BY (защита от SQL-инъекции через top_sort)
    const topOrderBy = topSort === 'quantity' ? 'total_quantity DESC' : 'total_profit DESC';
    // Запрашиваем на 1 строку больше, чтобы понимать «есть ли ещё» без второго запроса
    const topRowsRaw = db.prepare(`
      WITH order_totals AS (
        SELECT order_id, SUM(total_price) AS items_subtotal
        FROM order_items
        GROUP BY order_id
      ),
      item_totals AS (
        SELECT
          oi.quantity AS quantity,
          oi.total_price AS total_price,
          oi.total_cost AS total_cost,
          COALESCE(g.id, 'no_group') AS group_id,
          COALESCE(g.name, 'Без линейки') AS group_name,
          g.cover_image AS cover_image,
          CASE
            WHEN COALESCE(ot.items_subtotal, 0) > 0
            THEN (COALESCE(ot.items_subtotal, 0) - COALESCE(o.final_amount, ot.items_subtotal)) / COALESCE(ot.items_subtotal, 0)
            ELSE 0
          END AS order_discount_ratio
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN order_totals ot ON ot.order_id = o.id
        LEFT JOIN products p ON p.id = oi.product_id
        LEFT JOIN category_groups g ON g.id = p.groupId
        WHERE o.status IN ('completed', 'delivered')
          AND o.paid_at IS NOT NULL
          AND ${paidAtFilter}
      )
      SELECT
        group_id,
        group_name,
        MAX(cover_image) AS cover_image,
        SUM(quantity) as total_quantity,
        SUM(total_price - (total_price * order_discount_ratio)) as total_revenue,
        SUM((total_price - (total_price * order_discount_ratio)) - total_cost) as total_profit
      FROM item_totals
      WHERE (? = '' OR LOWER(group_name) LIKE '%' || LOWER(?) || '%' ESCAPE '\\')
      GROUP BY group_id, group_name
      ORDER BY ${topOrderBy}
      LIMIT ?
    `).all(topSearch, topSearch, topLimit + 1);
    const topProductsHasMore = topRowsRaw.length > topLimit;
    const topProducts = topRowsRaw.slice(0, topLimit);

    // Статистика по статусам заказов - по дате СОЗДАНИЯ
    const ordersByStatus = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM orders
      WHERE ${createdAtFilter}
      GROUP BY status
    `).all();

    // Доставки - по дате ОПЛАТЫ
    const deliveryStats = db.prepare(`
      SELECT 
        COUNT(*) as deliveries,
        COALESCE(SUM(profit), 0) as delivery_profit
      FROM orders
      WHERE delivery_type = 'delivery'
        AND status IN ('completed', 'delivered')
        AND paid_at IS NOT NULL
        AND ${paidAtFilter}
    `).get();

    // Самовывозы - по дате ОПЛАТЫ
    const pickupStats = db.prepare(`
      SELECT 
        COUNT(*) as pickups,
        COALESCE(SUM(profit), 0) as pickup_profit
      FROM orders
      WHERE delivery_type = 'pickup'
        AND status IN ('completed', 'delivered')
        AND paid_at IS NOT NULL
        AND ${paidAtFilter}
    `).get();

    res.json({
      period,
      stats: {
        totalSales: combinedStats.total_sales,
        revenue: combinedStats.revenue,
        profit: combinedStats.profit,
        averageCheck: combinedStats.total_sales > 0 ? combinedStats.revenue / combinedStats.total_sales : 0,
        uniqueCustomers: combinedStats.unique_customers || 0
      },
      topProducts,
      topProductsHasMore,
      ordersByStatus,
      deliveryStats: {
        deliveries: deliveryStats?.deliveries || 0,
        profit: deliveryStats?.delivery_profit || 0
      },
      pickupStats: {
        pickups: pickupStats?.pickups || 0,
        profit: pickupStats?.pickup_profit || 0
      }
    });
  } catch (error) {
    console.error('[crm] Dashboard error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Dashboard Timeseries - детализированные данные для графиков
crmRouter.get('/api/admin/crm/dashboard-timeseries', authMiddleware, (req, res) => {
  try {
    const { period = 'month', year } = req.query;
    const offset = Number(req.query.offset || 0) || 0;

    function getPeriodRange(p, off, yr) {
      const now = new Date();
      function startOfUTCDay(d) {
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      }
      
      if (p === 'today') {
        // Для дня - возвращаем данные по часам (упрощенно - один столбик)
        const base = startOfUTCDay(now);
        const start = new Date(base.getTime() + off * 24 * 60 * 60 * 1000);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        return { start, end, granularity: 'day' };
      }
      
      if (p === 'month') {
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth();
        const start = new Date(Date.UTC(y, m + off, 1));
        const end = new Date(Date.UTC(y, m + off + 1, 1));
        return { start, end, granularity: 'day' };
      }
      
      if (p === 'year') {
        const targetYear = yr ? Number(yr) : now.getUTCFullYear() + off;
        const start = new Date(Date.UTC(targetYear, 0, 1));
        const end = new Date(Date.UTC(targetYear + 1, 0, 1));
        return { start, end, granularity: 'month' };
      }
      
      const base = startOfUTCDay(now);
      return { start: base, end: new Date(base.getTime() + 24 * 60 * 60 * 1000), granularity: 'day' };
    }

    const {
      start,
      end,
      granularity,
      calendarStart,
    } = getBusinessPeriodRange(period, offset, year);
    const data = [];
    
    // Функция для форматирования даты в SQLite-совместимый формат (YYYY-MM-DD HH:MM:SS)
    function toSqliteDate(date) {
      return toSqliteUtcString(date);
    }

    if (granularity === 'month') {
      // По месяцам для года
      const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
      
      for (let i = 0; i < 12; i++) {
        const { start: monthStart, end: monthEnd } = getBusinessCalendarMonthRange(
          Number(year || calendarStart.year),
          i + 1,
        );
        
        const stats = db.prepare(`
          SELECT 
            COALESCE(COUNT(o.id), 0)                              AS orders,
            COALESCE(SUM(COALESCE(o.final_amount, o.total_amount)), 0) AS revenue,
            COALESCE(SUM(COALESCE(o.profit, 0)), 0)               AS profit
          FROM orders o
          WHERE o.status IN ('completed', 'delivered')
            AND o.paid_at IS NOT NULL
            AND datetime(o.paid_at) >= ?
            AND datetime(o.paid_at) < ?
        `).get(toSqliteDate(monthStart), toSqliteDate(monthEnd));

        // POS продажи за этот месяц
        const posStats = db.prepare(`
          SELECT 
            COALESCE(COUNT(*), 0) AS orders,
            COALESCE(SUM(price), 0) AS revenue,
            COALESCE(SUM(profit), 0) AS profit
          FROM pos_sales
          WHERE status = 'completed'
            AND datetime(completed_at) >= ?
            AND datetime(completed_at) < ?
        `).get(toSqliteDate(monthStart), toSqliteDate(monthEnd));
        
        data.push({
          label: monthNames[i],
          orders: (stats?.orders || 0) + (posStats?.orders || 0),
          revenue: (stats?.revenue || 0) + (posStats?.revenue || 0),
          profit: (stats?.profit || 0) + (posStats?.profit || 0)
        });
      }
    } else if (granularity === 'day') {
      // По дням для месяца
      for (let i = 0; ; i++) {
        const dayParts = shiftBusinessCalendarDate(calendarStart, i);
        const { start: dayStart, end: dayEnd } = getBusinessCalendarDayRange(
          dayParts.year,
          dayParts.month,
          dayParts.day,
        );
        if (dayStart >= end) {
          break;
        }
        
        const stats = db.prepare(`
          SELECT 
            COALESCE(COUNT(o.id), 0)                              AS orders,
            COALESCE(SUM(COALESCE(o.final_amount, o.total_amount)), 0) AS revenue,
            COALESCE(SUM(COALESCE(o.profit, 0)), 0)               AS profit
          FROM orders o
          WHERE o.status IN ('completed', 'delivered')
            AND o.paid_at IS NOT NULL
            AND datetime(o.paid_at) >= ?
            AND datetime(o.paid_at) < ?
        `).get(toSqliteDate(dayStart), toSqliteDate(dayEnd));

        // POS продажи за этот день
        const posStats = db.prepare(`
          SELECT 
            COALESCE(COUNT(*), 0) AS orders,
            COALESCE(SUM(price), 0) AS revenue,
            COALESCE(SUM(profit), 0) AS profit
          FROM pos_sales
          WHERE status = 'completed'
            AND datetime(completed_at) >= ?
            AND datetime(completed_at) < ?
        `).get(toSqliteDate(dayStart), toSqliteDate(dayEnd));
        
        data.push({
          label: getBusinessDayLabel(dayStart),
          orders: (stats?.orders || 0) + (posStats?.orders || 0),
          revenue: (stats?.revenue || 0) + (posStats?.revenue || 0),
          profit: (stats?.profit || 0) + (posStats?.profit || 0)
        });
      }
    }

    res.json(data);
  } catch (error) {
    console.error('[crm] Dashboard timeseries error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// =========================
// EMPLOYEES (Сотрудники)
// =========================
crmRouter.get('/api/admin/crm/employees', authMiddleware, (req, res) => {
  try {
    const employees = db.prepare(`
      SELECT id, username, first_name, last_name, position, active, created_at, updated_at
      FROM employees
      ORDER BY created_at DESC
    `).all();
    res.json(employees);
  } catch (error) {
    console.error('[crm] Get employees error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

crmRouter.post('/api/admin/crm/employees', authMiddleware, async (req, res) => {
  try {
    const { username, password, first_name, last_name, position } = req.body;
    
    if (!username || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    // Проверка на существующий username
    const existing = db.prepare('SELECT id FROM employees WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: 'username_exists' });
    }

    const id = generateId('emp');
    const passwordHash = await bcrypt.hash(password, 10);

    db.prepare(`
      INSERT INTO employees (id, username, password_hash, first_name, last_name, position, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(id, username, passwordHash, first_name, last_name, position || null);

    const employee = db.prepare(`
      SELECT id, username, first_name, last_name, position, active, created_at
      FROM employees WHERE id = ?
    `).get(id);

    res.json(employee);
  } catch (error) {
    console.error('[crm] Create employee error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

crmRouter.patch('/api/admin/crm/employees/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, position, active, password } = req.body;

    const current = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: 'not_found' });
    }

    let updateFields = [];
    let updateValues = [];

    if (first_name !== undefined) {
      updateFields.push('first_name = ?');
      updateValues.push(first_name);
    }
    if (last_name !== undefined) {
      updateFields.push('last_name = ?');
      updateValues.push(last_name);
    }
    if (position !== undefined) {
      updateFields.push('position = ?');
      updateValues.push(position);
    }
    if (active !== undefined) {
      updateFields.push('active = ?');
      updateValues.push(active ? 1 : 0);
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updateFields.push('password_hash = ?');
      updateValues.push(passwordHash);
    }

    if (updateFields.length > 0) {
      updateFields.push("updated_at = DATETIME('now')");
      updateValues.push(id);
      
      db.prepare(`
        UPDATE employees 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `).run(...updateValues);
    }

    const updated = db.prepare(`
      SELECT id, username, first_name, last_name, position, active, created_at, updated_at
      FROM employees WHERE id = ?
    `).get(id);

    res.json(updated);
  } catch (error) {
    console.error('[crm] Update employee error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

crmRouter.delete('/api/admin/crm/employees/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM employees WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (error) {
    console.error('[crm] Delete employee error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// =========================
// CUSTOMERS (Клиенты)
// =========================
crmRouter.get('/api/admin/crm/customers', authMiddleware, (req, res) => {
  try {

    const { filter } = req.query;
    
    let whereClause = '';
    const now = new Date();
    
    if (filter === 'inactive') {
      // Клиенты с последним заказом более 30 дней назад
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      whereClause = `WHERE last_order_at IS NOT NULL AND last_order_at < '${thirtyDaysAgo.toISOString()}'`;
    } else if (filter === 'cold') {
      // Холодные клиенты (зашли, но не заказали)
      whereClause = `WHERE COALESCE(total_orders, 0) = 0`;
    }

    const customers = db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM customer_blocks WHERE customer_id = c.id AND active = 1) as blocked_count
      FROM customers c
      ${whereClause}
      ORDER BY c.last_visit_at DESC, c.created_at DESC
    `).all();

    const visitStmt = db.prepare(`
      SELECT id, page_path, action, visited_at
      FROM visit_logs
      WHERE customer_id = ?
      ORDER BY visited_at DESC
      LIMIT 3
    `);

    const customersWithVisits = customers.map((customer) => ({
      ...customer,
      recent_visits: visitStmt.all(customer.id)
    }));

    res.json(customersWithVisits);
  } catch (error) {
    console.error('[crm] Get customers error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

crmRouter.get('/api/admin/crm/customers/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) {
      return res.status(404).json({ error: 'not_found' });
    }

    const orders = db.prepare(`
      SELECT * FROM orders 
      WHERE customer_id = ? 
      ORDER BY created_at DESC
    `).all(id);

    const blocks = db.prepare(`
      SELECT * FROM customer_blocks 
      WHERE customer_id = ? AND active = 1
    `).all(id);

    const visitLogs = db.prepare(`
      SELECT * FROM visit_logs 
      WHERE customer_id = ? 
      ORDER BY visited_at DESC 
      LIMIT 50
    `).all(id);

    res.json({ ...customer, orders, blocks, visitLogs });
  } catch (error) {
    console.error('[crm] Get customer error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

crmRouter.patch('/api/admin/crm/customers/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { notes, phone } = req.body;

    const current = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: 'not_found' });
    }

    db.prepare(`
      UPDATE customers 
      SET notes = ?, phone = ?, updated_at = DATETIME('now')
      WHERE id = ?
    `).run(notes !== undefined ? notes : current.notes, phone !== undefined ? phone : current.phone, id);

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('[crm] Update customer error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// =========================
// БЛОКИРОВКИ КЛИЕНТОВ
// =========================
// Универсальный create. Принимает либо customer_id (известный клиент),
// либо telegram_username (для превентивных банов).
// duration: { unit: 'minutes'|'hours'|'days'|'forever', value?: number }
crmRouter.post('/api/admin/crm/blocks', authMiddleware, (req, res) => {
  try {
    const { customer_id, telegram_username, reason, duration } = req.body || {};
    if (!customer_id && !telegram_username) {
      return res.status(400).json({ error: 'customer_id_or_telegram_username_required' });
    }
    let block_until = null;
    try {
      block_until = computeBlockUntil(duration || { unit: 'forever' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      const result = createBlock({
        customer_id,
        telegram_username,
        block_until,
        reason: typeof reason === 'string' ? reason.trim() || null : null,
        blocked_by: req.user?.u || 'admin',
      });
      return res.json({ ok: true, kind: result.kind, block: serializeBlock(result.block, result.kind) });
    } catch (err) {
      if (err.code === 'already_blocked') {
        return res.status(409).json({
          error: 'already_blocked',
          existing: serializeBlock(err.existing, 'active'),
        });
      }
      if (err.code === 'customer_not_found') {
        return res.status(404).json({ error: 'customer_not_found' });
      }
      throw err;
    }
  } catch (error) {
    console.error('[crm] Create block error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Снятие блокировки (active customer_blocks).
crmRouter.delete('/api/admin/crm/blocks/:id', authMiddleware, (req, res) => {
  try {
    const updated = unblockCustomerBlock(req.params.id, {
      unblocked_by: req.user?.u || 'admin',
      unblock_reason: typeof req.body?.unblock_reason === 'string' ? req.body.unblock_reason.trim() || null : null,
    });
    if (!updated) {
      // Может быть pending — попробуем удалить
      const removedPending = deletePendingBan(req.params.id);
      if (removedPending) {
        return res.json({ ok: true, kind: 'pending_removed' });
      }
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ ok: true, kind: 'unblocked', block: serializeBlock(updated, 'active') });
  } catch (error) {
    console.error('[crm] Unblock error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Список всех активных блокировок (для раздела «Заблокированные»).
// Включает и реальные блоки и pending — с указанием kind.
crmRouter.get('/api/admin/crm/blocks', authMiddleware, (req, res) => {
  try {
    // Тот же предикат «активный блок», что и в utils/customer-blocks.js,
    // но с явным префиксом cb.* — без хрупких строковых replace.
    const activeBlocks = db.prepare(`
      SELECT cb.*, c.telegram_id, c.telegram_username, c.first_name, c.last_name, c.phone
      FROM customer_blocks cb
      JOIN customers c ON c.id = cb.customer_id
      WHERE cb.active = 1
        AND (cb.block_until IS NULL OR cb.block_until > DATETIME('now'))
      ORDER BY cb.blocked_at DESC
    `).all();

    const pendingBans = db.prepare(`
      SELECT * FROM pending_customer_bans
      WHERE ${PENDING_ACTIVE_PREDICATE}
      ORDER BY created_at DESC
    `).all();

    res.json({
      active: activeBlocks.map((row) => ({
        ...serializeBlock(row, 'active'),
        customer: {
          telegram_id: row.telegram_id,
          telegram_username: row.telegram_username,
          first_name: row.first_name,
          last_name: row.last_name,
          phone: row.phone,
        },
      })),
      pending: pendingBans.map((row) => serializeBlock(row, 'pending')),
    });
  } catch (error) {
    console.error('[crm] List blocks error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Legacy endpoint — оставлен для обратной совместимости с кодом, который ходил
// по /customers/:id/block (например старый CrmCustomerDetail). Внутри использует
// тот же createBlock.
crmRouter.post('/api/admin/crm/customers/:id/block', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
    if (!customer) return res.status(404).json({ error: 'not_found' });
    let block_until = null;
    try {
      block_until = computeBlockUntil(req.body?.duration || { unit: 'forever' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      const result = createBlock({
        customer_id: id,
        block_until,
        reason: req.body?.reason || null,
        blocked_by: req.user?.u || 'admin',
      });
      res.json({ ok: true, blockId: result.block.id });
    } catch (err) {
      if (err.code === 'already_blocked') {
        // Backward-compat: legacy caller (CrmCustomers all-tab, CrmCustomerDetail)
        // ожидает идемпотентного поведения — повторный вызов «заблокировать»
        // когда клиент уже заблокирован не должен бросать. Возвращаем 200
        // с id существующего блока, чтобы UI остался консистентным.
        return res.json({ ok: true, blockId: err.existing?.id ?? null, already_blocked: true });
      }
      throw err;
    }
  } catch (error) {
    console.error('[crm] Legacy block customer error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

crmRouter.post('/api/admin/crm/customers/:id/unblock', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const block = getActiveBlockForCustomerId(id);
    if (!block) return res.json({ ok: true });
    unblockCustomerBlock(block.id, {
      unblocked_by: req.user?.u || 'admin',
      unblock_reason: req.body?.unblock_reason || null,
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('[crm] Legacy unblock customer error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Проверка блокировки (публичный API — миниапка).
// Возвращает полный объект блока для рендера экрана с таймером/датой.
crmRouter.get('/api/customers/:telegramId/check-blocks', (req, res) => {
  try {
    const block = getActiveBlockForTelegramId(req.params.telegramId);
    if (!block) return res.json({ blocked: false });
    res.json({
      blocked: true,
      reason: block.reason || null,
      block_until: block.block_until || null,
      blocked_at: block.blocked_at,
    });
  } catch (error) {
    console.error('[crm] Check blocks error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// =========================
// MESSAGE TEMPLATES (Шаблоны сообщений)
// =========================

// Получить все шаблоны
crmRouter.get('/api/admin/crm/message-templates', authMiddleware, (req, res) => {
  try {
    const templates = db.prepare(`
      SELECT * FROM message_templates
      WHERE active = 1
      ORDER BY created_at DESC
    `).all();
    res.json(templates);
  } catch (error) {
    console.error('[crm] Get message templates error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Получить шаблон по ID
crmRouter.get('/api/admin/crm/message-templates/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const template = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(id);
    
    if (!template) {
      return res.status(404).json({ error: 'not_found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('[crm] Get message template error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Создать шаблон
crmRouter.post('/api/admin/crm/message-templates', authMiddleware, (req, res) => {
  try {
    const { name, content, type = 'order_contact' } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    
    const id = generateId('tpl');
    db.prepare(`
      INSERT INTO message_templates (id, name, content, type, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(id, name, content, type);
    
    const template = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(id);
    res.json(template);
  } catch (error) {
    console.error('[crm] Create message template error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Обновить шаблон
crmRouter.patch('/api/admin/crm/message-templates/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { name, content, type, active } = req.body;
    
    const current = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: 'not_found' });
    }
    
    db.prepare(`
      UPDATE message_templates
      SET name = ?, content = ?, type = ?, active = ?, updated_at = DATETIME('now')
      WHERE id = ?
    `).run(
      name !== undefined ? name : current.name,
      content !== undefined ? content : current.content,
      type !== undefined ? type : current.type,
      active !== undefined ? (active ? 1 : 0) : current.active,
      id
    );
    
    const updated = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('[crm] Update message template error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Удалить шаблон
crmRouter.delete('/api/admin/crm/message-templates/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM message_templates WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (error) {
    console.error('[crm] Delete message template error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// =========================
// CUSTOMER FEEDBACKS (Обратная связь по клиентам)
// =========================

// Получить все feedbacks
crmRouter.get('/api/admin/crm/customer-feedbacks', authMiddleware, (req, res) => {
  try {
    const feedbacks = db.prepare(`
      SELECT * FROM customer_feedbacks
      ORDER BY processed_at DESC
    `).all();
    res.json(feedbacks);
  } catch (error) {
    console.error('[crm] Get customer feedbacks error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Создать feedback
crmRouter.post('/api/admin/crm/customer-feedbacks', authMiddleware, (req, res) => {
  try {
    const { customer_id, reason } = req.body;
    
    if (!customer_id || !reason) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    
    // Получаем информацию о клиенте
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
    if (!customer) {
      return res.status(404).json({ error: 'customer_not_found' });
    }
    
    const id = generateId('feedback');
    const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || null;
    
    db.prepare(`
      INSERT INTO customer_feedbacks (id, customer_id, telegram_username, customer_name, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, customer_id, customer.telegram_username, customerName, reason);
    
    const feedback = db.prepare('SELECT * FROM customer_feedbacks WHERE id = ?').get(id);
    res.json(feedback);
  } catch (error) {
    console.error('[crm] Create customer feedback error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Удалить feedback
crmRouter.delete('/api/admin/crm/customer-feedbacks/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM customer_feedbacks WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (error) {
    console.error('[crm] Delete customer feedback error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Удалить клиента
crmRouter.delete('/api/admin/crm/customers/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверяем, есть ли у клиента заказы
    const orders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE customer_id = ?').get(id);
    if (orders && orders.count > 0) {
      return res.status(400).json({ 
        error: 'has_orders', 
        message: 'Нельзя удалить клиента с заказами' 
      });
    }
    
    // Удаляем клиента (feedbacks и visit_logs удалятся автоматически через CASCADE)
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (error) {
    console.error('[crm] Delete customer error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Сгенерировать сообщение по шаблону для заказа
crmRouter.post('/api/admin/crm/orders/:orderId/generate-message', authMiddleware, (req, res) => {
  try {
    const { orderId } = req.params;
    const { templateId } = req.body;
    
    const order = db.prepare(`
      SELECT 
        o.*,
        COALESCE(o.telegram_username, c.telegram_username) as telegram_username,
        COALESCE(o.phone, c.phone) as phone,
        c.first_name,
        c.last_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ?
    `).get(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'order_not_found' });
    }
    
    const template = templateId
      ? db.prepare('SELECT * FROM message_templates WHERE id = ? AND active = 1').get(templateId)
      : db.prepare('SELECT * FROM message_templates WHERE type = ? AND active = 1 ORDER BY created_at DESC LIMIT 1').get('order_contact');
    
    if (!template) {
      return res.status(404).json({ error: 'template_not_found' });
    }
    
    // Получить позиции заказа
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    const itemsText = items.map(item => `• ${item.product_title} × ${item.quantity} — ${item.total_price}₽`).join('\n');
    
    // Заменить переменные в шаблоне
    let message = template.content;
    message = message.replace(/\[order_number\]/g, order.order_number || '');
    message = message.replace(/\[items\]/g, itemsText || 'Нет позиций');
    message = message.replace(/\[total\]/g, order.final_amount || order.total_amount || 0);
    message = message.replace(/\[phone\]/g, order.phone || 'не указан');
    message = message.replace(/\[address\]/g, order.delivery_address || 'не указан');
    
    res.json({
      message,
      telegramUsername: order.telegram_username,
      templateUsed: template.name
    });
  } catch (error) {
    console.error('[crm] Generate message error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});
