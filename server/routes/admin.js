import express from 'express';
import slugify from 'slugify';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authMiddleware, issueToken, verifyPassword, changePassword, getAdminUsername } from '../auth.js';
import { DEFAULT_PROFIT_PASSWORD } from '../migrations/add_profit_password_setting.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseUploads = path.resolve(__dirname, '../../uploads');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function getProfitPasswordHash() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('profit_password_hash');
  if (row?.value) {
    return row.value;
  }

  const fallbackHash = bcrypt.hashSync(DEFAULT_PROFIT_PASSWORD, 10);
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run('profit_password_hash', fallbackHash);
  return fallbackHash;
}

async function updateProfitPasswordHash(newPassword) {
  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run('profit_password_hash', hash);
  return hash;
}

function generateGroupSlug(categoryId, name, customSlug, excludeId) {
  let baseSlug = customSlug;
  if (!baseSlug) {
    try {
      baseSlug = slugify(name, { lower: true, strict: true });
    } catch (error) {
      baseSlug = name.toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }
  }
  let slugCandidate = baseSlug;
  let counter = 1;
  while (true) {
    const existing = db.prepare('SELECT id FROM category_groups WHERE categoryId = ? AND slug = ?').get(categoryId, slugCandidate);
    if (!existing || (excludeId && existing.id === excludeId)) {
      break;
    }
    slugCandidate = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return slugCandidate;
}

export const adminRouter = express.Router();


// Login
adminRouter.post('/api/admin/login', async (req, res) => {
  try {
    console.log('[login] Login attempt:', req.body);
    const { username, password } = req.body || {};
    if (!username || !password) {
      console.log('[login] Missing username or password');
      return res.status(400).json({ error: 'missing' });
    }
    const expectedUser = getAdminUsername();
    console.log('[login] Expected user:', expectedUser, 'Got:', username);
    if (username !== expectedUser) {
      console.log('[login] Username mismatch');
      return res.status(401).json({ error: 'unauthorized' });
    }
    console.log('[login] Verifying password...');
    const ok = await verifyPassword(password);
    console.log('[login] Password verification result:', ok);
    if (!ok) {
      console.log('[login] Password verification failed');
      return res.status(401).json({ error: 'unauthorized' });
    }
    console.log('[login] Issuing token...');
    const token = issueToken(username);
    console.log('[login] Token issued, setting cookie and returning response');
  res.cookie('navalivay', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true, token });
  } catch (error) {
    console.error('[login] Login error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

// Verify token (для совместимости с фронтендом)
adminRouter.post('/api/admin/auth/verify', authMiddleware, (req, res) => {
  const user = req.user; // получаем из authMiddleware
  res.json({ 
    valid: true, 
    user: {
      username: user.username || user,
      role: 'admin'
    }
  });
});

// Change password
adminRouter.post('/api/admin/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'missing' });
  const ok = await changePassword(currentPassword, newPassword);
  if (!ok) return res.status(400).json({ error: 'invalid_current_password' });
res.json({ ok: true });
});

adminRouter.post('/api/admin/verify-password', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: 'missing_password' });
    }

    const ok = await verifyPassword(password);
    if (!ok) {
      return res.status(401).json({ error: 'invalid_password' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[admin] Password verify error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

adminRouter.post('/api/admin/settings/profit-password/verify', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: 'missing_password' });
    }

    const storedHash = getProfitPasswordHash();
    const ok = await bcrypt.compare(password, storedHash);
    if (!ok) {
      return res.status(401).json({ error: 'invalid_password' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[admin] Profit password verify error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

adminRouter.post('/api/admin/settings/profit-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'missing_new_password' });
    }

    const trimmedNewPassword = newPassword.trim();
    if (trimmedNewPassword.length < 4) {
      return res.status(400).json({ error: 'password_too_short' });
    }

    const existingHash = getProfitPasswordHash();
    if (existingHash) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'missing_current_password' });
      }
      const ok = await bcrypt.compare(currentPassword, existingHash);
      if (!ok) {
        return res.status(401).json({ error: 'invalid_current_password' });
      }
    }

    await updateProfitPasswordHash(trimmedNewPassword);
    res.json({ ok: true });
  } catch (error) {
    console.error('[admin] Profit password update error:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

// Products CRUD
adminRouter.post('/api/admin/products', authMiddleware, (req, res) => {
  const {
    categoryId,
    groupId,
    title,
    priceRub,
    description,
    images,
    links,
    strength,
    cost_price,
    costPrice,
    stock,
    min_stock,
    minStock,
    useCategoryImage,
    hasVariants,
    variants
  } = req.body || {};
  if (!categoryId) return res.status(400).json({ error: 'missing_fields' });
  
  // Валидация: товар с вариантами или обычный товар
  if (hasVariants) {
    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: 'variants_required' });
    }
    // Проверяем каждый вариант
    for (const variant of variants) {
      if (!variant.name || variant.name.trim().length === 0) {
        return res.status(400).json({ error: 'variant_name_required' });
      }
      if (variant.priceRub !== undefined && !Number.isFinite(Number(variant.priceRub))) {
        return res.status(400).json({ error: 'invalid_variant_price' });
      }
    }
  } else {
    if (!Number.isFinite(Number(priceRub))) {
      return res.status(400).json({ error: 'missing_fields' });
    }
  }

  const normalizedCostPrice = cost_price ?? costPrice ?? 0;
  const normalizedStock = stock ?? 0;
  const normalizedMinStock = min_stock ?? minStock ?? 0;
  const normalizedUseCategoryImage = useCategoryImage === true ? 1 : 0;

  const categoryExists = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
  if (!categoryExists) {
    return res.status(400).json({ error: 'invalid_category' });
  }

  let normalizedGroupId = null;
  if (groupId) {
    const groupRow = db.prepare('SELECT id, categoryId FROM category_groups WHERE id = ?').get(groupId);
    if (!groupRow) {
      return res.status(400).json({ error: 'invalid_group' });
    }
    if (groupRow.categoryId !== categoryId) {
      return res.status(400).json({ error: 'group_category_mismatch' });
    }
    normalizedGroupId = groupRow.id;
  }
  
  const id = 'p_' + Math.random().toString(36).slice(2, 8);
  const createdAt = new Date().toISOString();
  
  try {
    console.log(`[admin] Creating product ${id} with data:`, { categoryId, title, priceRub, description, images, hasVariants, variants });
    
    // First create the product without transaction to ensure it works
    try {
      db.prepare('INSERT INTO products (id, categoryId, groupId, title, priceRub, description, strength, cost_price, stock, min_stock, use_category_image, has_variants, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(
          id,
          categoryId,
          normalizedGroupId,
          title || null,
          hasVariants ? 0 : Number(priceRub),
          description || null,
          strength || null,
          Number(normalizedCostPrice) || 0,
          Number(normalizedStock) || 0,
          Number(normalizedMinStock) || 0,
          normalizedUseCategoryImage,
          hasVariants ? 1 : 0,
          createdAt
        );
      console.log(`[admin] Product ${id} created in database`);
    } catch (dbError) {
      console.error(`[admin] Failed to create product in database:`, dbError);
      throw dbError;
    }
    
    // Handle variants if product has them
    if (hasVariants && Array.isArray(variants) && variants.length > 0) {
      console.log(`[admin] Creating ${variants.length} variants for product ${id}`);
      const variantStmt = db.prepare('INSERT INTO product_variants (id, product_id, name, color_code, price_rub, stock, position) VALUES (?, ?, ?, ?, ?, ?, ?)');
      
      for (let idx = 0; idx < variants.length; idx++) {
        const variant = variants[idx];
        const variantId = `v_${Math.random().toString(36).slice(2, 8)}`;
        
        variantStmt.run(
          variantId,
          id,
          variant.name,
          variant.colorCode || null,
          variant.priceRub ? Number(variant.priceRub) : null,
          variant.stock !== undefined ? Number(variant.stock) : 0,
          idx
        );
        
        console.log(`[admin] Created variant ${variantId}: ${variant.name}`);
        
        // Store variant ID back to variant object for image processing
        variant._id = variantId;
      }
    }
    
    // Handle images if provided (separate from product creation)
    const processedUrls = [];
    
    if (hasVariants) {
      // Для товаров с вариантами обрабатываем изображения каждого варианта
      if (Array.isArray(variants)) {
        const tempDir = path.resolve(baseUploads, 'temp');
        const productDir = path.resolve(baseUploads, 'products', id);
        ensureDir(productDir);
        
        for (const variant of variants) {
          if (Array.isArray(variant.images) && variant.images.length > 0) {
            console.log(`[admin] Processing ${variant.images.length} images for variant ${variant._id}`);
            
            for (let imgIdx = 0; imgIdx < variant.images.length; imgIdx++) {
              const tempUrl = variant.images[imgIdx];
              
              if (tempUrl.startsWith('/uploads/temp/')) {
                const filename = path.basename(tempUrl);
                const tempPath = path.resolve(tempDir, filename);
                const newPath = path.resolve(productDir, filename);
                const newUrl = `/uploads/products/${id}/${filename}`;
                
                try {
                  if (fs.existsSync(tempPath)) {
                    fs.renameSync(tempPath, newPath);
                    // Сохраняем изображение с привязкой к варианту
                    db.prepare('INSERT INTO product_images (productId, url, position, variant_id) VALUES (?, ?, ?, ?)')
                      .run(id, newUrl, imgIdx, variant._id);
                    console.log(`[admin] Added image ${newUrl} to variant ${variant._id}`);
                  } else {
                    console.warn(`[admin] Temp file not found: ${tempPath}`);
                  }
                } catch (moveError) {
                  console.error(`[admin] Failed to move file ${tempPath}:`, moveError);
                }
              } else {
                // Не temp URL, сохраняем как есть
                db.prepare('INSERT INTO product_images (productId, url, position, variant_id) VALUES (?, ?, ?, ?)')
                  .run(id, tempUrl, imgIdx, variant._id);
              }
            }
          }
        }
      }
    } else if (Array.isArray(images) && images.length > 0) {
      // Обычный товар без вариантов
      console.log(`[admin] Processing ${images.length} images for product ${id}`);
      
      try {
        // Move files from temp to products folder and update URLs
        const tempDir = path.resolve(baseUploads, 'temp');
        const productDir = path.resolve(baseUploads, 'products', id);
        
        console.log(`[admin] Temp dir: ${tempDir}`);
        console.log(`[admin] Product dir: ${productDir}`);
        
        // Ensure product directory exists
        ensureDir(productDir);
        console.log(`[admin] Product directory created/verified`);
        
        for (const tempUrl of images) {
          console.log(`[admin] Processing image: ${tempUrl}`);
          
          if (tempUrl.startsWith('/uploads/temp/')) {
            const filename = path.basename(tempUrl);
            const tempPath = path.resolve(tempDir, filename);
            const newPath = path.resolve(productDir, filename);
            const newUrl = `/uploads/products/${id}/${filename}`;
            
            console.log(`[admin] Moving file: ${tempPath} -> ${newPath}`);
            
            try {
              // Move file from temp to products folder
              if (fs.existsSync(tempPath)) {
                fs.renameSync(tempPath, newPath);
                processedUrls.push(newUrl);
                console.log(`[admin] Moved ${tempUrl} -> ${newUrl}`);
              } else {
                console.warn(`[admin] Temp file not found: ${tempPath}`);
                // Keep original URL if file doesn't exist
                processedUrls.push(tempUrl);
              }
            } catch (moveError) {
              console.error(`[admin] Failed to move file ${tempPath}:`, moveError);
              // Keep original URL if move fails
              processedUrls.push(tempUrl);
            }
          } else {
            // Not a temp URL, keep as is
            processedUrls.push(tempUrl);
            console.log(`[admin] Keeping non-temp URL: ${tempUrl}`);
          }
        }
        
        // Insert images into database
        if (processedUrls.length > 0) {
          try {
            const imgStmt = db.prepare('INSERT INTO product_images (productId, url, position) VALUES (?, ?, ?)');
            processedUrls.forEach((url, index) => {
              console.log(`[admin] Adding image ${index}: ${url}`);
              imgStmt.run(id, url, index);
            });
            console.log(`[admin] Added ${processedUrls.length} images to product ${id}`);
          } catch (imgDbError) {
            console.error(`[admin] Failed to insert images into database:`, imgDbError);
            // Continue without images rather than failing completely
          }
        }
      } catch (imageError) {
        console.error(`[admin] Image processing failed:`, imageError);
        // Continue without images rather than failing completely
      }
    }
    
    // Return created product with images
    const product = db.prepare(`
      SELECT 
        p.id,
        p.categoryId,
        p.groupId,
        p.title,
        p.priceRub,
        p.description,
        p.strength,
        p.cost_price AS costPrice,
        p.stock,
        p.min_stock AS minStock,
        p.use_category_image AS useCategoryImage,
        p.has_variants AS hasVariants,
        p.createdAt,
        g.slug AS groupSlug,
        g.name AS groupName
      FROM products p
      LEFT JOIN category_groups g ON p.groupId = g.id
      WHERE p.id = ?
    `).get(id);
    
    let productImages = [];
    let productVariants = [];
    
    if (product.hasVariants) {
      // Для товаров с вариантами получаем варианты и их изображения
      productVariants = db.prepare(`
        SELECT id, product_id, name, color_code AS colorCode, price_rub AS priceRub, stock, position
        FROM product_variants
        WHERE product_id = ?
        ORDER BY position ASC
      `).all(id);
      
      // Добавляем изображения к каждому варианту
      for (const variant of productVariants) {
        variant.images = db.prepare(
          'SELECT url FROM product_images WHERE productId = ? AND variant_id = ? ORDER BY position ASC'
        ).all(id, variant.id).map(r => r.url);
      }
    } else {
      // Обычный товар - получаем изображения без variant_id
      productImages = db.prepare('SELECT url FROM product_images WHERE productId = ? AND variant_id IS NULL ORDER BY position ASC').all(id).map(r => r.url);
    }

    const normalizedLinks = Array.isArray(links)
      ? links
          .map((link, index) => ({
            label: typeof link?.label === 'string' && link.label.trim().length > 0 ? link.label.trim() : null,
            url: typeof link?.url === 'string' ? link.url.trim() : '',
            position: index
          }))
          .filter(link => link.url.length > 0)
      : [];

    if (normalizedLinks.length > 0) {
      const linkStmt = db.prepare('INSERT INTO product_links (productId, label, url, position) VALUES (?, ?, ?, ?)');
      const txLinks = db.transaction((items) => {
        items.forEach(link => {
          linkStmt.run(id, link.label, link.url, link.position);
        });
      });
      txLinks(normalizedLinks);
    }

    const productLinks = db.prepare('SELECT label, url FROM product_links WHERE productId = ? ORDER BY position ASC').all(id).map(row => ({
      label: row.label ?? '',
      url: row.url
    }));
    
    console.log(`[admin] Product creation completed:`, { product, images: productImages, variants: productVariants });
    
    const responseProduct = { ...product, links: productLinks };
    if (product.hasVariants) {
      responseProduct.variants = productVariants;
    } else {
      responseProduct.images = productImages;
    }
    
    res.json({ 
      ok: true, 
      id, 
      product: responseProduct
    });
  } catch (error) {
    console.error('[admin] Product creation failed:', error);
    res.status(500).json({ error: 'creation_failed', message: error.message });
  }
});

