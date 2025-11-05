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

crmFinanceRouter.patch('/api/admin/crm/cash-transactions/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { account_id, type, amount, description } = req.body || {};

    const existing = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'not_found' });
    }

    if (existing.order_id) {
      return res.status(409).json({ error: 'linked_order' });
    }

    const nextAccountId = account_id ?? existing.account_id;
    const nextType = type ?? existing.type;
    const nextAmount = amount !== undefined ? Number(amount) : existing.amount;
    const nextDescription = description !== undefined ? (description ? String(description) : null) : existing.description;

    if (!['income', 'expense'].includes(nextType)) {
      return res.status(400).json({ error: 'invalid_type' });
    }

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      return res.status(400).json({ error: 'invalid_amount' });
    }

    const account = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(nextAccountId);
    if (!account) {
      return res.status(404).json({ error: 'account_not_found' });
    }

    const tx = db.transaction(() => {
      if (existing.type === 'income') {
        db.prepare('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?')
          .run(existing.amount, existing.account_id);
      } else if (existing.type === 'expense') {
        db.prepare('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?')
          .run(existing.amount, existing.account_id);
      }

      if (nextType === 'income') {
        db.prepare('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?')
          .run(nextAmount, nextAccountId);
      } else {
        db.prepare('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?')
          .run(nextAmount, nextAccountId);
      }

      db.prepare(`
        UPDATE cash_transactions
        SET account_id = ?, type = ?, amount = ?, description = ?
        WHERE id = ?
      `).run(nextAccountId, nextType, nextAmount, nextDescription, id);
    });

    tx();

    const transaction = db.prepare(`
      SELECT 
        ct.*,
        ca.name as account_name,
        e.first_name || ' ' || e.last_name as employee_name
      FROM cash_transactions ct
      JOIN cash_accounts ca ON ca.id = ct.account_id
      LEFT JOIN employees e ON e.id = ct.employee_id
      WHERE ct.id = ?
    `).get(id);

    res.json(transaction);
  } catch (error) {
    console.error('[crm] Update transaction error:', error);
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
    const {
      telegram_id,
      telegram_username,
      first_name,
      last_name,
      page_path,
      action
    } = req.body || {};

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id_required' });
    }

    const telegramId = String(telegram_id);
    const username = typeof telegram_username === 'string' && telegram_username.trim() !== ''
      ? telegram_username.trim()
      : null;
    const firstName = typeof first_name === 'string' && first_name.trim() !== ''
      ? first_name.trim()
      : null;
    const lastName = typeof last_name === 'string' && last_name.trim() !== ''
      ? last_name.trim()
      : null;
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      let customer = db.prepare('SELECT id FROM customers WHERE telegram_id = ?').get(telegramId);

      if (!customer) {
        const customerId = generateId('cust');
        db.prepare(`
          INSERT INTO customers (
            id, telegram_id, telegram_username, first_name, last_name,
            first_visit_at, last_visit_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          customerId,
          telegramId,
          username,
          firstName,
          lastName,
          now,
          now,
          now,
          now
        );
        customer = { id: customerId };
      } else {
        db.prepare(`
          UPDATE customers
          SET telegram_username = COALESCE(?, telegram_username),
              first_name = CASE WHEN ? IS NOT NULL THEN ? ELSE first_name END,
              last_name = CASE WHEN ? IS NOT NULL THEN ? ELSE last_name END,
              first_visit_at = COALESCE(first_visit_at, ?),
              last_visit_at = ?,
              updated_at = ?
          WHERE id = ?
        `).run(
          username,
          firstName,
          firstName,
          lastName,
          lastName,
          now,
          now,
          now,
          customer.id
        );
      }

      const customerId = customer.id;

      const logId = generateId('visit');
      db.prepare(`
        INSERT INTO visit_logs (id, customer_id, telegram_id, telegram_username, page_path, action)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        logId,
        customerId,
        telegramId,
        username,
        typeof page_path === 'string' ? page_path : null,
        typeof action === 'string' ? action : null
      );

      const stats = db.prepare(`
        SELECT
          COUNT(*) AS total_orders,
          COALESCE(SUM(final_amount), 0) AS total_spent,
          MAX(created_at) AS last_order_at
        FROM orders
        WHERE customer_id = ?
      `).get(customerId);

      db.prepare(`
        UPDATE customers
        SET total_orders = ?,
            total_spent = ?,
            last_order_at = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        Number(stats?.total_orders ?? 0),
        Number(stats?.total_spent ?? 0),
        stats?.last_order_at ?? null,
        now,
        customerId
      );
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
// PRODUCTS SEARCH FOR CRM (Поиск товаров для CRM)
// =========================
crmFinanceRouter.get('/api/admin/crm/products/search', authMiddleware, (req, res) => {
  try {
    const { search, limit = 25 } = req.query;
    
    let whereClauses = [];
    let params = [];
    
    if (search && typeof search === 'string' && search.trim()) {
      // SQLite's LOWER() не работает с кириллицей, поэтому ищем по обоим вариантам
      const trimmed = search.trim();
      const lowerPattern = `%${trimmed.toLowerCase()}%`;
      const upperPattern = `%${trimmed.toUpperCase()}%`;
      const titlePattern = `%${trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()}%`;
      
      whereClauses.push('(p.title LIKE ? OR p.title LIKE ? OR p.title LIKE ? OR p.description LIKE ? OR p.description LIKE ? OR p.description LIKE ? OR g.name LIKE ? OR g.name LIKE ? OR g.name LIKE ?)');
      params.push(lowerPattern, upperPattern, titlePattern, lowerPattern, upperPattern, titlePattern, lowerPattern, upperPattern, titlePattern);
    }
    
    const searchCondition = whereClauses.length > 0 ? whereClauses.join(' AND ') : '';
    
    // Получаем обычные товары
    const regularQuery = `
      SELECT 
        p.*,
        c.name as category_name,
        g.name as group_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.categoryId
      LEFT JOIN category_groups g ON g.id = p.groupId
      WHERE p.has_variants = 0${searchCondition ? ` AND ${searchCondition}` : ''}
      LIMIT ?
    `;
    
    const regularProducts = params.length > 0 
      ? db.prepare(regularQuery).all(...params, Number(limit))
      : db.prepare(`
          SELECT 
            p.*,
            c.name as category_name,
            g.name as group_name
          FROM products p
          LEFT JOIN categories c ON c.id = p.categoryId
          LEFT JOIN category_groups g ON g.id = p.groupId
          WHERE p.has_variants = 0
          LIMIT ?
        `).all(Number(limit));
    
    // Получаем варианты как отдельные товары
    const variantsQuery = `
      SELECT 
        v.id,
        v.product_id,
        v.name as variant_name,
        v.color_code,
        v.price_rub,
        v.stock,
        p.id as base_product_id,
        p.title as base_product_title,
        p.cost_price,
        p.min_stock,
        p.categoryId,
        c.name as category_name,
        p.groupId,
        g.name as group_name
      FROM product_variants v
      INNER JOIN products p ON p.id = v.product_id
      LEFT JOIN categories c ON c.id = p.categoryId
      LEFT JOIN category_groups g ON g.id = p.groupId
      WHERE p.has_variants = 1${searchCondition ? ` AND ${searchCondition}` : ''}
      LIMIT ?
    `;
    
    const variants = params.length > 0
      ? db.prepare(variantsQuery).all(...params, Number(limit))
      : db.prepare(`
          SELECT 
            v.id,
            v.product_id,
            v.name as variant_name,
            v.color_code,
            v.price_rub,
            v.stock,
            p.id as base_product_id,
            p.title as base_product_title,
            p.cost_price,
            p.min_stock,
            p.categoryId,
            c.name as category_name,
            p.groupId,
            g.name as group_name
          FROM product_variants v
          INNER JOIN products p ON p.id = v.product_id
          LEFT JOIN categories c ON c.id = p.categoryId
          LEFT JOIN category_groups g ON g.id = p.groupId
          WHERE p.has_variants = 1
          LIMIT ?
        `).all(Number(limit));
    
    // Преобразуем варианты в формат товаров
    const variantsAsProducts = variants.map(v => ({
      id: v.id,
      product_id: v.product_id,
      title: `${v.base_product_title} (${v.variant_name})`,
      variant_name: v.variant_name,
      color_code: v.color_code,
      priceRub: v.price_rub,
      cost_price: v.cost_price,
      stock: v.stock,
      min_stock: v.min_stock,
      categoryId: v.categoryId,
      category_name: v.category_name,
      groupId: v.groupId,
      group_name: v.group_name,
      has_variants: 0,
      is_variant: true
    }));
    
    // Объединяем
    const allProducts = [...regularProducts, ...variantsAsProducts].slice(0, Number(limit));
    
    res.json(allProducts);
  } catch (error) {
    console.error('[crm] Search products error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// =========================
// PRODUCTS LOW STOCK (Товары с минимальным остатком)
// =========================
crmFinanceRouter.get('/api/admin/crm/products/low-stock', authMiddleware, (req, res) => {
  try {
    // Получаем обычные товары с низким остатком
    const regularProducts = db.prepare(`
      SELECT 
        p.*,
        c.name as category_name,
        g.name as group_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.categoryId
      LEFT JOIN category_groups g ON g.id = p.groupId
      WHERE p.has_variants = 0 AND p.min_stock > 0 AND p.stock <= p.min_stock
      ORDER BY (p.stock - p.min_stock) ASC
    `).all();
    
    // Получаем ВАРИАНТЫ (не товары!) с низким остатком
    const lowStockVariants = db.prepare(`
      SELECT 
        v.id,
        v.product_id,
        v.name as variant_name,
        v.color_code,
        v.price_rub,
        v.stock,
        p.id as base_product_id,
        p.title as base_product_title,
        p.cost_price,
        p.min_stock,
        p.categoryId,
        c.name as category_name,
        p.groupId,
        g.name as group_name
      FROM product_variants v
      INNER JOIN products p ON p.id = v.product_id
      LEFT JOIN categories c ON c.id = p.categoryId
      LEFT JOIN category_groups g ON g.id = p.groupId
      WHERE p.has_variants = 1 AND p.min_stock > 0 AND v.stock <= p.min_stock
      ORDER BY (v.stock - p.min_stock) ASC
    `).all();
    
    // Преобразуем варианты в формат, похожий на обычные товары
    const variantsAsProducts = lowStockVariants.map(v => ({
      id: v.id, // ID варианта
      product_id: v.product_id, // ID базового товара
      title: `${v.base_product_title} (${v.variant_name})`, // Название с цветом
      variant_name: v.variant_name,
      color_code: v.color_code,
      priceRub: v.price_rub,
      cost_price: v.cost_price,
      stock: v.stock, // Остаток конкретного варианта
      min_stock: v.min_stock,
      categoryId: v.categoryId,
      category_name: v.category_name,
      groupId: v.groupId,
      group_name: v.group_name,
      has_variants: 0, // Помечаем как обычный товар для фронтенда
      is_variant: true // Флаг для отличия
    }));
    
    // Объединяем и сортируем
    const allProducts = [...regularProducts, ...variantsAsProducts].sort((a, b) => {
      const stockA = Number(a.stock || 0);
      const stockB = Number(b.stock || 0);
      const minA = Number(a.min_stock || 0);
      const minB = Number(b.min_stock || 0);
      return (stockA - minA) - (stockB - minB);
    });

    res.json(allProducts);
  } catch (error) {
    console.error('[crm] Get low stock products error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});
