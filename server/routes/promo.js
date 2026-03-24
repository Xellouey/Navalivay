import express from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';

export const promoRouter = express.Router();

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// =========================
// PROMO CODES (Промокоды) - Admin API
// =========================

// GET /api/admin/crm/promo-codes - список промокодов
promoRouter.get('/api/admin/crm/promo-codes', authMiddleware, (req, res) => {
  try {
    const { search, filter, limit = 50, offset = 0 } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (pc.code LIKE ? OR pc.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (filter === 'active') {
      whereClause += " AND pc.active = 1 AND (pc.valid_until IS NULL OR pc.valid_until >= DATETIME('now')) AND (pc.max_uses = 0 OR pc.current_uses < pc.max_uses)";
    } else if (filter === 'expired') {
      whereClause += " AND pc.valid_until IS NOT NULL AND pc.valid_until < DATETIME('now')";
    } else if (filter === 'exhausted') {
      whereClause += ' AND pc.max_uses > 0 AND pc.current_uses >= pc.max_uses';
    } else if (filter === 'inactive') {
      whereClause += ' AND pc.active = 0';
    }

    const promoCodes = db.prepare(`
      SELECT pc.*
      FROM promo_codes pc
      WHERE ${whereClause}
      ORDER BY pc.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), parseInt(offset));

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM promo_codes pc WHERE ${whereClause}
    `).get(...params);

    res.json({
      promo_codes: promoCodes,
      total: countResult.total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('[promo] Get promo codes error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// GET /api/admin/crm/promo-codes/:id - детали промокода
promoRouter.get('/api/admin/crm/promo-codes/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const promo = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(id);
    if (!promo) {
      return res.status(404).json({ error: 'not_found' });
    }

    const usage = db.prepare(`
      SELECT 
        pu.*,
        o.order_number,
        c.telegram_username,
        c.first_name || ' ' || COALESCE(c.last_name, '') as customer_name
      FROM promo_usage pu
      LEFT JOIN orders o ON o.id = pu.order_id
      LEFT JOIN customers c ON c.id = pu.customer_id
      WHERE pu.promo_code_id = ?
      ORDER BY pu.used_at DESC
    `).all(id);

    res.json({ ...promo, usage });
  } catch (error) {
    console.error('[promo] Get promo code detail error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// GET /api/admin/crm/promo-codes/:id/usage - история использований
promoRouter.get('/api/admin/crm/promo-codes/:id/usage', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const usage = db.prepare(`
      SELECT 
        pu.*,
        o.order_number,
        o.final_amount as order_amount,
        c.telegram_username,
        c.first_name || ' ' || COALESCE(c.last_name, '') as customer_name
      FROM promo_usage pu
      LEFT JOIN orders o ON o.id = pu.order_id
      LEFT JOIN customers c ON c.id = pu.customer_id
      WHERE pu.promo_code_id = ?
      ORDER BY pu.used_at DESC
    `).all(id);

    res.json(usage);
  } catch (error) {
    console.error('[promo] Get promo usage error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// POST /api/admin/crm/promo-codes - создать промокод
promoRouter.post('/api/admin/crm/promo-codes', authMiddleware, (req, res) => {
  try {
    const {
      code,
      description,
      discount_type = 'fixed',
      discount_value,
      min_order_amount = 0,
      max_uses = 1,
      valid_from,
      valid_until,
      active = true,
    } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: 'code_required', message: 'Код промокода обязателен' });
    }

    if (discount_value === undefined || discount_value === null || Number(discount_value) <= 0) {
      return res.status(400).json({ error: 'invalid_discount', message: 'Значение скидки должно быть больше 0' });
    }

    if (!['fixed', 'percent'].includes(discount_type)) {
      return res.status(400).json({ error: 'invalid_discount_type', message: 'Тип скидки: fixed или percent' });
    }

    if (discount_type === 'percent' && Number(discount_value) > 100) {
      return res.status(400).json({ error: 'invalid_percent', message: 'Процент скидки не может быть больше 100' });
    }

    const cleanCode = code.trim().toUpperCase();

    // Check uniqueness
    const existing = db.prepare('SELECT id FROM promo_codes WHERE code = ?').get(cleanCode);
    if (existing) {
      return res.status(409).json({ error: 'code_exists', message: 'Промокод с таким кодом уже существует' });
    }

    const id = generateId('promo');

    db.prepare(`
      INSERT INTO promo_codes (id, code, description, discount_type, discount_value, min_order_amount, max_uses, valid_from, valid_until, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      cleanCode,
      description || null,
      discount_type,
      Number(discount_value),
      Number(min_order_amount) || 0,
      Number(max_uses) || 0,
      valid_from || null,
      valid_until || null,
      active ? 1 : 0,
    );

    const promo = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(id);
    res.json(promo);
  } catch (error) {
    console.error('[promo] Create promo code error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// PATCH /api/admin/crm/promo-codes/:id - обновить промокод
promoRouter.patch('/api/admin/crm/promo-codes/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'not_found' });
    }

    const {
      code,
      description,
      discount_type,
      discount_value,
      min_order_amount,
      max_uses,
      valid_from,
      valid_until,
      active,
    } = req.body;

    const updates = {};

    if (code !== undefined) {
      const cleanCode = code.trim().toUpperCase();
      // Check uniqueness (excluding self)
      const dup = db.prepare('SELECT id FROM promo_codes WHERE code = ? AND id != ?').get(cleanCode, id);
      if (dup) {
        return res.status(409).json({ error: 'code_exists', message: 'Промокод с таким кодом уже существует' });
      }
      updates.code = cleanCode;
    }

    if (description !== undefined) updates.description = description || null;
    if (discount_type !== undefined) {
      if (!['fixed', 'percent'].includes(discount_type)) {
        return res.status(400).json({ error: 'invalid_discount_type' });
      }
      updates.discount_type = discount_type;
    }
    if (discount_value !== undefined) updates.discount_value = Number(discount_value);
    if (min_order_amount !== undefined) updates.min_order_amount = Number(min_order_amount) || 0;
    if (max_uses !== undefined) updates.max_uses = Number(max_uses) || 0;
    if (valid_from !== undefined) updates.valid_from = valid_from || null;
    if (valid_until !== undefined) updates.valid_until = valid_until || null;
    if (active !== undefined) updates.active = active ? 1 : 0;

    const setClauses = Object.keys(updates).map((key) => `${key} = ?`).join(', ');
    const values = Object.values(updates);

    if (setClauses) {
      db.prepare(`UPDATE promo_codes SET ${setClauses} WHERE id = ?`).run(...values, id);
    }

    const promo = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(id);
    res.json(promo);
  } catch (error) {
    console.error('[promo] Update promo code error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// DELETE /api/admin/crm/promo-codes/:id - удалить промокод
promoRouter.delete('/api/admin/crm/promo-codes/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'not_found' });
    }

    // If used - soft delete (deactivate), otherwise hard delete
    if (existing.current_uses > 0) {
      db.prepare('UPDATE promo_codes SET active = 0 WHERE id = ?').run(id);
    } else {
      db.prepare('DELETE FROM promo_codes WHERE id = ?').run(id);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[promo] Delete promo code error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});
