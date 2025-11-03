import express from 'express';
import { db } from '../db.js';

export const publicRouter = express.Router();

publicRouter.get('/api/categories', (req, res) => {
  const categoriesRaw = db.prepare(`
    SELECT c.id, c.slug, c.name, c.[order], c.hide_empty, c.cover_image, c.display_mode
    FROM categories c
    ORDER BY c.[order] ASC, c.name ASC
  `).all();

  const groupsRaw = db.prepare(`
    SELECT g.id, g.categoryId, g.slug, g.name, g.cover_image, g.[order], g.hide_empty, g.parent_group_id
    FROM category_groups g
    ORDER BY g.categoryId ASC, g.[order] ASC, g.name ASC
  `).all();

  const categoryCountRows = db.prepare(`
    SELECT categoryId, COUNT(DISTINCT p.id) as total
    FROM products p
    WHERE (
      -- Для товаров без вариантов проверяем stock товара
      (p.has_variants = 0 AND (p.stock IS NULL OR p.stock > 0))
      OR
      -- Для товаров с вариантами проверяем, есть ли варианты в наличии
      (p.has_variants = 1 AND EXISTS (
        SELECT 1 FROM product_variants pv 
        WHERE pv.product_id = p.id 
        AND (pv.stock IS NULL OR pv.stock > 0)
      ))
    )
    GROUP BY categoryId
  `).all();

  const groupCountRows = db.prepare(`
    SELECT groupId, COUNT(DISTINCT p.id) as total
    FROM products p
    WHERE groupId IS NOT NULL 
      AND (
        -- Для товаров без вариантов проверяем stock товара
        (p.has_variants = 0 AND (p.stock IS NULL OR p.stock > 0))
        OR
        -- Для товаров с вариантами проверяем, есть ли варианты в наличии
        (p.has_variants = 1 AND EXISTS (
          SELECT 1 FROM product_variants pv 
          WHERE pv.product_id = p.id 
          AND (pv.stock IS NULL OR pv.stock > 0)
        ))
      )
    GROUP BY groupId
  `).all();

  const categoryCounts = new Map(categoryCountRows.map(row => [row.categoryId, row.total]));
  const groupCounts = new Map(groupCountRows.map(row => [row.groupId, row.total]));

  const nodes = groupsRaw.map(group => ({
    id: group.id,
    categoryId: group.categoryId,
    slug: group.slug,
    name: group.name,
    order: group['order'],
    coverImage: group.cover_image || null,
    hideEmpty: group.hide_empty === 1,
    parentId: group.parent_group_id || null,
    productCount: groupCounts.get(group.id) || 0,
    totalProductCount: 0,
    children: []
  }));

  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const rootsByCategory = new Map();

  nodes.forEach(node => {
    if (node.parentId && nodesById.has(node.parentId)) {
      nodesById.get(node.parentId).children.push(node);
    } else {
      const list = rootsByCategory.get(node.categoryId) || [];
      list.push(node);
      rootsByCategory.set(node.categoryId, list);
    }
  });

  const computeTotals = node => {
    node.children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    let total = Number(node.productCount ?? 0);
    node.children.forEach(child => {
      total += computeTotals(child);
    });
    node.totalProductCount = total;
    return total;
  };

  rootsByCategory.forEach(list => {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    list.forEach(node => computeTotals(node));
  });

  const collectVisible = node => {
    if (node.totalProductCount === 0 && node.hideEmpty) {
      return [];
    }
    const result = [{
      id: node.id,
      categoryId: node.categoryId,
      slug: node.slug,
      name: node.name,
      order: node.order,
      coverImage: node.coverImage,
      hideEmpty: node.hideEmpty,
      parentId: node.parentId,
      productCount: node.productCount,
      totalProductCount: node.totalProductCount
    }];

    node.children.forEach(child => {
      result.push(...collectVisible(child));
    });
    return result;
  };

  const flattenedGroupsByCategory = new Map();
  rootsByCategory.forEach((nodesList, categoryId) => {
    const collected = [];
    nodesList.forEach(node => {
      collected.push(...collectVisible(node));
    });
    flattenedGroupsByCategory.set(categoryId, collected);
  });

  const categories = [];

  for (const cat of categoriesRaw) {
    const totalProducts = categoryCounts.get(cat.id) || 0;
    const groups = (flattenedGroupsByCategory.get(cat.id) || []).filter(group => group.totalProductCount > 0);

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
      order: cat['order'],
      coverImage: cat.cover_image || null,
      productCount: totalProducts,
      groups,
      displayMode: cat.display_mode || 'default'
    });
  }

  res.json(categories);
});

