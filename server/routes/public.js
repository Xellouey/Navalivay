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
    SELECT categoryId, COUNT(*) as total
    FROM products
    WHERE stock IS NULL OR stock > 0
    GROUP BY categoryId
  `).all();

  const groupCountRows = db.prepare(`
    SELECT groupId, COUNT(*) as total
    FROM products
    WHERE groupId IS NOT NULL AND (stock IS NULL OR stock > 0)
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
  whereClauses.unshift('(p.stock IS NULL OR p.stock > 0)');

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
      p.createdAt,
      g.slug as groupSlug,
      g.name as groupName
    FROM products p
    LEFT JOIN category_groups g ON p.groupId = g.id
    ${where}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;
  const products = whereParams.length
    ? db.prepare(sql).all(...whereParams, limit, offset)
    : db.prepare(sql).all(limit, offset);

  const stmtImgs = db.prepare('SELECT url FROM product_images WHERE productId = ? ORDER BY position ASC');
  const stmtLinks = db.prepare('SELECT label, url FROM product_links WHERE productId = ? ORDER BY position ASC');
  const enriched = products.map(p => ({
    ...p,
    images: stmtImgs.all(p.id).map(r => r.url),
    links: stmtLinks.all(p.id).map(link => ({ label: link.label ?? '', url: link.url }))
  }));

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
      p.createdAt,
      g.slug AS groupSlug,
      g.name AS groupName
    FROM products p
    LEFT JOIN category_groups g ON p.groupId = g.id
    WHERE p.id = ?
  `).get(id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const images = db.prepare('SELECT url FROM product_images WHERE productId = ? ORDER BY position ASC').all(id).map(r => r.url);
  const links = db.prepare('SELECT label, url FROM product_links WHERE productId = ? ORDER BY position ASC').all(id).map(link => ({
    label: link.label ?? '',
    url: link.url
  }));
  res.json({ ...p, images, links });
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
      p.createdAt,
      p.categoryId,
      p.groupId,
      g.slug as groupSlug,
      g.name as groupName
    FROM category_cross_sells cs
    JOIN products p ON p.id = cs.productId
    LEFT JOIN category_groups g ON p.groupId = g.id
    WHERE cs.categoryId = ?
      AND (p.stock IS NULL OR p.stock > 0)
    ORDER BY cs.[order] ASC
    LIMIT ?
  `).all(categoryRow.id, maxItems);

  const imageStmt = db.prepare('SELECT url FROM product_images WHERE productId = ? ORDER BY position ASC');
  const linkStmt = db.prepare('SELECT label, url FROM product_links WHERE productId = ? ORDER BY position ASC');
  const payload = rows.map(row => ({
    id: row.productId,
    title: row.title,
    priceRub: row.priceRub,
    description: row.description,
    createdAt: row.createdAt,
    categoryId: row.categoryId,
    groupId: row.groupId,
    groupSlug: row.groupSlug,
    groupName: row.groupName,
    images: imageStmt.all(row.productId).map(r => r.url),
    links: linkStmt.all(row.productId).map(link => ({ label: link.label ?? '', url: link.url }))
  }));

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
