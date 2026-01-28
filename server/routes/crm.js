import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';

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

    function getPeriodRange(p, off) {
      const now = new Date();
      // Use UTC boundaries to match ISO timestamps stored in DB
      function startOfUTCDay(d) {
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      }
      if (p === 'today') {
        const base = startOfUTCDay(now);
        const start = new Date(base.getTime() + off * 24 * 60 * 60 * 1000);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        return { start, end };
      }
      if (p === 'week') {
        const d = startOfUTCDay(now);
        // ISO week starts on Monday
        const day = d.getUTCDay() || 7; // 1..7
        const monday = new Date(d.getTime() - (day - 1) * 24 * 60 * 60 * 1000);
        const start = new Date(monday.getTime() + off * 7 * 24 * 60 * 60 * 1000);
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start, end };
      }
      if (p === 'month') {
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth();
        const start = new Date(Date.UTC(y, m + off, 1));
        const end = new Date(Date.UTC(y, m + off + 1, 1));
        return { start, end };
      }
      if (p === 'year') {
        const y = now.getUTCFullYear();
        const start = new Date(Date.UTC(y + off, 0, 1));
        const end = new Date(Date.UTC(y + off + 1, 0, 1));
        return { start, end };
      }
      const base = startOfUTCDay(now);
      return { start: base, end: new Date(base.getTime() + 24 * 60 * 60 * 1000) };
    }

    const { start, end } = getPeriodRange(period, offset);
    // Для статистики заказов используем created_at
    const createdAtFilter = `created_at >= '${start.toISOString()}' AND created_at < '${end.toISOString()}'`;
    // Для финансовой статистики используем paid_at (дата оплаты/выдачи)
    const paidAtFilter = `paid_at >= '${start.toISOString()}' AND paid_at < '${end.toISOString()}'`;

    // Выручка, прибыль, количество продаж - по дате ОПЛАТЫ (paid_at)
    const stats = db.prepare(`
      SELECT 
        COALESCE(COUNT(DISTINCT o.id), 0)                   AS total_sales,
        COALESCE(SUM(oi.total_price), 0)                    AS revenue,
        COALESCE(SUM(oi.total_price - oi.total_cost), 0)    AS profit,
        COALESCE(COUNT(DISTINCT o.customer_id), 0)          AS unique_customers
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status IN ('completed', 'delivered') AND o.paid_at IS NOT NULL AND ${paidAtFilter}
    `).get();

    // Топ линейки (category groups) - по дате ОПЛАТЫ (paid_at)
    const topProducts = db.prepare(`
      SELECT 
        COALESCE(g.id, 'no_group') as group_id,
        COALESCE(g.name, 'Без линейки') as group_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total_price) as total_revenue,
        SUM(oi.total_price - oi.total_cost) as total_profit
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN category_groups g ON g.id = p.groupId
      WHERE o.status IN ('completed', 'delivered') AND o.paid_at IS NOT NULL AND ${paidAtFilter}
      GROUP BY group_id, group_name
      ORDER BY total_profit DESC
      LIMIT 5
    `).all();

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
        totalSales: stats.total_sales,
        revenue: stats.revenue,
        profit: stats.profit,
        averageCheck: stats.total_sales > 0 ? stats.revenue / stats.total_sales : 0,
        uniqueCustomers: stats.unique_customers || 0
      },
      topProducts,
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

    const { start, end, granularity } = getPeriodRange(period, offset, year);
    const data = [];

    if (granularity === 'month') {
      // По месяцам для года
      const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
      
      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(Date.UTC(start.getUTCFullYear(), i, 1));
        const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), i + 1, 1));
        
        const stats = db.prepare(`
          SELECT 
            COALESCE(COUNT(DISTINCT o.id), 0)                 AS orders,
            COALESCE(SUM(oi.total_price), 0)                  AS revenue,
            COALESCE(SUM(oi.total_price - oi.total_cost), 0)  AS profit
          FROM orders o
          LEFT JOIN order_items oi ON oi.order_id = o.id
          WHERE o.status IN ('completed', 'delivered')
            AND o.paid_at IS NOT NULL
            AND o.paid_at >= ?
            AND o.paid_at < ?
        `).get(monthStart.toISOString(), monthEnd.toISOString());
        
        data.push({
          label: monthNames[i],
          orders: stats?.orders || 0,
          revenue: stats?.revenue || 0,
          profit: stats?.profit || 0
        });
      }
    } else if (granularity === 'day') {
      // По дням для месяца
      const daysInPeriod = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
      
      for (let i = 0; i < daysInPeriod; i++) {
        const dayStart = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        
        const stats = db.prepare(`
          SELECT 
            COALESCE(COUNT(DISTINCT o.id), 0)                 AS orders,
            COALESCE(SUM(oi.total_price), 0)                  AS revenue,
            COALESCE(SUM(oi.total_price - oi.total_cost), 0)  AS profit
          FROM orders o
          LEFT JOIN order_items oi ON oi.order_id = o.id
          WHERE o.status IN ('completed', 'delivered')
            AND o.paid_at IS NOT NULL
            AND o.paid_at >= ?
            AND o.paid_at < ?
        `).get(dayStart.toISOString(), dayEnd.toISOString());
        
        data.push({
          label: String(dayStart.getUTCDate()),
          orders: stats?.orders || 0,
          revenue: stats?.revenue || 0,
          profit: stats?.profit || 0
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

// Блокировка/разблокировка доставки
crmRouter.post('/api/admin/crm/customers/:id/block', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) {
      return res.status(404).json({ error: 'not_found' });
    }

    // Проверяем, есть ли уже активная блокировка
    const existing = db.prepare(`
      SELECT id FROM customer_blocks 
      WHERE customer_id = ? AND block_type = 'delivery' AND active = 1
    `).get(id);

    if (existing) {
      return res.status(400).json({ error: 'already_blocked' });
    }

    const blockId = generateId('block');
    db.prepare(`
      INSERT INTO customer_blocks (id, customer_id, block_type, reason, active)
      VALUES (?, ?, 'delivery', ?, 1)
    `).run(blockId, id, reason || null);

    res.json({ ok: true, blockId });
  } catch (error) {
    console.error('[crm] Block customer error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

crmRouter.post('/api/admin/crm/customers/:id/unblock', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    db.prepare(`
      UPDATE customer_blocks 
      SET active = 0 
      WHERE customer_id = ? AND block_type = 'delivery' AND active = 1
    `).run(id);

    res.json({ ok: true });
  } catch (error) {
    console.error('[crm] Unblock customer error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Проверка блокировки (для публичного API)
crmRouter.get('/api/customers/:telegramId/check-blocks', (req, res) => {
  try {
    const { telegramId } = req.params;
    
    const customer = db.prepare(`
      SELECT id FROM customers WHERE telegram_id = ?
    `).get(telegramId);

    if (!customer) {
      return res.json({ blocked: false });
    }

    const block = db.prepare(`
      SELECT * FROM customer_blocks 
      WHERE customer_id = ? AND block_type = 'delivery' AND active = 1
    `).get(customer.id);

    res.json({ 
      blocked: !!block,
      reason: block?.reason || null
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
