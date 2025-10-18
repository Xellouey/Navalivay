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
    const { period = 'today', startDate, endDate } = req.query;
    
    let dateFilter = '';
    let filterParams = { period, startDate: null, endDate: null };
    const now = new Date();
    
    // Если переданы конкретные даты, используем их
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Конец дня
      dateFilter = `created_at >= '${start.toISOString()}' AND created_at <= '${end.toISOString()}'`;
      filterParams.startDate = start.toISOString();
      filterParams.endDate = end.toISOString();
    } else {
      // Иначе используем старую логику с периодами
      switch (period) {
        case 'today':
          dateFilter = `DATE(created_at) = DATE('now')`;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `created_at >= '${weekAgo.toISOString()}'`;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = `created_at >= '${monthAgo.toISOString()}'`;
          break;
        case 'year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          dateFilter = `created_at >= '${yearAgo.toISOString()}'`;
          break;
        default:
          dateFilter = `DATE(created_at) = DATE('now')`;
      }
    }

    // Выручка, прибыль, количество продаж
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(final_amount), 0) as revenue,
        COALESCE(SUM(profit), 0) as profit
      FROM orders
      WHERE status IN ('completed', 'delivered') AND ${dateFilter}
    `).get();

    // Топ линейки (category groups)
    const topProducts = db.prepare(`
      SELECT 
        COALESCE(g.id, 'no_group') as group_id,
        COALESCE(g.name, 'Без линейки') as group_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total_price) as total_revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN category_groups g ON g.id = p.groupId
      WHERE o.status IN ('completed', 'delivered') AND ${dateFilter}
      GROUP BY group_id, group_name
      ORDER BY total_quantity DESC
      LIMIT 10
    `).all();

    // Статистика по статусам заказов
    const ordersByStatus = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM orders
      WHERE ${dateFilter}
      GROUP BY status
    `).all();

    // Статистика по доставкам с прибылью
    const deliveryStats = db.prepare(`
      SELECT 
        COUNT(*) as deliveries,
        COALESCE(SUM(final_amount), 0) as delivery_revenue,
        COALESCE(SUM(profit), 0) as delivery_profit
      FROM orders
      WHERE delivery_type = 'delivery'
        AND status IN ('completed', 'delivered')
        AND ${dateFilter}
    `).get();

    // Статистика по самовывозу с прибылью
    const pickupStats = db.prepare(`
      SELECT 
        COUNT(*) as pickups,
        COALESCE(SUM(final_amount), 0) as pickup_revenue,
        COALESCE(SUM(profit), 0) as pickup_profit
      FROM orders
      WHERE delivery_type = 'pickup'
        AND status IN ('completed', 'delivered')
        AND ${dateFilter}
    `).get();

    res.json({
      ...filterParams,
      stats: {
        totalSales: stats.total_sales,
        revenue: stats.revenue,
        profit: stats.profit,
        averageCheck: stats.total_sales > 0 ? stats.revenue / stats.total_sales : 0
      },
      topProducts,
      ordersByStatus,
      deliveryStats: {
        deliveries: deliveryStats?.deliveries || 0,
        revenue: deliveryStats?.delivery_revenue || 0,
        profit: deliveryStats?.delivery_profit || 0
      },
      pickupStats: {
        pickups: pickupStats?.pickups || 0,
        revenue: pickupStats?.pickup_revenue || 0,
        profit: pickupStats?.pickup_profit || 0
      }
    });
  } catch (error) {
    console.error('[crm] Dashboard error:', error);
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

// Продолжение в следующем сообщении (файл слишком большой)