adminRouter.patch('/api/admin/products/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ error: 'not_found' });
  
  console.log('[admin] PATCH /products/:id - Request body:', JSON.stringify(req.body, null, 2));
  
  const {
    categoryId,
    groupId,
    title,
    priceRub,
    description,
    links,
    strength,
    cost_price,
    costPrice,
    stock,
    min_stock,
    minStock,
    useCategoryImage,
    hasVariants,
    variants
  } = req.body || {};

  const normalizedCostPrice = cost_price ?? costPrice;
  const normalizedMinStock = min_stock ?? minStock;
  const normalizedUseCategoryImage = useCategoryImage !== undefined 
    ? (useCategoryImage === true ? 1 : 0)
    : cur.use_category_image;

  let nextCategoryId = categoryId || cur.categoryId;
  const categoryExists = db.prepare('SELECT id FROM categories WHERE id = ?').get(nextCategoryId);
  if (!categoryExists) {
    return res.status(400).json({ error: 'invalid_category' });
  }

  let nextGroupId = cur.groupId;
  if (groupId !== undefined) {
    if (groupId === null || groupId === '') {
      nextGroupId = null;
    } else {
      const groupRow = db.prepare('SELECT id, categoryId FROM category_groups WHERE id = ?').get(groupId);
      if (!groupRow) {
        return res.status(400).json({ error: 'invalid_group' });
      }
      if (groupRow.categoryId !== nextCategoryId) {
        return res.status(400).json({ error: 'group_category_mismatch' });
      }
      nextGroupId = groupRow.id;
    }
  }

  // Если сменили категорию, но текущий groupId к ней не относится — сбрасываем
  if (groupId === undefined && nextGroupId) {
    const belongs = db.prepare('SELECT id FROM category_groups WHERE id = ? AND categoryId = ?').get(nextGroupId, nextCategoryId);
    if (!belongs) {
      nextGroupId = null;
    }
  }

  const normalizedHasVariants = hasVariants !== undefined ? (hasVariants === true ? 1 : 0) : cur.has_variants;

  db.prepare('UPDATE products SET categoryId = ?, groupId = ?, title = ?, priceRub = ?, description = ?, strength = ?, cost_price = ?, stock = ?, min_stock = ?, use_category_image = ?, has_variants = ? WHERE id = ?')
    .run(
      nextCategoryId,
      nextGroupId,
      (title !== undefined ? title : cur.title),
      (Number.isFinite(Number(priceRub)) ? Number(priceRub) : cur.priceRub),
      (description !== undefined ? description : cur.description),
      (strength !== undefined ? strength : cur.strength),
      (normalizedCostPrice !== undefined ? Number(normalizedCostPrice) : (cur.cost_price ?? 0)),
      (stock !== undefined ? Number(stock) : (cur.stock ?? 0)),
      (normalizedMinStock !== undefined ? Number(normalizedMinStock) : (cur.min_stock ?? 0)),
      normalizedUseCategoryImage,
      normalizedHasVariants,
      id
    );

  if (Array.isArray(links)) {
    const normalizedLinks = links
      .map((link, index) => ({
        label: typeof link?.label === 'string' && link.label.trim().length > 0 ? link.label.trim() : null,
        url: typeof link?.url === 'string' ? link.url.trim() : '',
        position: index
      }))
      .filter(link => link.url.length > 0);

    const deleteStmt = db.prepare('DELETE FROM product_links WHERE productId = ?');
    const insertStmt = db.prepare('INSERT INTO product_links (productId, label, url, position) VALUES (?, ?, ?, ?)');
    const txLinks = db.transaction((items) => {
      deleteStmt.run(id);
      items.forEach(link => {
        insertStmt.run(id, link.label, link.url, link.position);
      });
    });

    txLinks(normalizedLinks);
  }

  // Обработка вариантов
  try {
    if (normalizedHasVariants && Array.isArray(variants)) {
      console.log('[admin] Processing variants:', variants.length);
      
      const deleteVariantsStmt = db.prepare('DELETE FROM product_variants WHERE product_id = ?');
      const deleteAllImagesStmt = db.prepare('DELETE FROM product_images WHERE productId = ?');
      const variantStmt = db.prepare('INSERT INTO product_variants (id, product_id, name, color_code, price_rub, stock, position) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const imageStmt = db.prepare('INSERT INTO product_images (productId, variant_id, url, position) VALUES (?, ?, ?, ?)');
      
      const txVariants = db.transaction((items) => {
        // ВАЖНО: Сначала удаляем ВСЕ изображения товара, затем варианты
        deleteAllImagesStmt.run(id);
        deleteVariantsStmt.run(id);
        
        let globalImagePosition = 0; // Глобальный счётчик для position всех изображений товара
        
        items.forEach((variant, index) => {
          const variantId = variant.id || `${id}-${index}-${Date.now()}`;
          console.log(`[admin] Inserting variant ${index}:`, {
            variantId,
            name: variant.name,
            colorCode: variant.colorCode,
            priceRub: variant.priceRub,
            stock: variant.stock,
            imagesCount: variant.images?.length || 0
          });
          
          variantStmt.run(
            variantId,
            id,
            variant.name || '',
            variant.colorCode || variant.color || '',
            variant.priceRub !== null && variant.priceRub !== undefined ? Number(variant.priceRub) : null,
            variant.stock !== undefined ? Number(variant.stock) : 0,
            index
          );

          // Обработка изображений вариантов
          if (Array.isArray(variant.images) && variant.images.length > 0) {
            variant.images.forEach((img) => {
              // img может быть строкой URL или объектом с полем url
              const imageUrl = typeof img === 'string' ? img : img.url;
              console.log(`[admin] Inserting variant image at position ${globalImagePosition}:`, imageUrl);
              imageStmt.run(id, variantId, imageUrl, globalImagePosition);
              globalImagePosition++; // Инкрементируем глобальный счётчик
            });
          }
        });
      });
      txVariants(variants);
      console.log('[admin] Variants processed successfully');
    } else if (!normalizedHasVariants) {
      console.log('[admin] Removing variants (hasVariants = false)');
      // Если больше нет вариантов, удаляем все связанные данные
      db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM product_images WHERE variant_id IS NOT NULL AND productId = ?').run(id);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[admin] Error processing variants:', error);
    res.status(500).json({ error: 'variants_processing_failed', message: error.message });
  }
});

