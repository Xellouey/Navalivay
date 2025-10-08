import express from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';

export const crmFinanceRouter = express.Router();

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
// WRITE-OFFS (Списания)
// =========================
crmFinanceRouter.get('/api/admin/crm/write-offs', authMiddleware, (req, res) => {
  try {
    const writeOffs = db.prepare(`
      SELECT w.*, e.first_name || ' ' || e.last_name as employee_name
      FROM write_offs w
      LEFT JOIN employees e ON e.id = w.employee_id
      ORDER BY w.created_at DESC
    `).all();

    res.json(writeOffs);
  } catch (error) {
    console.error('[crm] Get write-offs error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

crmFinanceRouter.get('/api/admin/crm/write-offs/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    const writeOff = db.prepare('SELECT * FROM write_offs WHERE id = ?').get(id);
    if (!writeOff) {
      return res.status(404).json({ error: 'not_found' });
    }

    const items = db.prepare(`
      SELECT wi.*, p.title as product_title, p.stock
      FROM writeoff_items wi
      JOIN products p ON p.id = wi.product_id
      WHERE wi.writeoff_id = ?
    `).all(id);

    res.json({ ...writeOff, items });
  } catch (error) {
    console.error('[crm] Get write-off error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Создание списания
crmFinanceRouter.post('/api/admin/crm/write-offs', authMiddleware, (req, res) => {
  try {
    const { reason, items, notes } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'reason_required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items_required' });
    }

    const writeOffId = generateId('wo');
    const writeOffNumber = getNextNumber('write_offs', 'writeoff_number');

    const tx = db.transaction(() => {
      // Создаем списание
      db.prepare(`
        INSERT INTO write_offs (id, writeoff_number, reason, notes)
        VALUES (?, ?, ?, ?)
      `).run(writeOffId, writeOffNumber, reason, notes || null);

      // Добавляем позиции и уменьшаем остатки
      for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (!product) {
          throw new Error(`Product not found: ${item.product_id}`);
        }

        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.title}`);
        }

        const costPerUnit = product.cost_price || 0;
        const totalCost = costPerUnit * item.quantity;

        db.prepare(`
          INSERT INTO writeoff_items (id, writeoff_id, product_id, quantity, cost_per_unit, total_cost)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(generateId('wi'), writeOffId, item.product_id, item.quantity, costPerUnit, totalCost);

        // Уменьшаем остаток
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
          .run(item.quantity, item.product_id);
      }
    });

    tx();

    const writeOff = db.prepare('SELECT * FROM write_offs WHERE id = ?').get(writeOffId);
    const writeOffItems = db.prepare(`
      SELECT wi.*, p.title as product_title
      FROM writeoff_items wi
      JOIN products p ON p.id = wi.product_id
      WHERE wi.writeoff_id = ?
    `).all(writeOffId);

    res.json({ ...writeOff, items: writeOffItems });
  } catch (error) {
    console.error('[crm] Create write-off error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Обновление списания
crmFinanceRouter.patch('/api/admin/crm/write-offs/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { reason, notes, items } = req.body || {};

    const writeOff = db.prepare('SELECT * FROM write_offs WHERE id = ?').get(id);
    if (!writeOff) {
      return res.status(404).json({ error: 'not_found' });
    }

    const tx = db.transaction(() => {
      if (reason !== undefined || notes !== undefined) {
        db.prepare(`
          UPDATE write_offs
          SET reason = ?, notes = ?
          WHERE id = ?
        `).run(
          reason !== undefined ? reason : writeOff.reason,
          notes !== undefined ? notes : writeOff.notes,
          id
        );
      }

      if (Array.isArray(items)) {
        if (items.length === 0) {
          throw new Error('items_required');
        }

        const existingItems = db.prepare('SELECT * FROM writeoff_items WHERE writeoff_id = ?').all(id);
        for (const existing of existingItems) {
          db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
            .run(existing.quantity, existing.product_id);
        }

        db.prepare('DELETE FROM writeoff_items WHERE writeoff_id = ?').run(id);

        for (const item of items) {
          if (!item || !item.product_id) {
            throw new Error('invalid_item');
          }

          const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
          if (!product) {
            throw new Error(`Product not found: ${item.product_id}`);
          }

          const quantity = Number(item.quantity || 0);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error('invalid_quantity');
          }

          if (Number(product.stock || 0) < quantity) {
            throw new Error(`Insufficient stock for ${product.title}`);
          }

          const costPerUnit = Number(product.cost_price || 0);
          const totalCost = costPerUnit * quantity;

          db.prepare(`
            INSERT INTO writeoff_items (id, writeoff_id, product_id, quantity, cost_per_unit, total_cost)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(generateId('wi'), id, item.product_id, quantity, costPerUnit, totalCost);

          db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
            .run(quantity, item.product_id);
        }
      }
    });

    tx();

    const updated = db.prepare('SELECT * FROM write_offs WHERE id = ?').get(id);
    const updatedItems = db.prepare(`
      SELECT wi.*, p.title as product_title, p.stock
      FROM writeoff_items wi
      JOIN products p ON p.id = wi.product_id
      WHERE wi.writeoff_id = ?
    `).all(id);

    res.json({ ...updated, items: updatedItems });
  } catch (error) {
    console.error('[crm] Update write-off error:', error);
    const clientErrors = new Set(['items_required', 'invalid_item', 'invalid_quantity']);
    if (clientErrors.has(error.message) || error.message?.startsWith('Insufficient stock')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Удаление списания
crmFinanceRouter.delete('/api/admin/crm/write-offs/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const writeOff = db.prepare('SELECT * FROM write_offs WHERE id = ?').get(id);
    if (!writeOff) {
      return res.status(404).json({ error: 'not_found' });
    }

    const items = db.prepare('SELECT * FROM writeoff_items WHERE writeoff_id = ?').all(id);

    const tx = db.transaction(() => {
      for (const item of items) {
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
          .run(item.quantity, item.product_id);
      }

      db.prepare('DELETE FROM writeoff_items WHERE writeoff_id = ?').run(id);
      db.prepare('DELETE FROM write_offs WHERE id = ?').run(id);
    });

    tx();

    res.json({ ok: true });
  } catch (error) {
    console.error('[crm] Delete write-off error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// =========================
// CASH ACCOUNTS (Счета/кассы)
// =========================
crmFinanceRouter.get('/api/admin/crm/cash-accounts', authMiddleware, (req, res) => {
  try {
    const accounts = db.prepare('SELECT * FROM cash_accounts WHERE active = 1 ORDER BY is_default DESC, created_at ASC').all();
    res.json(accounts);
  } catch (error) {
    console.error('[crm] Get cash accounts error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

crmFinanceRouter.post('/api/admin/crm/cash-accounts', authMiddleware, (req, res) => {
  try {
    const { name, balance = 0, is_default = false } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name_required' });
    }

    const id = generateId('acc');

    // Если это дефолтный счет, убираем флаг у других
    if (is_default) {
      db.prepare('UPDATE cash_accounts SET is_default = 0').run();
    }

    db.prepare(`
      INSERT INTO cash_accounts (id, name, balance, is_default, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(id, name, balance, is_default ? 1 : 0);

    const account = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(id);
    res.json(account);
  } catch (error) {
    console.error('[crm] Create cash account error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

crmFinanceRouter.patch('/api/admin/crm/cash-accounts/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_default } = req.body;

    const account = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(id);
    if (!account) {
      return res.status(404).json({ error: 'not_found' });
    }

    const tx = db.transaction(() => {
      if (is_default) {
        db.prepare('UPDATE cash_accounts SET is_default = 0').run();
      }

      db.prepare(`
        UPDATE cash_accounts 
        SET name = ?, is_default = ?
        WHERE id = ?
      `).run(name !== undefined ? name : account.name, is_default ? 1 : account.is_default, id);
    });

    tx();

    const updated = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('[crm] Update cash account error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// =========================
// CASH TRANSACTIONS (Движения денег)
// =========================
crmFinanceRouter.get('/api/admin/crm/cash-transactions', authMiddleware, (req, res) => {
  try {
    const { account_id, type, limit = 50, offset = 0 } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (account_id) {
      whereClause = 'WHERE ct.account_id = ?';
      params.push(account_id);
    }
    
    if (type && whereClause) {
      whereClause += ' AND ct.type = ?';
      params.push(type);
    } else if (type) {
      whereClause = 'WHERE ct.type = ?';
      params.push(type);
    }

    const transactions = params.length > 0
      ? db.prepare(`
          SELECT 
            ct.*,
            ca.name as account_name,
            e.first_name || ' ' || e.last_name as employee_name
          FROM cash_transactions ct
          JOIN cash_accounts ca ON ca.id = ct.account_id
          LEFT JOIN employees e ON e.id = ct.employee_id
          ${whereClause}
          ORDER BY ct.created_at DESC
          LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), parseInt(offset))
      : db.prepare(`
          SELECT 
            ct.*,
            ca.name as account_name,
            e.first_name || ' ' || e.last_name as employee_name
          FROM cash_transactions ct
          JOIN cash_accounts ca ON ca.id = ct.account_id
          LEFT JOIN employees e ON e.id = ct.employee_id
          ORDER BY ct.created_at DESC
          LIMIT ? OFFSET ?
        `).all(parseInt(limit), parseInt(offset));

    res.json(transactions);
  } catch (error) {
    console.error('[crm] Get transactions error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Ручное добавление прихода/расхода
crmFinanceRouter.post('/api/admin/crm/cash-transactions', authMiddleware, (req, res) => {
  try {
    const { account_id, type, amount, description } = req.body;

    if (!account_id || !type || !amount) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'invalid_type' });
    }

    const account = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(account_id);
    if (!account) {
      return res.status(404).json({ error: 'account_not_found' });
    }

    const id = generateId('trans');

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO cash_transactions (id, account_id, type, amount, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, account_id, type, amount, description || null);

      // Обновляем баланс счета
      if (type === 'income') {
        db.prepare('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?')
          .run(amount, account_id);
      } else {
        db.prepare('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?')
          .run(amount, account_id);
      }
    });

    tx();

    const transaction = db.prepare(`
      SELECT 
        ct.*,
        ca.name as account_name
      FROM cash_transactions ct
      JOIN cash_accounts ca ON ca.id = ct.account_id
      WHERE ct.id = ?
    `).get(id);

    res.json(transaction);
  } catch (error) {
    console.error('[crm] Create transaction error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

crmFinanceRouter.delete('/api/admin/crm/cash-transactions/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const transaction = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(id);
    if (!transaction) {
      return res.status(404).json({ error: 'not_found' });
    }

    if (transaction.order_id) {
      return res.status(409).json({ error: 'linked_order' });
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM cash_transactions WHERE id = ?').run(id);

      if (transaction.account_id && transaction.amount) {
        if (transaction.type === 'income') {
          db.prepare('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?')
            .run(transaction.amount, transaction.account_id);
        } else if (transaction.type === 'expense') {
          db.prepare('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?')
            .run(transaction.amount, transaction.account_id);
        }
      }
    });

    tx();

    res.json({ ok: true });
  } catch (error) {
    console.error('[crm] Delete transaction error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// =========================
// VISIT TRACKING (Отслеживание посещений)
// =========================
// Логирование посещений (публичный endpoint)
crmFinanceRouter.post('/api/visits/log', (req, res) => {
  try {
    const { telegram_id, telegram_username, page_path, action } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id_required' });
    }

    // Находим или создаем клиента
    let customer = db.prepare('SELECT * FROM customers WHERE telegram_id = ?').get(telegram_id);

    const tx = db.transaction(() => {
      if (!customer) {
        const customerId = generateId('cust');
        db.prepare(`
          INSERT INTO customers (id, telegram_id, telegram_username, first_visit_at, last_visit_at)
          VALUES (?, ?, ?, DATETIME('now'), DATETIME('now'))
        `).run(customerId, telegram_id, telegram_username || null);
        customer = { id: customerId };
      } else {
        // Обновляем last_visit_at
        db.prepare(`
          UPDATE customers SET last_visit_at = DATETIME('now'), updated_at = DATETIME('now')
          WHERE id = ?
        `).run(customer.id);
      }

      // Логируем посещение
      const logId = generateId('visit');
      db.prepare(`
        INSERT INTO visit_logs (id, customer_id, telegram_id, telegram_username, page_path, action)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(logId, customer.id, telegram_id, telegram_username || null, page_path || null, action || null);
    });

    tx();

    res.json({ ok: true });
  } catch (error) {
    console.error('[visits] Log visit error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Получение visit logs для клиента (для админки)
crmFinanceRouter.get('/api/admin/crm/visit-logs', authMiddleware, (req, res) => {
  try {
    const { customer_id, telegram_id } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (customer_id) {
      whereClause = 'WHERE customer_id = ?';
      params.push(customer_id);
    } else if (telegram_id) {
      whereClause = 'WHERE telegram_id = ?';
      params.push(telegram_id);
    }

    const logs = params.length > 0
      ? db.prepare(`
          SELECT * FROM visit_logs
          ${whereClause}
          ORDER BY visited_at DESC
          LIMIT 100
        `).all(...params)
      : db.prepare(`
          SELECT * FROM visit_logs
          ORDER BY visited_at DESC
          LIMIT 100
        `).all();

    res.json(logs);
  } catch (error) {
    console.error('[crm] Get visit logs error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// =========================
// PRODUCTS LOW STOCK (Товары с минимальным остатком)
// =========================
crmFinanceRouter.get('/api/admin/crm/products/low-stock', authMiddleware, (req, res) => {
  try {
    const products = db.prepare(`
      SELECT 
        p.*,
        c.name as category_name,
        g.name as group_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.categoryId
      LEFT JOIN category_groups g ON g.id = p.groupId
      WHERE p.min_stock > 0 AND p.stock <= p.min_stock
      ORDER BY (p.stock - p.min_stock) ASC
    `).all();

    res.json(products);
  } catch (error) {
    console.error('[crm] Get low stock products error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});
