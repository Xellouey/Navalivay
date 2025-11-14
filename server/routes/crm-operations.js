import express from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';
import { cleanupOldDeliveredOrders } from '../cleanup-delivered-orders.js';

export const crmOperationsRouter = express.Router();

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
    db.prepare(`
      INSERT INTO order_status_history (id, order_id, previous_status, new_status, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(generateId('osh'), orderId, previousStatus || null, newStatus, note || null);
  } catch (error) {
    console.warn('[crm] Failed to record status history:', error.message);
  }
}

// Helper для расчета средней себестоимости (метод CloudShop)
function calculateAverageCost(productId, newQuantity, newCostPerUnit) {
  const product = db.prepare('SELECT stock, cost_price FROM products WHERE id = ?').get(productId);
  
  if (!product) return newCostPerUnit;
  
  const currentStock = product.stock || 0;
  const currentCost = product.cost_price || 0;
  
  if (currentStock === 0) {
    return newCostPerUnit;
  }
  
  const totalCost = (currentStock * currentCost) + (newQuantity * newCostPerUnit);
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

// =========================
// ORDERS (Заказы)
// =========================
crmOperationsRouter.get('/api/admin/crm/orders', authMiddleware, (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    const whereClauses = [];
    const params = [];

    if (status) {
      whereClauses.push('o.status = ?');
      params.push(status);
    }

    // Фильтрация выданных заказов: показываем только заказы текущего дня
    // Выданные заказы (delivered) должны быть созданы или выданы сегодня
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    whereClauses.push(`(o.status != 'delivered' OR (o.status = 'delivered' AND o.completed_at >= ? AND o.completed_at < ?))`);
    params.push(startOfToday.toISOString(), endOfToday.toISOString());

    if (search) {
      const searchTerm = String(search).trim();
      if (searchTerm) {
        // Поиск по номеру заказа, имени клиента или username
        whereClauses.push('(o.order_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.telegram_username LIKE ? OR o.telegram_username LIKE ?)');
        const likePattern = `%${searchTerm}%`;
        params.push(likePattern, likePattern, likePattern, likePattern, likePattern);
      }
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const countSql = `SELECT COUNT(*) as count FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ${whereClause}`;
    const total = params.length > 0
      ? db.prepare(countSql).get(...params).count
      : db.prepare(`SELECT COUNT(*) as count FROM orders o`).get().count;

    const ordersSql = `
      SELECT 
        o.*,
        COALESCE(o.telegram_username, c.telegram_username) as telegram_username,
        c.first_name || ' ' || COALESCE(c.last_name, '') as customer_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const orders = params.length > 0
      ? db.prepare(ordersSql).all(...params, parseInt(limit), offset)
      : db.prepare(`
          SELECT 
            o.*,
            COALESCE(o.telegram_username, c.telegram_username) as telegram_username,
            c.first_name || ' ' || COALESCE(c.last_name, '') as customer_name
          FROM orders o
          LEFT JOIN customers c ON c.id = o.customer_id
          ORDER BY o.created_at DESC
          LIMIT ? OFFSET ?
        `).all(parseInt(limit), offset);

    let ordersWithItems = orders;
    if (orders.length > 0) {
      const orderIds = orders.map((order) => order.id);
      const placeholders = orderIds.map(() => '?').join(',');
      const itemsRows = db.prepare(`
        SELECT * FROM order_items WHERE order_id IN (${placeholders})
      `).all(...orderIds);

      const itemsByOrder = itemsRows.reduce((acc, item) => {
        const list = acc.get(item.order_id) || [];
        list.push(item);
        acc.set(item.order_id, list);
        return acc;
      }, new Map());

      ordersWithItems = orders.map((order) => ({
        ...order,
        items: itemsByOrder.get(order.id) || []
      }));
    }

    res.json({ 
      orders: ordersWithItems, 
      pagination: { 
        page: parseInt(page), 
        limit: parseInt(limit), 
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      } 
    });
  } catch (error) {
    console.error('[crm] Get orders error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

crmOperationsRouter.get('/api/admin/crm/orders/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    const order = db.prepare(`
      SELECT 
        o.*,
        COALESCE(o.telegram_username, c.telegram_username) as telegram_username,
        c.first_name,
        c.last_name,
        c.phone
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ?
    `).get(id);

    if (!order) {
      return res.status(404).json({ error: 'not_found' });
    }

    const items = db.prepare(`
      SELECT * FROM order_items WHERE order_id = ?
    `).all(id);

    res.json({ ...order, items });
  } catch (error) {
    console.error('[crm] Get order error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Создание заказа (свободная продажа или из корзины)
crmOperationsRouter.post('/api/admin/crm/orders', authMiddleware, (req, res) => {
  try {
    const { 
      customer_id, 
      delivery_type = 'pickup',
      delivery_address,
      items,
      discount_amount = 0,
      discount_percent = 0,
      notes
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items_required' });
    }

    const orderId = generateId('order');
    const orderNumber = getNextNumber('orders', 'order_number');

    // Рассчитываем суммы
    let totalAmount = 0;
    let totalCost = 0;

    const orderItems = items.map(item => {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      if (!product) {
        throw new Error(`Product not found: ${item.product_id}`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.title}`);
      }

      const pricePerUnit = item.price_per_unit || product.priceRub;
      const costPerUnit = product.cost_price || 0;
      const itemDiscount = item.discount_amount || 0;
      const totalPrice = (pricePerUnit * item.quantity) - itemDiscount;
      const totalItemCost = costPerUnit * item.quantity;

      totalAmount += pricePerUnit * item.quantity;
      totalCost += totalItemCost;

      return {
        id: generateId('oi'),
        product_id: item.product_id,
        product_title: product.title || 'Без названия',
        quantity: item.quantity,
        price_per_unit: pricePerUnit,
        cost_per_unit: costPerUnit,
        discount_amount: itemDiscount,
        total_price: totalPrice,
        total_cost: totalItemCost
      };
    });

    // Применяем скидки
    let finalAmount = totalAmount - discount_amount;
    if (discount_percent > 0) {
      finalAmount = finalAmount * (1 - discount_percent / 100);
    }

    const profit = finalAmount - totalCost;

    // Создаем заказ в транзакции
    const tx = db.transaction(() => {
      // Вставляем заказ
      db.prepare(`
        INSERT INTO orders (
          id, order_number, customer_id, status, delivery_type, delivery_address,
          total_amount, discount_amount, discount_percent, final_amount, profit, notes
        ) VALUES (?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId, orderNumber, customer_id || null, delivery_type, delivery_address || null,
        totalAmount, discount_amount, discount_percent, finalAmount, profit, notes || null
      );

      // Вставляем позиции
      const itemStmt = db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, product_title, quantity,
          price_per_unit, cost_per_unit, discount_amount, total_price, total_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of orderItems) {
        itemStmt.run(
          item.id, orderId, item.product_id, item.product_title, item.quantity,
          item.price_per_unit, item.cost_per_unit, item.discount_amount,
          item.total_price, item.total_cost
        );

        // Уменьшаем остаток товара
        db.prepare(`
          UPDATE products SET stock = stock - ? WHERE id = ?
        `).run(item.quantity, item.product_id);
      }

      // Обновляем статистику клиента
      if (customer_id) {
        db.prepare(`
          UPDATE customers 
          SET total_orders = total_orders + 1,
              total_spent = total_spent + ?,
              last_order_at = DATETIME('now'),
              updated_at = DATETIME('now')
          WHERE id = ?
        `).run(finalAmount, customer_id);
      }
    });

    tx();

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const items_result = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    recordStatusChange(orderId, null, order.status, 'Создан заказ');

    res.json({ ...order, items: items_result });
  } catch (error) {
    console.error('[crm] Create order error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Обновление заказа (редактирование, статус)
crmOperationsRouter.patch('/api/admin/crm/orders/:id', authMiddleware, (req, res) => {
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
      reactivate
    } = req.body || {};

    if (payment_type !== undefined && payment_type !== null && payment_type !== 'cash') {
      return res.status(400).json({ error: 'invalid_payment_type' });
    }

    const allowedStatuses = ['new', 'in_progress', 'completed', 'delivered', 'cancelled'];
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ error: 'not_found' });
    }

    const shouldUpdateDiscount = discount_amount !== undefined || discount_percent !== undefined;
    const updatedDiscountAmount = discount_amount !== undefined ? Number(discount_amount) : Number(order.discount_amount || 0);
    const updatedDiscountPercent = discount_percent !== undefined ? Number(discount_percent) : Number(order.discount_percent || 0);

    let desiredStatus = order.status;
    if (reactivate && order.status === 'cancelled') {
      desiredStatus = order.previous_status || 'in_progress';
    }
    if (status !== undefined) {
      desiredStatus = status;
    }

    let statusChangeNote = null;

    const tx = db.transaction(() => {
      const updateFields = [];
      const updateValues = [];

      if (delivery_address !== undefined) {
        updateFields.push('delivery_address = ?');
        updateValues.push(delivery_address || null);
      }
      if (notes !== undefined) {
        updateFields.push('notes = ?');
        updateValues.push(notes || null);
      }
      if (payment_type !== undefined) {
        updateFields.push('payment_type = ?');
        updateValues.push(payment_type || null);
      }
      if (payment_account_id !== undefined) {
        updateFields.push('payment_account_id = ?');
        updateValues.push(payment_account_id || null);
      }
      if (payment_notes !== undefined) {
        updateFields.push('payment_notes = ?');
        updateValues.push(payment_notes || null);
      }
      if (paid_amount !== undefined) {
        const parsedPaid = Number(paid_amount) || 0;
        if (parsedPaid < 0) {
          throw new Error('invalid_paid_amount');
        }
        if (parsedPaid === 0) {
          updateFields.push('paid_amount = NULL');
          updateFields.push('paid_at = NULL');
        } else {
          updateFields.push('paid_amount = ?');
          updateValues.push(parsedPaid);
          updateFields.push("paid_at = DATETIME('now')");
        }
      }

      if (reactivate || status !== undefined) {
        updateFields.push('status = ?');
        updateValues.push(desiredStatus);

        if (desiredStatus === 'cancelled' && order.status !== 'cancelled') {
          updateFields.push('previous_status = ?');
          updateValues.push(order.status);
          updateFields.push("cancelled_at = DATETIME('now')");
          statusChangeNote = 'Заказ отменён';
        } else if (desiredStatus !== 'cancelled') {
          updateFields.push('previous_status = NULL');
          updateFields.push('cancelled_at = NULL');
          if (order.status === 'cancelled') {
            statusChangeNote = 'Заказ восстановлен';
          }
        }

        if (['completed', 'delivered'].includes(desiredStatus)) {
          updateFields.push("completed_at = DATETIME('now')");
        } else if (order.status === 'completed' || order.status === 'delivered') {
          updateFields.push('completed_at = NULL');
        }
      }

      if (updateFields.length > 0) {
        updateFields.push("updated_at = DATETIME('now')");
        updateValues.push(id);
        db.prepare(`UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);
      }

      if (Array.isArray(items)) {
        const oldItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
        for (const oldItem of oldItems) {
          if (oldItem.product_id) {
            db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
              .run(oldItem.quantity, oldItem.product_id);
          }
        }

        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);

        let totalAmount = 0;
        let totalCost = 0;

        const itemStmt = db.prepare(`
          INSERT INTO order_items (
            id, order_id, product_id, product_title, quantity,
            price_per_unit, cost_per_unit, discount_amount, total_price, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

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
            throw new Error('invalid_item_quantity');
          }

          const pricePerUnit = Number(
            item.price_per_unit !== undefined ? item.price_per_unit : product.priceRub
          );
          const costPerUnit = Number(product.cost_price || 0);
          const itemDiscount = Number(item.discount_amount || 0);

          const productStock = Number(product.stock || 0);
          if (productStock < quantity) {
            throw new Error(`Insufficient stock for ${product.title || product.id}`);
          }

          const totalPrice = (pricePerUnit * quantity) - itemDiscount;
          const totalItemCost = costPerUnit * quantity;

          totalAmount += pricePerUnit * quantity;
          totalCost += totalItemCost;

          itemStmt.run(
            generateId('oi'),
            id,
            item.product_id,
            product.title || 'Без названия',
            quantity,
            pricePerUnit,
            costPerUnit,
            itemDiscount,
            totalPrice,
            totalItemCost
          );

          db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
            .run(quantity, item.product_id);
        }

        const finalAmount = applyDiscounts(totalAmount, updatedDiscountAmount, updatedDiscountPercent);
        const profit = finalAmount - totalCost;

        db.prepare(`
          UPDATE orders
          SET total_amount = ?, final_amount = ?, profit = ?,
              discount_amount = ?, discount_percent = ?, updated_at = DATETIME('now')
          WHERE id = ?
        `).run(totalAmount, finalAmount, profit, updatedDiscountAmount, updatedDiscountPercent, id);
      } else if (shouldUpdateDiscount) {
        const totalAmount = Number(order.total_amount || 0);
        const costBase = Number(order.final_amount || 0) - Number(order.profit || 0);
        const finalAmount = applyDiscounts(totalAmount, updatedDiscountAmount, updatedDiscountPercent);
        const profit = finalAmount - costBase;

        db.prepare(`
          UPDATE orders
          SET discount_amount = ?, discount_percent = ?, final_amount = ?, profit = ?, updated_at = DATETIME('now')
          WHERE id = ?
        `).run(updatedDiscountAmount, updatedDiscountPercent, finalAmount, profit, id);
      }
    });

    tx();

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    const updatedItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);

    if (updated.status !== order.status) {
      recordStatusChange(id, order.status, updated.status, statusChangeNote || 'Изменение статуса');
    }

    res.json({ ...updated, items: updatedItems });
  } catch (error) {
    console.error('[crm] Update order error:', error);
    const clientErrors = new Set([
      'invalid_payment_type',
      'invalid_status',
      'invalid_paid_amount',
      'invalid_item',
      'invalid_item_quantity',
      'invalid_quantity',
      'invalid_cost',
      'items_required'
    ]);
    if (clientErrors.has(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Выдача заказа с фиксацией оплаты
crmOperationsRouter.post('/api/admin/crm/orders/:id/issue', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { payment_type, payment_account_id, amount, payment_notes } = req.body;

    if (!payment_type || payment_type !== 'cash') {
      return res.status(400).json({ error: 'invalid_payment_type' });
    }

    if (!payment_account_id) {
      return res.status(400).json({ error: 'payment_account_required' });
    }

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ error: 'invalid_amount' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ error: 'not_found' });
    }

    if (order.status !== 'in_progress' && order.status !== 'completed') {
      return res.status(400).json({ error: 'invalid_status_state' });
    }

    if (order.paid_amount && Number(order.paid_amount) > 0) {
      return res.status(400).json({ error: 'already_paid' });
    }

    const account = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(payment_account_id);
    if (!account) {
      return res.status(404).json({ error: 'account_not_found' });
    }

    const description = `Оплата заказа #${order.order_number} (наличные)`;
    const transactionId = generateId('trans');
    const previousStatus = order.status;

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE orders
        SET status = 'delivered',
            previous_status = ?,
            payment_type = ?,
            payment_account_id = ?,
            paid_amount = ?,
            paid_at = DATETIME('now'),
            payment_notes = ?,
            completed_at = DATETIME('now'),
            updated_at = DATETIME('now')
        WHERE id = ?
      `).run(previousStatus, payment_type, payment_account_id, parsedAmount, payment_notes || null, id);

      db.prepare(`
        INSERT INTO cash_transactions (id, account_id, type, amount, description, order_id)
        VALUES (?, ?, 'income', ?, ?, ?)
      `).run(transactionId, payment_account_id, parsedAmount, description, id);

      db.prepare('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?')
        .run(parsedAmount, payment_account_id);
    });

    tx();

    const updatedOrder = db.prepare(`
      SELECT 
        o.*,
        c.telegram_username,
        c.first_name || ' ' || COALESCE(c.last_name, '') as customer_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ?
    `).get(id);

    const transaction = db.prepare(`
      SELECT 
        ct.*,
        ca.name as account_name
      FROM cash_transactions ct
      JOIN cash_accounts ca ON ca.id = ct.account_id
      WHERE ct.id = ?
    `).get(transactionId);

    recordStatusChange(id, previousStatus, updatedOrder.status, 'Выдача заказа');

    res.json({ order: updatedOrder, transaction });
  } catch (error) {
    console.error('[crm] Issue order error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Удаление оплаты заказа
crmOperationsRouter.delete('/api/admin/crm/orders/:id/payment', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ error: 'not_found' });
    }

    if (!order.paid_amount || Number(order.paid_amount) <= 0) {
      return res.status(400).json({ error: 'payment_not_found' });
    }

    const transactions = db.prepare('SELECT * FROM cash_transactions WHERE order_id = ?').all(id);

    if (!transactions.length) {
      return res.status(400).json({ error: 'transaction_not_found' });
    }

    const restoredStatus = order.previous_status || 'in_progress';

    const tx = db.transaction(() => {
      for (const transaction of transactions) {
        db.prepare('DELETE FROM cash_transactions WHERE id = ?').run(transaction.id);

        if (transaction.account_id && transaction.amount) {
          if (transaction.type === 'income') {
            db.prepare('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?')
              .run(transaction.amount, transaction.account_id);
          } else if (transaction.type === 'expense') {
            db.prepare('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?')
              .run(transaction.amount, transaction.account_id);
          }
        }
      }

      db.prepare(`
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
      `).run(restoredStatus, id);
    });

    tx();

    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    const updatedItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);

    recordStatusChange(id, order.status, updatedOrder.status, 'Оплата отменена');

    res.json({ ...updatedOrder, items: updatedItems });
  } catch (error) {
    console.error('[crm] Remove order payment error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// =========================
// PROCUREMENTS (Закупки)
// =========================
crmOperationsRouter.get('/api/admin/crm/procurements', authMiddleware, (req, res) => {
  try {
    const procurements = db.prepare(`
      SELECT p.*, e.first_name || ' ' || e.last_name as employee_name
      FROM procurements p
      LEFT JOIN employees e ON e.id = p.employee_id
      ORDER BY p.created_at DESC
    `).all();

    res.json(procurements);
  } catch (error) {
    console.error('[crm] Get procurements error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

crmOperationsRouter.get('/api/admin/crm/procurements/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    const procurement = db.prepare('SELECT * FROM procurements WHERE id = ?').get(id);
    if (!procurement) {
      return res.status(404).json({ error: 'not_found' });
    }

    const items = db.prepare(`
      SELECT pi.*, p.title as product_title, p.stock, p.min_stock
      FROM procurement_items pi
      JOIN products p ON p.id = pi.product_id
      WHERE pi.procurement_id = ?
    `).all(id);

    res.json({ ...procurement, items });
  } catch (error) {
    console.error('[crm] Get procurement error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Создание закупки
crmOperationsRouter.post('/api/admin/crm/procurements', authMiddleware, (req, res) => {
  try {
    const { supplier_name, items, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items_required' });
    }

    const procurementId = generateId('proc');
    const procurementNumber = getNextNumber('procurements', 'procurement_number');

    let totalAmount = 0;

    const tx = db.transaction(() => {
      // Создаем закупку
      db.prepare(`
        INSERT INTO procurements (id, procurement_number, supplier_name, total_amount, status, notes)
        VALUES (?, ?, ?, 0, 'draft', ?)
      `).run(procurementId, procurementNumber, supplier_name || null, notes || null);

      // Добавляем позиции
      for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (!product) {
          throw new Error(`Product not found: ${item.product_id}`);
        }

        const totalCost = item.quantity * item.cost_per_unit;
        totalAmount += totalCost;

        db.prepare(`
          INSERT INTO procurement_items (id, procurement_id, product_id, quantity, cost_per_unit, total_cost)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(generateId('pi'), procurementId, item.product_id, item.quantity, item.cost_per_unit, totalCost);
      }

      // Обновляем общую сумму
      db.prepare('UPDATE procurements SET total_amount = ? WHERE id = ?').run(totalAmount, procurementId);
    });

    tx();

    const procurement = db.prepare('SELECT * FROM procurements WHERE id = ?').get(procurementId);
    const procurementItems = db.prepare(`
      SELECT pi.*, p.title as product_title
      FROM procurement_items pi
      JOIN products p ON p.id = pi.product_id
      WHERE pi.procurement_id = ?
    `).all(procurementId);

    res.json({ ...procurement, items: procurementItems });
  } catch (error) {
    console.error('[crm] Create procurement error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Обновление черновика закупки
crmOperationsRouter.patch('/api/admin/crm/procurements/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { supplier_name, notes, items } = req.body || {};

    const procurement = db.prepare('SELECT * FROM procurements WHERE id = ?').get(id);
    if (!procurement) {
      return res.status(404).json({ error: 'not_found' });
    }

    if (procurement.status !== 'draft') {
      return res.status(400).json({ error: 'edit_not_allowed' });
    }

    const tx = db.transaction(() => {
      if (supplier_name !== undefined || notes !== undefined) {
        db.prepare(`
          UPDATE procurements
          SET supplier_name = ?, notes = ?
          WHERE id = ?
        `).run(
          supplier_name !== undefined ? supplier_name || null : procurement.supplier_name,
          notes !== undefined ? notes || null : procurement.notes,
          id
        );
      }

      if (Array.isArray(items)) {
        if (items.length === 0) {
          throw new Error('items_required');
        }

        db.prepare('DELETE FROM procurement_items WHERE procurement_id = ?').run(id);

        let totalAmount = 0;
        const itemStmt = db.prepare(`
          INSERT INTO procurement_items (id, procurement_id, product_id, quantity, cost_per_unit, total_cost)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const item of items) {
          if (!item || !item.product_id) {
            throw new Error('invalid_item');
          }

          const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
          if (!product) {
            throw new Error(`Product not found: ${item.product_id}`);
          }

          const quantity = Number(item.quantity || 0);
          const costPerUnit = Number(item.cost_per_unit || 0);

          if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error('invalid_quantity');
          }

          if (!Number.isFinite(costPerUnit) || costPerUnit < 0) {
            throw new Error('invalid_cost');
          }

          const totalCost = costPerUnit * quantity;
          totalAmount += totalCost;

          itemStmt.run(generateId('pi'), id, item.product_id, quantity, costPerUnit, totalCost);
        }

        db.prepare('UPDATE procurements SET total_amount = ? WHERE id = ?')
          .run(totalAmount, id);
      }
    });

    tx();

    const updated = db.prepare('SELECT * FROM procurements WHERE id = ?').get(id);
    const updatedItems = db.prepare(`
      SELECT pi.*, p.title as product_title, p.stock, p.min_stock
      FROM procurement_items pi
      JOIN products p ON p.id = pi.product_id
      WHERE pi.procurement_id = ?
    `).all(id);

    res.json({ ...updated, items: updatedItems });
  } catch (error) {
    console.error('[crm] Update procurement error:', error);
    const clientErrors = new Set([
      'items_required',
      'invalid_item',
      'invalid_quantity',
      'invalid_cost',
      'edit_not_allowed'
    ]);
    if (clientErrors.has(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Удаление закупки
crmOperationsRouter.delete('/api/admin/crm/procurements/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const procurement = db.prepare('SELECT * FROM procurements WHERE id = ?').get(id);
    if (!procurement) {
      return res.status(404).json({ error: 'not_found' });
    }

    const items = db.prepare('SELECT * FROM procurement_items WHERE procurement_id = ?').all(id);

    const tx = db.transaction(() => {
      if (procurement.status === 'completed') {
        for (const item of items) {
          const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
          if (!product) {
            continue;
          }

          const currentStock = Number(product.stock || 0);
          const quantity = Number(item.quantity || 0);
          const costPerUnit = Number(item.cost_per_unit || 0);

          if (currentStock < quantity) {
            throw new Error(`insufficient_stock_to_rollback:${product.id}`);
          }

          const previousStock = currentStock - quantity;
          let previousCost = 0;
          if (previousStock > 0) {
            const currentCost = Number(product.cost_price || 0);
            previousCost = ((currentCost * currentStock) - (quantity * costPerUnit)) / previousStock;
            if (previousCost < 0) {
              previousCost = 0;
            }
          }

          db.prepare(`UPDATE products SET stock = stock - ?, cost_price = ? WHERE id = ?`)
            .run(quantity, previousStock > 0 ? previousCost : 0, item.product_id);
        }

        if (procurement.expense_transaction_id) {
          const transaction = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(procurement.expense_transaction_id);
          if (transaction) {
            db.prepare('DELETE FROM cash_transactions WHERE id = ?').run(transaction.id);
            if (transaction.account_id && transaction.amount) {
              if (transaction.type === 'expense') {
                db.prepare('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?')
                  .run(transaction.amount, transaction.account_id);
              } else if (transaction.type === 'income') {
                db.prepare('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?')
                  .run(transaction.amount, transaction.account_id);
              }
            }
          }
        }
      }

      db.prepare('DELETE FROM procurement_items WHERE procurement_id = ?').run(id);
      db.prepare('DELETE FROM procurements WHERE id = ?').run(id);
    });

    tx();

    res.json({ ok: true });
  } catch (error) {
    console.error('[crm] Delete procurement error:', error);
    if (error.message && error.message.startsWith('insufficient_stock_to_rollback')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Удаление оплаты по закупке
crmOperationsRouter.delete('/api/admin/crm/procurements/:id/payment', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const procurement = db.prepare('SELECT * FROM procurements WHERE id = ?').get(id);
    if (!procurement) {
      return res.status(404).json({ error: 'not_found' });
    }

    if (!procurement.expense_transaction_id) {
      return res.status(400).json({ error: 'payment_not_found' });
    }

    const transaction = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(procurement.expense_transaction_id);

    const tx = db.transaction(() => {
      if (transaction) {
        db.prepare('DELETE FROM cash_transactions WHERE id = ?').run(transaction.id);
        if (transaction.account_id && transaction.amount) {
          if (transaction.type === 'expense') {
            db.prepare('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?')
              .run(transaction.amount, transaction.account_id);
          } else if (transaction.type === 'income') {
            db.prepare('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?')
              .run(transaction.amount, transaction.account_id);
          }
        }
      }

      db.prepare('UPDATE procurements SET expense_transaction_id = NULL WHERE id = ?')
        .run(id);
    });

    tx();

    const updated = db.prepare('SELECT * FROM procurements WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('[crm] Remove procurement payment error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Подтверждение закупки (увеличение остатков)
crmOperationsRouter.post('/api/admin/crm/procurements/:id/complete', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const procurement = db.prepare('SELECT * FROM procurements WHERE id = ?').get(id);
    if (!procurement) {
      return res.status(404).json({ error: 'not_found' });
    }

    if (procurement.status === 'completed') {
      return res.status(400).json({ error: 'already_completed' });
    }

    const items = db.prepare('SELECT * FROM procurement_items WHERE procurement_id = ?').all(id);

    const tx = db.transaction(() => {
      for (const item of items) {
        // Рассчитываем новую среднюю себестоимость
        const avgCost = calculateAverageCost(item.product_id, item.quantity, item.cost_per_unit);

        // Обновляем товар
        db.prepare(`
          UPDATE products 
          SET stock = stock + ?,
              cost_price = ?
          WHERE id = ?
        `).run(item.quantity, avgCost, item.product_id);
      }

      // Обновляем статус закупки
      db.prepare(`
        UPDATE procurements 
        SET status = 'completed', completed_at = DATETIME('now')
        WHERE id = ?
      `).run(id);

      // Списываем деньги из кассы
      const defaultAccount = db.prepare('SELECT id FROM cash_accounts WHERE is_default = 1 LIMIT 1').get();
      if (defaultAccount) {
        const transId = generateId('trans');
        db.prepare(`
          INSERT INTO cash_transactions (id, account_id, type, amount, description)
          VALUES (?, ?, 'expense', ?, ?)
        `).run(transId, defaultAccount.id, procurement.total_amount, `Закупка #${procurement.procurement_number}`);

        db.prepare('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?')
          .run(procurement.total_amount, defaultAccount.id);

        db.prepare(`
          UPDATE procurements
          SET expense_transaction_id = ?
          WHERE id = ?
        `).run(transId, id);
      }
    });

    tx();

    const updated = db.prepare('SELECT * FROM procurements WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('[crm] Complete procurement error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// =========================
// CLEANUP (Очистка старых заказов)
// =========================
crmOperationsRouter.post('/api/admin/crm/cleanup-delivered-orders', authMiddleware, (req, res) => {
  try {
    console.log('[crm] Manual cleanup triggered');
    const result = cleanupOldDeliveredOrders();
    res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error('[crm] Manual cleanup error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Debug endpoint для проверки delivered заказов
crmOperationsRouter.get('/api/admin/crm/debug-delivered-orders', authMiddleware, (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const orders = db.prepare(`
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
    `).all(startOfToday.toISOString());

    res.json({
      currentTime: now.toISOString(),
      startOfToday: startOfToday.toISOString(),
      orders
    });
  } catch (error) {
    console.error('[crm] Debug endpoint error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Продолжение следует...