adminRouter.delete('/api/admin/products/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ ok: true });
});

adminRouter.post('/api/admin/products/:id/images/attach', authMiddleware, (req, res) => {
  const id = req.params.id;
  const { urls } = req.body || {};
  if (!Array.isArray(urls) || urls.length === 0) return res.status(400).json({ error: 'urls_required' });
  const cur = db.prepare('SELECT COUNT(*) as c FROM product_images WHERE productId = ?').get(id).c;
  const stmt = db.prepare('INSERT INTO product_images (productId, url, position) VALUES (?, ?, ?)');
  const tx = db.transaction((rows, start) => {
    let pos = start;
    for (const u of rows) { stmt.run(id, u, pos++); }
  });
  tx(urls, cur);
  res.json({ ok: true });
});

adminRouter.get('/api/admin/products', authMiddleware, (req, res) => {
  const page = Math.max(parseInt(req.query.page ?? '1', 10) || 1, 1)
  const limit = Math.min(Math.max(parseInt(req.query.limit ?? '20', 10) || 20, 1), 100)
  const category = req.query.category
  const search = req.query.search

  let where = ''
  const params = []
  if (category) { where += (where ? ' AND ' : 'WHERE ') + 'p.categoryId = ?'; params.push(String(category)) }
  if (search) {
    where += (where ? ' AND ' : 'WHERE ') + '(p.title LIKE ? OR p.description LIKE ?)'
    const pat = `%${search}%`; params.push(pat, pat)
  }

  const total = (params.length
    ? db.prepare(`SELECT COUNT(*) as total FROM products p ${where}`).get(...params)
    : db.prepare(`SELECT COUNT(*) as total FROM products p ${where}`).get()
  ).total

  const offset = (page - 1) * limit
  const rows = (params.length
    ? db.prepare(`
        SELECT 
          p.id, 
          p.categoryId, 
          p.groupId,
          c.name as categoryName, 
          p.title, 
          p.priceRub, 
          p.description, 
          p.strength,
          p.cost_price AS costPrice,
          p.stock,
          p.min_stock AS minStock,
          p.use_category_image AS useCategoryImage,
          p.has_variants AS hasVariants,
          p.createdAt,
          g.name as groupName,
          g.slug as groupSlug
        FROM products p 
        LEFT JOIN categories c ON p.categoryId = c.id
        LEFT JOIN category_groups g ON p.groupId = g.id
        ${where}
        ORDER BY p.createdAt DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset)
    : db.prepare(`
        SELECT 
          p.id, 
          p.categoryId, 
          p.groupId,
          c.name as categoryName, 
          p.title, 
          p.priceRub, 
          p.description, 
          p.strength,
          p.cost_price AS costPrice,
          p.stock,
          p.min_stock AS minStock,
          p.use_category_image AS useCategoryImage,
          p.has_variants AS hasVariants,
          p.createdAt,
          g.name as groupName,
          g.slug as groupSlug
        FROM products p 
        LEFT JOIN categories c ON p.categoryId = c.id
        LEFT JOIN category_groups g ON p.groupId = g.id
        ${where}
        ORDER BY p.createdAt DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset)
  )

  const imgStmt = db.prepare('SELECT url FROM product_images WHERE productId = ? AND variant_id IS NULL ORDER BY position ASC')
  const linkStmt = db.prepare('SELECT label, url FROM product_links WHERE productId = ? ORDER BY position ASC')
  const variantStmt = db.prepare(`
    SELECT id, product_id, name, color_code AS colorCode, price_rub AS priceRub, stock, position
    FROM product_variants
    WHERE product_id = ?
    ORDER BY position ASC
  `)
  const variantImgStmt = db.prepare('SELECT url FROM product_images WHERE productId = ? AND variant_id = ? ORDER BY position ASC')
  
  const products = rows.map(r => {
    const product = {
      ...r,
      links: linkStmt.all(r.id).map(link => ({ label: link.label ?? '', url: link.url }))
    };
    
    if (r.hasVariants) {
      const variants = variantStmt.all(r.id);
      product.variants = variants.map(v => ({
        ...v,
        images: variantImgStmt.all(r.id, v.id).map(x => x.url)
      }));
      
      // Рассчитываем минимальный и максимальный остаток из вариантов
      if (variants.length > 0) {
        const stocks = variants.map(v => Number(v.stock || 0));
        product.minVariantStock = Math.min(...stocks);
        product.maxVariantStock = Math.max(...stocks);
      } else {
        product.minVariantStock = 0;
        product.maxVariantStock = 0;
      }
    } else {
      product.images = imgStmt.all(r.id).map(x => x.url);
    }
    
    return product;
  })

  res.json({ products, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } })
})