publicRouter.get('/api/banners', (req, res) => {
  const rows = db.prepare('SELECT id, image, href, active, [order], openInNewTab FROM banners WHERE active = 1 ORDER BY [order] ASC').all();
  res.json(rows);
});

publicRouter.get('/api/products', (req, res) => {
  const { category, group, sort } = req.query;

  // Pagination params (defaults aligned with frontend)
  const limit = Math.min(Math.max(parseInt(req.query.limit ?? '50', 10) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset ?? '0', 10) || 0, 0);

  let whereClauses = [];
  const whereParams = [];
  let categoryFilterId = null;

  if (category) {
    const cat = db.prepare('SELECT id FROM categories WHERE slug = ?').get(String(category));
    if (!cat) {
      return res.json({ products: [], total: 0, hasMore: false });
    }
    categoryFilterId = cat.id;
    whereClauses.push('p.categoryId = ?');
    whereParams.push(cat.id);
  }

  if (group) {
    const groupRow = db.prepare('SELECT id, categoryId FROM category_groups WHERE slug = ?').get(String(group));
    if (!groupRow) {
      return res.json({ products: [], total: 0, hasMore: false });
    }
    if (categoryFilterId && groupRow.categoryId !== categoryFilterId) {
      return res.json({ products: [], total: 0, hasMore: false });
    }
    if (!categoryFilterId) {
      categoryFilterId = groupRow.categoryId;
    }
    whereClauses.push('p.groupId = ?');
    whereParams.push(groupRow.id);
  }

  // Hide products with zero stock for public storefront
  // Для товаров без вариантов проверяем stock товара, для товаров с вариантами - stock вариантов
  whereClauses.unshift(`(
    (p.has_variants = 0 AND (p.stock IS NULL OR p.stock > 0))
    OR
    (p.has_variants = 1 AND EXISTS (
      SELECT 1 FROM product_variants pv 
      WHERE pv.product_id = p.id 
      AND (pv.stock IS NULL OR pv.stock > 0)
    ))
  )`);

  const where = `WHERE ${whereClauses.join(' AND ')}`;

  // Sorting
  let orderBy = 'ORDER BY p.priceRub ASC';
  switch (String(sort || 'price_asc')) {
    case 'price_desc': orderBy = 'ORDER BY p.priceRub DESC'; break;
    case 'newest': orderBy = 'ORDER BY p.createdAt DESC'; break;
    case 'oldest': orderBy = 'ORDER BY p.createdAt ASC'; break;
    default: orderBy = 'ORDER BY p.priceRub ASC';
  }

  // Total count
  const countSql = `SELECT COUNT(*) as total FROM products p ${where}`;
  const total = whereParams.length
    ? db.prepare(countSql).get(...whereParams).total
    : db.prepare(countSql).get().total;

  // Fetch products with pagination
  const sql = `
    SELECT 
      p.id, 
      p.categoryId, 
      p.groupId,
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
      g.slug as groupSlug,
      g.name as groupName,
      c.cover_image AS categoryCoverImage
    FROM products p
    LEFT JOIN category_groups g ON p.groupId = g.id
    LEFT JOIN categories c ON p.categoryId = c.id
    ${where}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;
  const products = whereParams.length
    ? db.prepare(sql).all(...whereParams, limit, offset)
    : db.prepare(sql).all(limit, offset);

  const stmtImgs = db.prepare('SELECT url FROM product_images WHERE productId = ? AND variant_id IS NULL ORDER BY position ASC');
  const stmtLinks = db.prepare('SELECT label, url FROM product_links WHERE productId = ? ORDER BY position ASC');
  const stmtBadges = db.prepare(`
    SELECT type, label, color
    FROM product_badges
    WHERE product_id = ?
    ORDER BY rowid ASC
  `);
  const stmtVariants = db.prepare(`
    SELECT id, product_id, name, color_code AS colorCode, price_rub AS priceRub, stock, position
    FROM product_variants
    WHERE product_id = ?
    ORDER BY position ASC
  `);
  const stmtVariantImgs = db.prepare('SELECT url FROM product_images WHERE productId = ? AND variant_id = ? ORDER BY position ASC');
  
  const enriched = products.map((p) => {
    const stockValue = typeof p.stock === 'number' ? p.stock : null;
    const { categoryCoverImage, ...productData } = p;
    
    const result = {
      ...productData,
      stock: stockValue,
      costPrice: typeof p.costPrice === 'number' ? p.costPrice : null,
      minStock: typeof p.minStock === 'number' ? p.minStock : null,
      badges: stmtBadges.all(p.id).map((badge) => ({
        type: badge.type || null,
        label: badge.label || null,
        color: badge.color || null
      })),
      isAvailable: stockValue === null ? true : stockValue > 0,
      links: stmtLinks.all(p.id).map(link => ({ label: link.label ?? '', url: link.url }))
    };
    
    if (p.hasVariants) {
      // Для товаров с вариантами получаем варианты и их изображения
      const variants = stmtVariants.all(p.id);
      result.variants = variants.map(v => ({
        ...v,
        images: stmtVariantImgs.all(p.id, v.id).map(r => r.url)
      }));
      // Для обратной совместимости, показываем изображения первого варианта как изображения товара
      result.images = result.variants.length > 0 && result.variants[0].images && result.variants[0].images.length > 0 ? result.variants[0].images : [];
      // Обновляем доступность на основе вариантов
      result.isAvailable = result.variants.some(v => (v.stock === null || v.stock > 0));
    } else {
      // Обычный товар без вариантов
      const productImages = stmtImgs.all(p.id).map(r => r.url);
      // Если у товара включена опция "использовать изображение категории" и у него нет своих изображений,
      // используем обложку категории
      result.images = (p.useCategoryImage && productImages.length === 0 && categoryCoverImage) 
        ? [categoryCoverImage] 
        : productImages;
    }
    
    return result;
  });

  res.json({ products: enriched, total, hasMore: offset + limit < total });
});

publicRouter.get('/api/product/:id', (req, res) => {
  const id = req.params.id;
  const p = db.prepare(`
    SELECT 
      p.id,
      p.categoryId,
      p.groupId,
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
      g.slug AS groupSlug,
      g.name AS groupName,
      c.cover_image AS categoryCoverImage
    FROM products p
    LEFT JOIN category_groups g ON p.groupId = g.id
    LEFT JOIN categories c ON p.categoryId = c.id
    WHERE p.id = ?
  `).get(id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  
  const links = db.prepare('SELECT label, url FROM product_links WHERE productId = ? ORDER BY position ASC').all(id).map(link => ({
    label: link.label ?? '',
    url: link.url
  }));
  const badges = db.prepare(`
    SELECT type, label, color
    FROM product_badges
    WHERE product_id = ?
    ORDER BY rowid ASC
  `).all(id);
  const stockValue = typeof p.stock === 'number' ? p.stock : null;
  const { categoryCoverImage, ...productData } = p;
  
  const result = {
    ...productData,
    stock: stockValue,
    costPrice: typeof p.costPrice === 'number' ? p.costPrice : null,
    minStock: typeof p.minStock === 'number' ? p.minStock : null,
    badges: badges.map((badge) => ({
      type: badge.type || null,
      label: badge.label || null,
      color: badge.color || null
    })),
    isAvailable: stockValue === null ? true : stockValue > 0,
    links
  };
  
  if (p.hasVariants) {
    // Для товаров с вариантами получаем варианты и их изображения
    const variants = db.prepare(`
      SELECT id, product_id, name, color_code AS colorCode, price_rub AS priceRub, stock, position
      FROM product_variants
      WHERE product_id = ?
      ORDER BY position ASC
    `).all(id);
    
    result.variants = variants.map(v => ({
      ...v,
      images: db.prepare('SELECT url FROM product_images WHERE productId = ? AND variant_id = ? ORDER BY position ASC')
        .all(id, v.id).map(r => r.url)
    }));
    // Для обратной совместимости, показываем изображения первого варианта как изображения товара
    result.images = result.variants.length > 0 && result.variants[0].images && result.variants[0].images.length > 0 ? result.variants[0].images : [];
    // Обновляем доступность на основе вариантов
    result.isAvailable = result.variants.some(v => (v.stock === null || v.stock > 0));
  } else {
    // Обычный товар без вариантов
    const productImages = db.prepare('SELECT url FROM product_images WHERE productId = ? AND variant_id IS NULL ORDER BY position ASC')
      .all(id).map(r => r.url);
    // Если у товара включена опция "использовать изображение категории" и у него нет своих изображений,
    // используем обложку категории
    result.images = (p.useCategoryImage && productImages.length === 0 && categoryCoverImage) 
      ? [categoryCoverImage] 
      : productImages;
  }
  
  res.json(result);
});

publicRouter.get('/api/cross-sells', (req, res) => {
  const { category, limit } = req.query;
  if (!category) {
    return res.json([]);
  }

  const categoryRow = db.prepare('SELECT id FROM categories WHERE slug = ?').get(String(category));
  if (!categoryRow) {
    return res.json([]);
  }

  const maxItems = Math.min(Math.max(parseInt(limit ?? '6', 10) || 6, 1), 12);

  const rows = db.prepare(`
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
      g.name as groupName,
      c.cover_image AS categoryCoverImage
    FROM category_cross_sells cs
    JOIN products p ON p.id = cs.productId
    LEFT JOIN category_groups g ON p.groupId = g.id
    LEFT JOIN categories c ON p.categoryId = c.id
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
  `).all(categoryRow.id, maxItems);

  const imageStmt = db.prepare('SELECT url FROM product_images WHERE productId = ? AND variant_id IS NULL ORDER BY position ASC');
  const linkStmt = db.prepare('SELECT label, url FROM product_links WHERE productId = ? ORDER BY position ASC');
  const badgeStmt = db.prepare(`
    SELECT type, label, color
    FROM product_badges
    WHERE product_id = ?
    ORDER BY rowid ASC
  `);
  const variantStmt = db.prepare(`
    SELECT id, product_id, name, color_code AS colorCode, price_rub AS priceRub, stock, position
    FROM product_variants
    WHERE product_id = ?
    ORDER BY position ASC
  `);
  const variantImgStmt = db.prepare('SELECT url FROM product_images WHERE productId = ? AND variant_id = ? ORDER BY position ASC');
  
  const payload = rows.map(row => {
    const stockValue = typeof row.stock === 'number' ? row.stock : null;
    
    const result = {
      id: row.productId,
      title: row.title,
      priceRub: row.priceRub,
      description: row.description,
      variant: row.variant,
      strength: row.strength,
      costPrice: typeof row.costPrice === 'number' ? row.costPrice : null,
      stock: stockValue,
      minStock: typeof row.minStock === 'number' ? row.minStock : null,
      isAvailable: stockValue === null ? true : stockValue > 0,
      createdAt: row.createdAt,
      categoryId: row.categoryId,
      groupId: row.groupId,
      groupSlug: row.groupSlug,
      groupName: row.groupName,
      links: linkStmt.all(row.productId).map(link => ({ label: link.label ?? '', url: link.url })),
      badges: badgeStmt.all(row.productId).map((badge) => ({
        type: badge.type || null,
        label: badge.label || null,
        color: badge.color || null
      }))
    };
    
    if (row.hasVariants) {
      // Для товаров с вариантами получаем варианты и их изображения
      const variants = variantStmt.all(row.productId);
      result.variants = variants.map(v => ({
        ...v,
        images: variantImgStmt.all(row.productId, v.id).map(r => r.url)
      }));
      // Для обратной совместимости, показываем изображения первого варианта как изображения товара
      result.images = result.variants.length > 0 && result.variants[0].images && result.variants[0].images.length > 0 ? result.variants[0].images : [];
      // Обновляем доступность на основе вариантов
      result.isAvailable = result.variants.some(v => (v.stock === null || v.stock > 0));
    } else {
      // Обычный товар без вариантов
      const productImages = imageStmt.all(row.productId).map(r => r.url);
      // Если у товара включена опция "использовать изображение категории" и у него нет своих изображений,
      // используем обложку категории
      result.images = (row.useCategoryImage && productImages.length === 0 && row.categoryCoverImage) 
        ? [row.categoryCoverImage] 
        : productImages;
    }
    
    return result;
  });

  res.json(payload);
});

// Public settings (only specific settings that are safe to expose)
publicRouter.get('/api/settings', (req, res) => {
  try {
    const managerTelegram = db.prepare('SELECT value FROM settings WHERE key = ?').get('manager_telegram');
    
    res.json({
      manager_telegram: managerTelegram?.value || 'dmitriy_mityuk'
    });
  } catch (error) {
    console.error('[public] Failed to get settings:', error);
    // Возвращаем дефолтные значения в случае ошибки
    res.json({
      manager_telegram: 'dmitriy_mityuk'
    });
  }
});

// Helper functions
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getNextNumber(table, field) {
  const row = db.prepare(`SELECT MAX(${field}) as maxNum FROM ${table}`).get();
  return (row?.maxNum || 0) + 1;
}

// Create order (public endpoint)
publicRouter.post('/api/orders', (req, res) => {
  try {
    const {
      telegram_id,
      telegram_username,
      first_name,
      last_name,
      phone,
      delivery_type = 'pickup',
      delivery_address,
      notes,
      items
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items_required', message: 'Товары обязательны' });
    }

    // Validate delivery requirements
    if (delivery_type === 'delivery') {
      if (!phone || !phone.trim()) {
        return res.status(400).json({ error: 'phone_required', message: 'Укажите телефон для доставки' });
      }
      if (!delivery_address || !delivery_address.trim()) {
        return res.status(400).json({ error: 'address_required', message: 'Укажите адрес доставки' });
      }
    }

    const tx = db.transaction(() => {
      // Find or create customer
      let customerId = null;
      
      if (telegram_id) {
        const existing = db.prepare('SELECT id FROM customers WHERE telegram_id = ?').get(telegram_id);
        if (existing) {
          customerId = existing.id;
          // Update customer info
          db.prepare(`
            UPDATE customers
            SET telegram_username = ?,
                first_name = ?,
                last_name = ?,
                phone = COALESCE(?, phone),
                last_visit_at = DATETIME('now'),
                updated_at = DATETIME('now')
            WHERE id = ?
          `).run(
            telegram_username || null,
            first_name || null,
            last_name || null,
            phone || null,
            customerId
          );
        } else {
          // Create new customer
          customerId = generateId('cust');
          db.prepare(`
            INSERT INTO customers (
              id, telegram_id, telegram_username, first_name, last_name, phone,
              first_visit_at, last_visit_at, total_orders, total_spent
            ) VALUES (?, ?, ?, ?, ?, ?, DATETIME('now'), DATETIME('now'), 0, 0)
          `).run(
            customerId,
            telegram_id,
            telegram_username || null,
            first_name || null,
            last_name || null,
            phone || null
          );
        }
      }

      // Generate order
      const orderId = generateId('order');
      const orderNumber = getNextNumber('orders', 'order_number');

      // Calculate totals
      let totalAmount = 0;
      let totalCost = 0;

      const orderItems = items.map(item => {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (!product) {
          throw new Error(`Товар не найден: ${item.product_id}`);
        }

        // Check stock
        if (product.stock !== null && product.stock < item.quantity) {
          throw new Error(`Недостаточно товара: ${product.title}`);
        }

        const pricePerUnit = item.price_per_unit || product.priceRub;
        const costPerUnit = product.cost_price || 0;
        const totalPrice = pricePerUnit * item.quantity;
        const totalItemCost = costPerUnit * item.quantity;

        totalAmount += totalPrice;
        totalCost += totalItemCost;

        return {
          id: generateId('oi'),
          product_id: item.product_id,
          product_title: product.title || 'Без названия',
          quantity: item.quantity,
          price_per_unit: pricePerUnit,
          cost_per_unit: costPerUnit,
          discount_amount: 0,
          total_price: totalPrice,
          total_cost: totalItemCost
        };
      });

      const finalAmount = totalAmount;
      const profit = finalAmount - totalCost;

      // Insert order
      db.prepare(`
        INSERT INTO orders (
          id, order_number, customer_id, status, delivery_type, delivery_address,
          total_amount, discount_amount, discount_percent, final_amount, profit, notes, phone
        ) VALUES (?, ?, ?, 'new', ?, ?, ?, 0, 0, ?, ?, ?, ?)
      `).run(
        orderId,
        orderNumber,
        customerId,
        delivery_type,
        delivery_address || null,
        totalAmount,
        finalAmount,
        profit,
        notes || null,
        phone || null
      );

      // Insert order items
      const itemStmt = db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, product_title, quantity,
          price_per_unit, cost_per_unit, discount_amount, total_price, total_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of orderItems) {
        itemStmt.run(
          item.id,
          orderId,
          item.product_id,
          item.product_title,
          item.quantity,
          item.price_per_unit,
          item.cost_per_unit,
          item.discount_amount,
          item.total_price,
          item.total_cost
        );

        // Update stock
        if (db.prepare('SELECT stock FROM products WHERE id = ?').get(item.product_id).stock !== null) {
          db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(
            item.quantity,
            item.product_id
          );
        }
      }

      // Update customer stats
      if (customerId) {
        db.prepare(`
          UPDATE customers
          SET total_orders = total_orders + 1,
              total_spent = total_spent + ?,
              last_order_at = DATETIME('now'),
              updated_at = DATETIME('now')
          WHERE id = ?
        `).run(finalAmount, customerId);
      }

      return { orderId, orderNumber };
    });

    const result = tx();

    res.json({
      success: true,
      order_id: result.orderId,
      order_number: result.orderNumber,
      message: 'Заказ успешно создан'
    });
  } catch (error) {
    console.error('[public] Create order error:', error);
    res.status(500).json({
      error: 'failed',
      message: error.message || 'Не удалось создать заказ'
    });
  }
});
