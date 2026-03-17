import express from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';

export const posRouter = express.Router();

// Helper для генерации ID
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Helper для получения следующего номера продажи
function getNextSaleNumber() {
  const row = db.prepare('SELECT MAX(sale_number) as maxNum FROM pos_sales').get();
  return (row?.maxNum || 0) + 1;
}

// =========================
// POS SALES (Продажи через кассу)
// =========================

// Получить все POS-продажи (с фильтрами)
posRouter.get('/api/admin/pos/sales', authMiddleware, (req, res) => {
  try {
    const { status, from, to, limit = 100, offset = 0 } = req.query;
    
    let whereClause = '1=1';
    const params = [];
    
    if (status && ['completed', 'pending'].includes(status)) {
      whereClause += ' AND ps.status = ?';
      params.push(status);
    }
    
    if (from) {
      whereClause += ' AND ps.created_at >= ?';
      params.push(from);
    }
    
    if (to) {
      whereClause += ' AND ps.created_at < ?';
      params.push(to);
    }
    
    const sales = db.prepare(`
      SELECT 
        ps.*,
        e.first_name || ' ' || e.last_name as employee_name
      FROM pos_sales ps
      LEFT JOIN employees e ON e.id = ps.employee_id
      WHERE ${whereClause}
      ORDER BY ps.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), parseInt(offset));
    
    // Получаем общее количество
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM pos_sales ps WHERE ${whereClause}
    `).get(...params);
    
    res.json({
      sales,
      total: countResult.total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('[pos] Get sales error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Получить только отложенные чеки
posRouter.get('/api/admin/pos/pending', authMiddleware, (req, res) => {
  try {
    const sales = db.prepare(`
      SELECT 
        ps.*,
        e.first_name || ' ' || e.last_name as employee_name
      FROM pos_sales ps
      LEFT JOIN employees e ON e.id = ps.employee_id
      WHERE ps.status = 'pending'
      ORDER BY ps.created_at DESC
    `).all();
    
    res.json(sales);
  } catch (error) {
    console.error('[pos] Get pending sales error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Получить статистику POS за период
posRouter.get('/api/admin/pos/stats', authMiddleware, (req, res) => {
  try {
    const { from, to } = req.query;
    
    let whereClause = "status = 'completed'";
    const params = [];
    
    if (from) {
      whereClause += ' AND created_at >= ?';
      params.push(from);
    }
    
    if (to) {
      whereClause += ' AND created_at < ?';
      params.push(to);
    }
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(price), 0) as total_revenue,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(SUM(cost_price), 0) as total_cost
      FROM pos_sales
      WHERE ${whereClause}
    `).get(...params);
    
    const pendingCount = db.prepare(`
      SELECT COUNT(*) as count FROM pos_sales WHERE status = 'pending'
    `).get();
    
    res.json({
      ...stats,
      pending_count: pendingCount.count
    });
  } catch (error) {
    console.error('[pos] Get stats error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Создать продажу
posRouter.post('/api/admin/pos/sales', authMiddleware, (req, res) => {
  try {
    const { product_name, price, cost_price, notes, employee_id } = req.body;
    
    if (!product_name || typeof product_name !== 'string' || !product_name.trim()) {
      return res.status(400).json({ error: 'product_name_required' });
    }
    
    if (price === undefined || price === null || isNaN(Number(price)) || Number(price) <= 0) {
      return res.status(400).json({ error: 'invalid_price' });
    }
    
    const id = generateId('pos');
    const saleNumber = getNextSaleNumber();
    const priceNum = Number(price);
    const now = new Date().toISOString();
    
    // Определяем статус и прибыль
    let status = 'pending';
    let profit = null;
    let costPriceNum = null;
    let completedAt = null;
    
    if (cost_price !== undefined && cost_price !== null && cost_price !== '') {
      costPriceNum = Number(cost_price);
      if (!isNaN(costPriceNum)) {
        status = 'completed';
        profit = priceNum - costPriceNum;
        completedAt = now;
      }
    }
    
    db.prepare(`
      INSERT INTO pos_sales (id, sale_number, product_name, price, cost_price, profit, status, notes, employee_id, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      saleNumber,
      product_name.trim(),
      priceNum,
      costPriceNum,
      profit,
      status,
      notes || null,
      employee_id || null,
      now,
      completedAt
    );
    
    const sale = db.prepare('SELECT * FROM pos_sales WHERE id = ?').get(id);
    
    res.json(sale);
  } catch (error) {
    console.error('[pos] Create sale error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Обновить продажу (дозаполнить себестоимость)
posRouter.patch('/api/admin/pos/sales/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { product_name, price, cost_price, notes } = req.body;
    
    const existing = db.prepare('SELECT * FROM pos_sales WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'not_found' });
    }
    
    const updates = {};
    const now = new Date().toISOString();
    
    if (product_name !== undefined) {
      updates.product_name = product_name.trim();
    }
    
    if (price !== undefined) {
      updates.price = Number(price);
    }
    
    if (notes !== undefined) {
      updates.notes = notes || null;
    }
    
    // Обработка себестоимости
    if (cost_price !== undefined && cost_price !== null && cost_price !== '') {
      const costPriceNum = Number(cost_price);
      if (!isNaN(costPriceNum)) {
        updates.cost_price = costPriceNum;
        const finalPrice = updates.price !== undefined ? updates.price : existing.price;
        updates.profit = finalPrice - costPriceNum;
        updates.status = 'completed';
        updates.completed_at = now;
      }
    }
    
    // Строим UPDATE запрос
    const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    if (setClauses) {
      db.prepare(`UPDATE pos_sales SET ${setClauses} WHERE id = ?`).run(...values, id);
    }
    
    const sale = db.prepare('SELECT * FROM pos_sales WHERE id = ?').get(id);
    
    res.json(sale);
  } catch (error) {
    console.error('[pos] Update sale error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Удалить продажу
posRouter.delete('/api/admin/pos/sales/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM pos_sales WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'not_found' });
    }
    
    db.prepare('DELETE FROM pos_sales WHERE id = ?').run(id);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('[pos] Delete sale error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});