adminRouter.get('/api/admin/products/:id', authMiddleware, (req, res) => {
  const id = req.params.id
  const p = db.prepare(`
    SELECT 
      p.id,
      p.categoryId,
      p.groupId,
      p.title,
      p.priceRub,
      p.description,
      p.strength,
      p.cost_price AS costPrice,
      p.stock,
      p.min_stock AS minStock,
      p.use_category_image AS useCategoryImage,
      p.has_variants AS hasVariants,
      p.createdAt,
      g.name as groupName,
      g.slug as groupSlug
    FROM products p
    LEFT JOIN category_groups g ON p.groupId = g.id
    WHERE p.id = ?
  `).get(id)
  if (!p) return res.status(404).json({ error: 'not_found' })
  
  const links = db.prepare('SELECT label, url FROM product_links WHERE productId = ? ORDER BY position ASC').all(id).map(row => ({
    label: row.label ?? '',
    url: row.url
  }))
  
  const result = { ...p, links };
  
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
    
    // Рассчитываем минимальный и максимальный остаток из вариантов
    if (variants.length > 0) {
      const stocks = variants.map(v => Number(v.stock || 0));
      result.minVariantStock = Math.min(...stocks);
      result.maxVariantStock = Math.max(...stocks);
    } else {
      result.minVariantStock = 0;
      result.maxVariantStock = 0;
    }
  } else {
    // Обычный товар - получаем изображения без variant_id
    result.images = db.prepare('SELECT url FROM product_images WHERE productId = ? AND variant_id IS NULL ORDER BY position ASC')
      .all(id).map(r => r.url);
  }
  
  res.json(result)
})

adminRouter.patch('/api/admin/products/:id/images/reorder', authMiddleware, (req, res) => {
  const id = req.params.id;
  const { urls } = req.body || {};
  if (!Array.isArray(urls)) return res.status(400).json({ error: 'urls_required' });
  const tx = db.transaction((arr) => {
    db.prepare('DELETE FROM product_images WHERE productId = ?').run(id);
    const stmt = db.prepare('INSERT INTO product_images (productId, url, position) VALUES (?, ?, ?)');
    arr.forEach((u, i) => stmt.run(id, u, i));
  });
  tx(urls);
  res.json({ ok: true });
});

adminRouter.delete('/api/admin/products/:id/images', authMiddleware, (req, res) => {
  const id = req.params.id;
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url_required' });
  const rows = db.prepare('SELECT url FROM product_images WHERE productId = ? ORDER BY position ASC').all(id).map(r => r.url);
  const next = rows.filter(u => u !== url);
  const tx = db.transaction((arr) => {
    db.prepare('DELETE FROM product_images WHERE productId = ?').run(id);
    const stmt = db.prepare('INSERT INTO product_images (productId, url, position) VALUES (?, ?, ?)');
    arr.forEach((u, i) => stmt.run(id, u, i));
  });
  tx(next);
  res.json({ ok: true });
});

// Categories CRUD
adminRouter.get('/api/admin/categories', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT c.id, c.slug, c.name, c.[order], c.hide_empty, c.cover_image, c.display_mode, COUNT(p.id) as productCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.categoryId
      GROUP BY c.id, c.slug, c.name, c.[order], c.hide_empty, c.cover_image, c.display_mode
      ORDER BY c.[order] ASC, c.name ASC
    `).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'failed', details: String(e) });
  }
});

// Banners CRUD
adminRouter.get('/api/admin/banners', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT id, title, image, href, active, [order], openInNewTab FROM banners ORDER BY [order] ASC').all();
  res.json(rows);
});

adminRouter.post('/api/admin/banners', authMiddleware, (req, res) => {
  const { title, image, href, active = true, order, openInNewTab = false } = req.body || {};
  if (!image) return res.status(400).json({ error: 'image_required' });
  
  
  const id = 'b_' + Math.random().toString(36).slice(2, 8);
  
  // Определяем порядок автоматически, если не указан
  let finalOrder = order;
  if (!Number.isFinite(finalOrder)) {
    const maxOrder = db.prepare('SELECT MAX([order]) as maxOrder FROM banners').get();
    finalOrder = (maxOrder?.maxOrder || 0) + 1;
  }
  
  console.log('[admin] Creating banner with data:', { id, title, image, href, active, order: finalOrder, openInNewTab });
  
  // Создаём баннер
  db.prepare('INSERT INTO banners (id, title, image, href, active, [order], openInNewTab) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, title || null, image, href || null, active ? 1 : 0, finalOrder, openInNewTab ? 1 : 0);
  
  // Возвращаем полные данные созданного баннера
  res.json({
    id,
    title: title || null,
    image,
    href: href || null,
    active: active ? 1 : 0,
    order: finalOrder,
    openInNewTab: openInNewTab ? 1 : 0
  });
});

adminRouter.patch('/api/admin/banners/reorder', authMiddleware, (req, res) => {
  console.log('🔥 [server] Banners reorder endpoint called')
  console.log('🔥 [server] request.body:', JSON.stringify(req.body, null, 2))
  
  const { banners } = req.body || {};
  console.log('🔥 [server] Extracted banners:', banners)
  
  if (!Array.isArray(banners)) {
    console.log('🔥 [server] ERROR: banners is not array:', banners)
    return res.status(400).json({ error: 'banners_required' })
  }
  
  // Проверим каждый баннер
  for (const banner of banners) {
    if (!banner.id || !Number.isFinite(banner.order)) {
      console.log('🔥 [server] ERROR: invalid banner:', banner)
      return res.status(400).json({ error: 'invalid_banner_data' })
    }
  }
  
  try {
    const stmt = db.prepare('UPDATE banners SET [order] = ? WHERE id = ?')
    const tx = db.transaction((bannersToReorder) => {
      for (const banner of bannersToReorder) {
        const result = stmt.run(banner.order, banner.id)
        if (result.changes === 0) {
          throw new Error(`Banner not found: ${banner.id}`)
        }
      }
    })
    
    tx(banners)
    console.log('🔥 [server] Banners reordered successfully!')
    res.json({ success: true, message: 'Banners reordered' })
  } catch (error) {
    console.error('🔥 [server] Reorder error:', error)
    res.status(500).json({ error: 'reorder_failed', message: error.message })
  }
});

adminRouter.patch('/api/admin/banners/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const { title, image, href, active, order, openInNewTab } = req.body || {};
  const cur = db.prepare('SELECT * FROM banners WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ error: 'not_found' });
  
  
  // Обновляем баннер
  db.prepare('UPDATE banners SET title = ?, image = ?, href = ?, active = ?, [order] = ?, openInNewTab = ? WHERE id = ?')
    .run(
      (title !== undefined ? title : cur.title),
      (image !== undefined ? image : cur.image), 
      (href !== undefined ? href : cur.href), 
      (active !== undefined ? (active ? 1 : 0) : cur.active), 
      (Number.isFinite(order) ? order : cur.order),
      (openInNewTab !== undefined ? (openInNewTab ? 1 : 0) : (cur.openInNewTab || 0)), 
      id
    );
  
  // Возвращаем обновлённые данные
  const updated = db.prepare('SELECT * FROM banners WHERE id = ?').get(id);
  res.json({
    id: updated.id,
    title: updated.title,
    image: updated.image,
    href: updated.href,
    active: updated.active, // оставляем как integer для совместимости
    order: updated.order,
    openInNewTab: updated.openInNewTab || 0
  });
});

adminRouter.delete('/api/admin/banners/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM banners WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Categories CRUD
adminRouter.post('/api/admin/categories', authMiddleware, (req, res) => {
  const { name, order, hide_empty, coverImage, cover_image, displayMode, display_mode } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name_required' });
  // Проверяем дубликаты по имени сразу
  const existingByName = db.prepare('SELECT id, name FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))').get(name);
  if (existingByName) {
    console.log('[admin] Name conflict detected during creation with category:', existingByName);
    return res.status(400).json({ 
      error: 'duplicate_category_name', 
      message: `Категория с таким названием уже существует: "${existingByName.name}"`,
      conflictingCategory: existingByName.name
    });
  }
  
  let baseSlug;
  try {
    baseSlug = slugify(name, { lower: true, strict: true });
  } catch (slugError) {
    console.error('[admin] Slugify error in create:', slugError);
    // Fallback to simple slug generation
    baseSlug = name.toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    console.log('[admin] Fallback slug generated in create:', baseSlug);
  }
  let slug = baseSlug;
  let counter = 1;
  
  // Проверяем уникальность slug и добавляем суффикс при необходимости
  while (true) {
    const existing = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
    if (!existing) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  const id = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); // более уникальный ID

  const allowedDisplayModes = new Set(['default', 'liquid', 'visual']);
  let displayModeValue = String(displayMode ?? display_mode ?? 'default').trim().toLowerCase();
  if (!allowedDisplayModes.has(displayModeValue)) {
    displayModeValue = 'default';
  }
  
  // Получаем следующий order если не указан
  let finalOrder = order;
  if (!Number.isFinite(finalOrder)) {
    const maxOrder = db.prepare('SELECT MAX([order]) as maxOrder FROM categories').get();
    finalOrder = (maxOrder?.maxOrder || 0) + 1;
  }
  try {
    const hideEmptyValue = hide_empty ? 1 : 0;
    const coverImageValue = coverImage ?? cover_image ?? null;
    db.prepare('INSERT INTO categories (id, slug, name, [order], hide_empty, cover_image, display_mode) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, slug, name, finalOrder, hideEmptyValue, coverImageValue, displayModeValue);
    res.json({ ok: true, id, slug, name, order: finalOrder, hide_empty: hideEmptyValue, cover_image: coverImageValue, display_mode: displayModeValue });
  } catch (e) {
    console.error('[admin] Category creation failed:', e.message);
    res.status(400).json({ error: 'insert_failed', message: e.message, details: String(e) });
  }
});
adminRouter.put('/api/admin/categories/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, slug, order, hide_empty, coverImage, cover_image, displayMode, display_mode } = req.body || {};
  try {
    const cur = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    console.log('[admin] Current category in DB:', cur);
    
    if (!cur) return res.status(404).json({ error: 'not_found' });
    
    // Если меняется имя, сначала проверяем дубликаты по имени
    if (name && name !== cur.name) {
      const existingByName = db.prepare('SELECT id, name FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?').get(name, id);
      if (existingByName) {
        console.log('[admin] Name conflict detected with category:', existingByName);
        return res.status(400).json({ 
          error: 'duplicate_category_name', 
          message: `Категория с таким названием уже существует: "${existingByName.name}"`,
          conflictingCategory: existingByName.name
        });
      }
    }
    
    let newSlug = slug;
    if (name && !slug) {
      try {
        newSlug = slugify(name, { lower: true, strict: true });
        console.log('[admin] Generated new slug:', newSlug);
        
        // Проверяем уникальность slug (исключая текущую категорию)
        const existingCategory = db.prepare('SELECT id, name FROM categories WHERE slug = ? AND id != ?').get(newSlug, id);
        if (existingCategory) {
          console.log('[admin] Slug conflict detected with category:', existingCategory);
          return res.status(400).json({ 
            error: 'duplicate_category_slug', 
            message: `Категория с похожим названием уже существует: "${existingCategory.name}"`,
            conflictingCategory: existingCategory.name
          });
        }
      } catch (slugError) {
        console.error('[admin] Slugify error:', slugError);
        // Fallback to simple slug generation
        newSlug = name.toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        console.log('[admin] Fallback slug generated:', newSlug);
        
        // Проверяем уникальность fallback slug тоже
        const existingCategory = db.prepare('SELECT id, name FROM categories WHERE slug = ? AND id != ?').get(newSlug, id);
        if (existingCategory) {
          console.log('[admin] Fallback slug conflict detected with category:', existingCategory);
          return res.status(400).json({ 
            error: 'duplicate_category', 
            message: `Категория с таким названием уже существует: "${existingCategory.name}"`,
            conflictingCategory: existingCategory.name
          });
        }
      }
    }
    
    const allowedDisplayModes = new Set(['default', 'liquid', 'visual']);
    let displayModeValue = cur.display_mode || 'default';
    if (displayMode !== undefined || display_mode !== undefined) {
      const incoming = String(displayMode ?? display_mode ?? '').trim().toLowerCase();
      displayModeValue = allowedDisplayModes.has(incoming) ? incoming : 'default';
    }

    const next = {
      name: name !== undefined ? name : cur.name,
      slug: newSlug !== undefined ? newSlug : cur.slug,
      order: Number.isFinite(order) ? Number(order) : cur.order,
      hide_empty: hide_empty !== undefined ? (hide_empty ? 1 : 0) : cur.hide_empty,
      cover_image: (() => {
        const incoming = coverImage !== undefined ? coverImage : cover_image;
        if (incoming !== undefined) {
          if (incoming === null) return null;
          const trimmed = String(incoming).trim();
          return trimmed.length ? trimmed : null;
        }
        return cur.cover_image ?? null;
      })(),
      display_mode: displayModeValue
    };
    
    const updateResult = db.prepare('UPDATE categories SET name = ?, slug = ?, [order] = ?, hide_empty = ?, cover_image = ?, display_mode = ? WHERE id = ?')
      .run(next.name, next.slug, next.order, next.hide_empty, next.cover_image, next.display_mode, id);
    console.log('[admin] Update result:', updateResult);
    console.log('[admin] Update completed successfully');
    res.json({ id, ...next });
  } catch (e) {
    console.error('[admin] Category update error:', e);
    console.error('[admin] Error stack:', e.stack);
    res.status(500).json({ error: 'failed', details: String(e), stack: e.stack });
  }
});

adminRouter.patch('/api/admin/categories/reorder', authMiddleware, (req, res) => {
  console.log('🔥 [server] Categories reorder endpoint called')
  console.log('🔥 [server] request.body:', JSON.stringify(req.body, null, 2))
  
  const { categories } = req.body || {}
  console.log('🔥 [server] Extracted categories:', categories)
  
  if (!Array.isArray(categories)) {
    console.log('🔥 [server] ERROR: categories is not array:', categories)
    return res.status(400).json({ error: 'categories_required' })
  }
  
  // Проверим каждую категорию
  for (const cat of categories) {
    if (!cat.id || !Number.isFinite(cat.order)) {
      console.log('🔥 [server] ERROR: invalid category:', cat)
      return res.status(400).json({ error: 'invalid_category_data' })
    }
  }
  
  try {
    const stmt = db.prepare('UPDATE categories SET [order] = ? WHERE id = ?')
    const tx = db.transaction((cats) => {
      for (const cat of cats) {
        const result = stmt.run(cat.order, cat.id)
        if (result.changes === 0) {
          throw new Error(`Category not found: ${cat.id}`)
        }
      }
    })
    
    tx(categories)
    console.log('🔥 [server] Categories reordered successfully!')
    res.json({ success: true, message: 'Categories reordered' })
  } catch (error) {
    console.error('🔥 [server] Reorder error:', error)
    res.status(500).json({ error: 'reorder_failed', message: error.message })
  }
})

adminRouter.delete('/api/admin/categories/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Category groups CRUD
adminRouter.get('/api/admin/category-groups', authMiddleware, (req, res) => {
  const { categoryId } = req.query;
  const params = [];
  let whereClause = '';

  if (categoryId) {
    whereClause = 'WHERE g.categoryId = ?';
    params.push(String(categoryId));
  }

  const rows = db.prepare(`
    SELECT 
      g.id,
      g.categoryId,
      g.slug,
      g.name,
      g.cover_image,
      g.[order],
      g.hide_empty,
      g.parent_group_id,
      g.createdAt,
      g.updatedAt,
      COUNT(p.id) AS productCount
    FROM category_groups g
    LEFT JOIN products p ON p.groupId = g.id
    ${whereClause}
    GROUP BY g.id, g.categoryId, g.slug, g.name, g.cover_image, g.[order], g.hide_empty, g.parent_group_id, g.createdAt, g.updatedAt
    ORDER BY g.categoryId ASC, g.[order] ASC, g.name ASC
  `).all(...params);

  const nodes = rows.map(row => ({
    ...row,
    productCount: Number(row.productCount ?? 0),
    parent_group_id: row.parent_group_id ?? null,
    children: []
  }));

  const nodesById = new Map();
  const rootsByCategory = new Map();

  nodes.forEach(node => {
    nodesById.set(node.id, node);
  });

  nodes.forEach(node => {
    if (node.parent_group_id && nodesById.has(node.parent_group_id)) {
      nodesById.get(node.parent_group_id).children.push(node);
    } else {
      const list = rootsByCategory.get(node.categoryId) || [];
      list.push(node);
      rootsByCategory.set(node.categoryId, list);
    }
  });

  const computeTotals = (node) => {
    node.children.sort((a, b) => (a['order'] ?? 0) - (b['order'] ?? 0));
    let total = Number(node.productCount ?? 0);
    node.children.forEach(child => {
      total += computeTotals(child);
    });
    node.totalProductCount = total;
    return total;
  };

  rootsByCategory.forEach(list => {
    list.forEach(node => computeTotals(node));
  });

  const flattened = [];
  const visit = (node) => {
    const { children, ...rest } = node;
    flattened.push({
      ...rest,
      productCount: Number(node.productCount ?? 0),
      totalProductCount: Number(node.totalProductCount ?? node.productCount ?? 0)
    });
    node.children.forEach(child => visit(child));
  };

  rootsByCategory.forEach(list => {
    list
      .sort((a, b) => (a['order'] ?? 0) - (b['order'] ?? 0))
      .forEach(node => visit(node));
  });

  res.json(flattened);
});

adminRouter.post('/api/admin/category-groups', authMiddleware, (req, res) => {
  const { categoryId, name, slug, coverImage, hide_empty, parentId } = req.body || {};

  if (!categoryId || !name) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(String(categoryId));
  if (!category) {
    return res.status(400).json({ error: 'invalid_category' });
  }

  const finalSlug = generateGroupSlug(String(categoryId), name, slug, null);
  const newId = 'cg_' + Math.random().toString(36).slice(2, 8);
  const maxOrderRow = db.prepare('SELECT MAX([order]) as maxOrder FROM category_groups WHERE categoryId = ?').get(String(categoryId));
  const nextOrder = (maxOrderRow?.maxOrder || 0) + 1;

  let resolvedParentId = null;
  if (parentId) {
    const parent = db.prepare('SELECT id, categoryId FROM category_groups WHERE id = ?').get(String(parentId));
    if (!parent) {
      return res.status(400).json({ error: 'invalid_parent_group' });
    }
    if (parent.categoryId !== String(categoryId)) {
      return res.status(400).json({ error: 'parent_category_mismatch' });
    }
    resolvedParentId = parent.id;
  }

  db.prepare(`
    INSERT INTO category_groups (id, categoryId, slug, name, cover_image, [order], hide_empty, parent_group_id, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'), DATETIME('now'))
  `).run(newId, String(categoryId), finalSlug, name, coverImage || null, nextOrder, hide_empty ? 1 : 0, resolvedParentId);

  const result = db.prepare(`
    SELECT 
      g.id,
      g.categoryId,
      g.slug,
      g.name,
      g.cover_image,
      g.[order],
      g.hide_empty,
      g.parent_group_id,
      g.createdAt,
      g.updatedAt,
      COUNT(p.id) AS productCount
    FROM category_groups g
    LEFT JOIN products p ON p.groupId = g.id
    WHERE g.id = ?
    GROUP BY g.id, g.categoryId, g.slug, g.name, g.cover_image, g.[order], g.hide_empty, g.parent_group_id, g.createdAt, g.updatedAt
  `).get(newId);

  if (!result) {
    return res.status(500).json({ error: 'create_failed' });
  }

  const totalRow = db.prepare(`
    WITH RECURSIVE group_tree(id) AS (
      SELECT id FROM category_groups WHERE id = ?
      UNION ALL
      SELECT cg.id FROM category_groups cg
      JOIN group_tree gt ON cg.parent_group_id = gt.id
    )
    SELECT COUNT(p.id) AS total
    FROM group_tree gt
    LEFT JOIN products p ON p.groupId = gt.id
  `).get(newId);

  res.json({
    ...result,
    productCount: Number(result.productCount ?? 0),
    totalProductCount: Number(totalRow?.total ?? result.productCount ?? 0)
  });
});

adminRouter.put('/api/admin/category-groups/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, slug, coverImage, hide_empty, order, parentId } = req.body || {};

  const current = db.prepare('SELECT * FROM category_groups WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: 'not_found' });
  }

  const nextName = name ? String(name) : current.name;
  const nextSlug = generateGroupSlug(current.categoryId, nextName, slug, id);
  const nextCover = coverImage !== undefined ? (coverImage ? String(coverImage) : null) : current.cover_image;
  const nextHideEmpty = hide_empty !== undefined ? (hide_empty ? 1 : 0) : current.hide_empty;
  const nextOrder = Number.isFinite(Number(order)) ? Number(order) : current.order;

  let nextParentId = current.parent_group_id ?? null;
  if (parentId !== undefined) {
    if (!parentId) {
      nextParentId = null;
    } else if (parentId === id) {
      return res.status(400).json({ error: 'invalid_parent_self' });
    } else {
      const parent = db.prepare('SELECT id, categoryId FROM category_groups WHERE id = ?').get(String(parentId));
      if (!parent) {
        return res.status(400).json({ error: 'invalid_parent_group' });
      }
      if (parent.categoryId !== current.categoryId) {
        return res.status(400).json({ error: 'parent_category_mismatch' });
      }

      // Prevent circular reference by ensuring selected parent is not a descendant of current
      const ancestors = new Set();
      let cursor = parent.parent_group_id;
      while (cursor) {
        if (cursor === id) {
          return res.status(400).json({ error: 'invalid_parent_cycle' });
        }
        const ancestor = db.prepare('SELECT parent_group_id FROM category_groups WHERE id = ?').get(cursor);
        if (!ancestor) break;
        if (ancestors.has(cursor)) break;
        ancestors.add(cursor);
        cursor = ancestor.parent_group_id;
      }

      nextParentId = parent.id;
    }
  }

  db.prepare(`
    UPDATE category_groups
    SET name = ?, slug = ?, cover_image = ?, hide_empty = ?, [order] = ?, parent_group_id = ?, updatedAt = DATETIME('now')
    WHERE id = ?
  `).run(nextName, nextSlug, nextCover, nextHideEmpty, nextOrder, nextParentId, id);

  const updated = db.prepare(`
    SELECT 
      g.id,
      g.categoryId,
      g.slug,
      g.name,
      g.cover_image,
      g.[order],
      g.hide_empty,
      g.parent_group_id,
      g.createdAt,
      g.updatedAt,
      COUNT(p.id) AS productCount
    FROM category_groups g
    LEFT JOIN products p ON p.groupId = g.id
    WHERE g.id = ?
    GROUP BY g.id, g.categoryId, g.slug, g.name, g.cover_image, g.[order], g.hide_empty, g.parent_group_id, g.createdAt, g.updatedAt
  `).get(id);

  if (!updated) {
    return res.status(404).json({ error: 'not_found' });
  }

  const totalRow = db.prepare(`
    WITH RECURSIVE group_tree(id) AS (
      SELECT id FROM category_groups WHERE id = ?
      UNION ALL
      SELECT cg.id FROM category_groups cg
      JOIN group_tree gt ON cg.parent_group_id = gt.id
    )
    SELECT COUNT(p.id) AS total
    FROM group_tree gt
    LEFT JOIN products p ON p.groupId = gt.id
  `).get(id);

  res.json({
    ...updated,
    productCount: Number(updated.productCount ?? 0),
    totalProductCount: Number(totalRow?.total ?? updated.productCount ?? 0)
  });
});

adminRouter.patch('/api/admin/category-groups/reorder', authMiddleware, (req, res) => {
  const { groups } = req.body || {};
  if (!Array.isArray(groups)) {
    return res.status(400).json({ error: 'groups_required' });
  }

  try {
    const stmt = db.prepare("UPDATE category_groups SET [order] = ?, updatedAt = DATETIME('now') WHERE id = ?");
    const tx = db.transaction((items) => {
      for (const item of items) {
        if (!item.id || !Number.isFinite(item.order)) {
          throw new Error('invalid_group_data');
        }
        const result = stmt.run(item.order, item.id);
        if (result.changes === 0) {
          throw new Error(`group_not_found:${item.id}`);
        }
      }
    });
    tx(groups);
    res.json({ ok: true });
  } catch (error) {
    console.error('[admin] reorder groups failed:', error);
    res.status(500).json({ error: 'reorder_failed', message: error.message });
  }
});

adminRouter.delete('/api/admin/category-groups/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const group = db.prepare('SELECT id, categoryId FROM category_groups WHERE id = ?').get(id);
  if (!group) {
    return res.status(404).json({ error: 'not_found' });
  }

  const tx = db.transaction((groupId) => {
    db.prepare('UPDATE products SET groupId = NULL WHERE groupId = ?').run(groupId);
    db.prepare('DELETE FROM category_groups WHERE id = ?').run(groupId);
  });
  tx(id);

  res.json({ ok: true });
});

// Category cross-sells management
adminRouter.get('/api/admin/categories/:id/cross-sells', authMiddleware, (req, res) => {
  const { id } = req.params;
  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (!category) {
    return res.status(404).json({ error: 'not_found' });
  }

  const rows = db.prepare(`
    SELECT 
      cs.productId,
      cs.[order],
      p.title,
      p.priceRub,
      p.description,
      p.createdAt,
      p.categoryId,
      p.groupId,
      g.name as groupName,
      g.slug as groupSlug
    FROM category_cross_sells cs
    JOIN products p ON p.id = cs.productId
    LEFT JOIN category_groups g ON p.groupId = g.id
    WHERE cs.categoryId = ?
    ORDER BY cs.[order] ASC
  `).all(id);

  const imageStmt = db.prepare('SELECT url FROM product_images WHERE productId = ? ORDER BY position ASC');
  const payload = rows.map(row => ({
    id: row.productId,
    title: row.title,
    priceRub: row.priceRub,
    description: row.description,
    createdAt: row.createdAt,
    categoryId: row.categoryId,
    groupId: row.groupId,
    groupName: row.groupName,
    groupSlug: row.groupSlug,
    images: imageStmt.all(row.productId).map(r => r.url)
  }));

  res.json(payload);
});

adminRouter.put('/api/admin/categories/:id/cross-sells', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { productIds } = req.body || {};

  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (!category) {
    return res.status(404).json({ error: 'not_found' });
  }

  if (!Array.isArray(productIds)) {
    return res.status(400).json({ error: 'product_ids_required' });
  }

  const uniqueProductIds = Array.from(new Set(productIds.map(String)));
  if (uniqueProductIds.length === 0) {
    db.prepare('DELETE FROM category_cross_sells WHERE categoryId = ?').run(id);
    return res.json([]);
  }

  const placeholders = uniqueProductIds.map(() => '?').join(',');
  const existingProducts = db.prepare(`SELECT id FROM products WHERE id IN (${placeholders})`).all(...uniqueProductIds);
  const existingIds = new Set(existingProducts.map(row => row.id));

  const missing = uniqueProductIds.filter(pid => !existingIds.has(pid));
  if (missing.length) {
    return res.status(400).json({ error: 'invalid_products', missing });
  }

  const tx = db.transaction((categoryId, ids) => {
    db.prepare('DELETE FROM category_cross_sells WHERE categoryId = ?').run(categoryId);
    const insertStmt = db.prepare('INSERT INTO category_cross_sells (id, categoryId, productId, [order]) VALUES (?, ?, ?, ?)');
    ids.forEach((pid, idx) => {
      const rowId = 'cs_' + Math.random().toString(36).slice(2, 8);
      insertStmt.run(rowId, categoryId, pid, idx + 1);
    });
  });

  tx(id, uniqueProductIds);

  const rows = db.prepare(`
    SELECT 
      cs.productId,
      cs.[order],
      p.title,
      p.priceRub,
      p.description,
      p.createdAt,
      p.categoryId,
      p.groupId,
      g.name as groupName,
      g.slug as groupSlug
    FROM category_cross_sells cs
    JOIN products p ON p.id = cs.productId
    LEFT JOIN category_groups g ON p.groupId = g.id
    WHERE cs.categoryId = ?
    ORDER BY cs.[order] ASC
  `).all(id);

  const imageStmt = db.prepare('SELECT url FROM product_images WHERE productId = ? ORDER BY position ASC');
  const payload = rows.map(row => ({
    id: row.productId,
    title: row.title,
    priceRub: row.priceRub,
    description: row.description,
    createdAt: row.createdAt,
    categoryId: row.categoryId,
    groupId: row.groupId,
    groupName: row.groupName,
    groupSlug: row.groupSlug,
    images: imageStmt.all(row.productId).map(r => r.url)
  }));

  res.json(payload);
});

// Settings CRUD
adminRouter.get('/api/admin/settings', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (error) {
    console.error('[admin] Failed to get settings:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});

adminRouter.post('/api/admin/settings', authMiddleware, (req, res) => {
  try {
    const { settings } = req.body || {};
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settings_object_required' });
    }
    
    // Обновляем настройки в транзакции
    const upsertStmt = db.prepare(`
      INSERT INTO settings (key, value) 
      VALUES (?, ?) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    
    const tx = db.transaction((settingsObj) => {
      Object.entries(settingsObj).forEach(([key, value]) => {
        upsertStmt.run(key, String(value));
      });
    });
    
    tx(settings);
    
    console.log('[admin] Settings updated:', settings);
    res.json({ ok: true, settings });
  } catch (error) {
    console.error('[admin] Failed to update settings:', error);
    res.status(500).json({ error: 'failed', message: error.message });
  }
});
