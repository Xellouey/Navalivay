import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'navalivay-inventory-'));
process.env.DATABASE_FILE = path.join(tempDir, 'test.db');
process.env.BOT_TOKEN = '';

const { initDb, db } = await import('../db.js');
const { issueToken } = await import('../auth.js');
const { adminRouter } = await import('../routes/admin.js');
const { crmOperationsRouter } = await import('../routes/crm-operations.js');
const { syncProductSearchIndex } = await import('../services/product-search-service.js');
const { migrateInventoryLocations } = await import('../migrations/add_inventory_locations.js');

initDb();

db.prepare(`
  INSERT INTO stock_transfers (
    id, transfer_number, source_location, destination_location, status, created_at
  ) VALUES ('legacy_interrupted', 999, 'retail', 'warehouse', 'draft', DATETIME('now'))
`).run();
migrateInventoryLocations();
const transferItemColumns = new Set(
  db.prepare("PRAGMA table_info('stock_transfer_items')").all().map((column) => column.name),
);
assert.ok(transferItemColumns.has('category_name'));
assert.ok(transferItemColumns.has('group_name'));
assert.ok(transferItemColumns.has('image_url'));
assert.equal(
  db.prepare('SELECT status FROM stock_transfers WHERE id = ?').get('legacy_interrupted').status,
  'completed',
);
db.prepare('DELETE FROM stock_transfers WHERE id = ?').run('legacy_interrupted');

db.exec(`
  DELETE FROM product_images;
  DELETE FROM product_variants;
  DELETE FROM products;
  DELETE FROM category_groups;
  DELETE FROM categories;

  INSERT INTO categories (id, slug, name, [order])
  VALUES ('cat_inventory', 'inventory', 'Inventory', 1);

  INSERT INTO category_groups (id, categoryId, slug, name, [order])
  VALUES ('group_inventory', 'cat_inventory', 'podgon', 'PODONKI PODGON', 1);

  INSERT INTO products (
    id, categoryId, groupId, title, priceRub, cost_price, stock, warehouse_stock,
    has_variants, createdAt
  ) VALUES
    ('product_regular', 'cat_inventory', 'group_inventory', 'Манго', 20, 5, 10, 0, 0, DATETIME('now')),
    ('product_variant', 'cat_inventory', 'group_inventory', 'XROS', 100, 30, 0, 0, 1, DATETIME('now'));

  INSERT INTO product_variants (
    id, product_id, name, price_rub, stock, warehouse_stock, position
  ) VALUES
    ('variant_black', 'product_variant', 'Чёрный', 100, 10, 0, 0),
    ('variant_white', 'product_variant', 'Белый', 100, 10, 0, 1);
`);

syncProductSearchIndex();

const app = express();
app.use(express.json());
app.use(adminRouter);
app.use(crmOperationsRouter);

const server = await new Promise((resolve) => {
  const instance = app.listen(0, () => resolve(instance));
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const token = issueToken('inventory-test');

async function requestJson(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return { response, data: await response.json() };
}

function regularStock() {
  return db.prepare('SELECT stock, warehouse_stock FROM products WHERE id = ?').get('product_regular');
}

function variantStock() {
  return db.prepare('SELECT stock, warehouse_stock FROM product_variants WHERE id = ?').get('variant_black');
}

try {
  const regularDisplay = db.prepare(`
    SELECT p.categoryId AS category_id,
           p.groupId AS group_id,
           c.name AS category_name,
           cg.name AS group_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.categoryId
    LEFT JOIN category_groups cg ON cg.id = p.groupId
    WHERE p.id = ?
  `).get('product_regular');
  assert.ok(regularDisplay.category_name);
  assert.ok(regularDisplay.group_name);
  db.prepare('INSERT INTO product_images (productId, url, position) VALUES (?, ?, ?)')
    .run('product_regular', '/uploads/regular-transfer.jpg', 0);
  db.prepare('INSERT INTO product_images (productId, variant_id, url, position) VALUES (?, ?, ?, ?)')
    .run('product_variant', null, '/uploads/variant-base.jpg', 0);
  db.prepare('INSERT INTO product_images (productId, variant_id, url, position) VALUES (?, ?, ?, ?)')
    .run('product_variant', 'variant_black', '/uploads/variant-black.jpg', 1);

  const moveToWarehouse = await requestJson('/api/admin/inventory/transfers', {
    method: 'POST',
    body: JSON.stringify({
      source_location: 'retail',
      destination_location: 'warehouse',
      comment: 'Первичное наполнение',
      items: [
        { product_id: 'product_regular', quantity: 4 },
        { product_id: 'product_variant', variant_id: 'variant_black', quantity: 3 },
      ],
    }),
  });
  assert.equal(moveToWarehouse.response.status, 200);
  assert.equal(moveToWarehouse.data.status, 'draft');
  assert.equal(moveToWarehouse.data.created_by, 'inventory-test');
  const regularTransferItem = moveToWarehouse.data.items.find((item) => item.product_id === 'product_regular');
  assert.equal(regularTransferItem.category_name, regularDisplay.category_name);
  assert.equal(regularTransferItem.group_name, regularDisplay.group_name);
  assert.equal(regularTransferItem.product_image, '/uploads/regular-transfer.jpg');
  const variantTransferItem = moveToWarehouse.data.items.find((item) => item.variant_id === 'variant_black');
  assert.equal(variantTransferItem.product_image, '/uploads/variant-black.jpg');

  db.prepare('UPDATE categories SET name = ? WHERE id = ?').run('Переименованная категория', regularDisplay.category_id);
  db.prepare('UPDATE category_groups SET name = ? WHERE id = ?').run('Переименованная линейка', regularDisplay.group_id);
  db.prepare('UPDATE product_images SET url = ? WHERE productId = ?')
    .run('/uploads/changed-after-transfer.jpg', 'product_regular');
  const savedTransfer = await requestJson(`/api/admin/inventory/transfers/${moveToWarehouse.data.id}`);
  const savedRegularItem = savedTransfer.data.items.find((item) => item.product_id === 'product_regular');
  assert.equal(savedRegularItem.category_name, regularDisplay.category_name);
  assert.equal(savedRegularItem.group_name, regularDisplay.group_name);
  assert.equal(savedRegularItem.product_image, '/uploads/regular-transfer.jpg');
  db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(regularDisplay.category_name, regularDisplay.category_id);
  db.prepare('UPDATE category_groups SET name = ? WHERE id = ?').run(regularDisplay.group_name, regularDisplay.group_id);
  db.prepare('UPDATE product_images SET url = ? WHERE productId = ?')
    .run('/uploads/regular-transfer.jpg', 'product_regular');
  db.prepare(`
    UPDATE stock_transfer_items
    SET category_name = NULL, group_name = NULL, image_url = NULL
    WHERE transfer_id = ? AND product_id = ?
  `).run(moveToWarehouse.data.id, 'product_regular');
  const legacyStyleTransfer = await requestJson(`/api/admin/inventory/transfers/${moveToWarehouse.data.id}`);
  const legacyStyleItem = legacyStyleTransfer.data.items.find((item) => item.product_id === 'product_regular');
  assert.equal(legacyStyleItem.category_name, regularDisplay.category_name);
  assert.equal(legacyStyleItem.group_name, regularDisplay.group_name);
  assert.equal(legacyStyleItem.product_image, '/uploads/regular-transfer.jpg');
  db.prepare('DELETE FROM product_images WHERE productId = ?').run('product_regular');
  db.prepare('UPDATE category_groups SET cover_image = ? WHERE id = ?')
    .run('/uploads/group-transfer.jpg', regularDisplay.group_id);
  const fallbackTransfer = await requestJson(`/api/admin/inventory/transfers/${moveToWarehouse.data.id}`);
  const fallbackTransferItem = fallbackTransfer.data.items.find((item) => item.product_id === 'product_regular');
  assert.equal(fallbackTransferItem.product_image, '/uploads/group-transfer.jpg');
  db.prepare('INSERT INTO product_images (productId, url, position) VALUES (?, ?, ?)')
    .run('product_regular', '/uploads/regular-transfer.jpg', 0);
  db.prepare('UPDATE category_groups SET cover_image = NULL WHERE id = ?').run(regularDisplay.group_id);

  db.prepare('DELETE FROM product_images WHERE productId = ? AND variant_id IS NULL').run('product_variant');
  db.prepare('UPDATE category_groups SET cover_image = ? WHERE id = ?')
    .run('/uploads/group-transfer.jpg', regularDisplay.group_id);
  const variantFallbackMove = await requestJson('/api/admin/inventory/transfers', {
    method: 'POST',
    body: JSON.stringify({
      source_location: 'retail',
      destination_location: 'warehouse',
      items: [{ product_id: 'product_variant', variant_id: 'variant_white', quantity: 1 }],
    }),
  });
  assert.equal(variantFallbackMove.response.status, 200);
  assert.equal(variantFallbackMove.data.items[0].product_image, '/uploads/group-transfer.jpg');
  assert.equal(
    db.prepare('SELECT image_url FROM stock_transfer_items WHERE transfer_id = ?').get(variantFallbackMove.data.id).image_url,
    '/uploads/group-transfer.jpg',
  );
  db.prepare('DELETE FROM stock_transfer_items WHERE transfer_id = ?').run(variantFallbackMove.data.id);
  db.prepare('DELETE FROM stock_transfers WHERE id = ?').run(variantFallbackMove.data.id);
  db.prepare('INSERT INTO product_images (productId, variant_id, url, position) VALUES (?, ?, ?, ?)')
    .run('product_variant', null, '/uploads/variant-base.jpg', 0);
  db.prepare('UPDATE category_groups SET cover_image = NULL WHERE id = ?').run(regularDisplay.group_id);
  assert.deepEqual(regularStock(), { stock: 10, warehouse_stock: 0 });
  assert.deepEqual(variantStock(), { stock: 10, warehouse_stock: 0 });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM stock_transfer_items').get().count, 2);

  const completeMove = await requestJson(`/api/admin/inventory/transfers/${moveToWarehouse.data.id}/complete`, {
    method: 'POST',
  });
  assert.equal(completeMove.response.status, 200);
  assert.equal(completeMove.data.status, 'completed');
  assert.equal(completeMove.data.completed_by, 'inventory-test');
  assert.deepEqual(regularStock(), { stock: 6, warehouse_stock: 4 });
  assert.deepEqual(variantStock(), { stock: 7, warehouse_stock: 3 });

  const completeMoveAgain = await requestJson(`/api/admin/inventory/transfers/${moveToWarehouse.data.id}/complete`, {
    method: 'POST',
  });
  assert.equal(completeMoveAgain.response.status, 409);
  const cancelCompletedMove = await requestJson(`/api/admin/inventory/transfers/${moveToWarehouse.data.id}/cancel`, {
    method: 'POST',
  });
  assert.equal(cancelCompletedMove.response.status, 409);

  db.prepare('DELETE FROM product_images WHERE productId = ?').run('product_regular');
  db.prepare('UPDATE category_groups SET cover_image = ? WHERE id = ?')
    .run('/uploads/group-transfer.jpg', regularDisplay.group_id);
  const cancelledMove = await requestJson('/api/admin/inventory/transfers', {
    method: 'POST',
    body: JSON.stringify({
      source_location: 'retail',
      destination_location: 'warehouse',
      items: [{ product_id: 'product_regular', quantity: 1 }],
    }),
  });
  assert.equal(cancelledMove.response.status, 200);
  assert.equal(cancelledMove.data.items[0].product_image, '/uploads/group-transfer.jpg');
  assert.equal(
    db.prepare('SELECT image_url FROM stock_transfer_items WHERE transfer_id = ?').get(cancelledMove.data.id).image_url,
    '/uploads/group-transfer.jpg',
  );
  db.prepare('INSERT INTO product_images (productId, url, position) VALUES (?, ?, ?)')
    .run('product_regular', '/uploads/regular-transfer.jpg', 0);
  db.prepare('UPDATE category_groups SET cover_image = NULL WHERE id = ?').run(regularDisplay.group_id);
  const cancelMove = await requestJson(`/api/admin/inventory/transfers/${cancelledMove.data.id}/cancel`, {
    method: 'POST',
  });
  assert.equal(cancelMove.response.status, 200);
  assert.equal(cancelMove.data.status, 'cancelled');
  assert.equal(cancelMove.data.cancelled_by, 'inventory-test');
  assert.deepEqual(regularStock(), { stock: 6, warehouse_stock: 4 });

  const transferList = await requestJson('/api/admin/inventory/transfers?page=1&limit=1');
  assert.equal(transferList.response.status, 200);
  assert.equal(transferList.data.pagination.total, 2);
  assert.equal(transferList.data.pagination.totalPages, 2);
  assert.equal(transferList.data.transfers[0].id, cancelledMove.data.id);
  const secondTransferPage = await requestJson('/api/admin/inventory/transfers?page=2&limit=1');
  assert.equal(secondTransferPage.response.status, 200);
  assert.equal(secondTransferPage.data.transfers[0].id, moveToWarehouse.data.id);

  const editVariantProduct = await requestJson('/api/admin/products/product_variant', {
    method: 'PATCH',
    body: JSON.stringify({
      hasVariants: true,
      variants: [
        { id: 'variant_black', name: 'Чёрный обновлённый', priceRub: 110, stock: 7, images: [] },
        { id: 'variant_white', name: 'Белый', priceRub: 100, stock: 10, images: [] },
      ],
    }),
  });
  assert.equal(editVariantProduct.response.status, 200);
  assert.deepEqual(variantStock(), { stock: 7, warehouse_stock: 3 });

  const warehouseProducts = await requestJson('/api/admin/products?location=warehouse&limit=20');
  assert.equal(warehouseProducts.response.status, 200);
  assert.deepEqual(
    new Set(warehouseProducts.data.products.map((product) => product.id)),
    new Set(['product_regular', 'product_variant']),
  );
  assert.deepEqual(
    warehouseProducts.data.availableGroups.map((group) => group.name),
    ['PODONKI PODGON'],
  );
  assert.deepEqual(
    warehouseProducts.data.products.find((product) => product.id === 'product_variant').variants.map((variant) => variant.id),
    ['variant_black'],
  );

  const tooMuch = await requestJson('/api/admin/inventory/transfers', {
    method: 'POST',
    body: JSON.stringify({
      source_location: 'warehouse',
      destination_location: 'retail',
      items: [{ product_id: 'product_regular', quantity: 5 }],
    }),
  });
  assert.equal(tooMuch.response.status, 400);
  assert.deepEqual(regularStock(), { stock: 6, warehouse_stock: 4 });

  const stockChangedDraft = await requestJson('/api/admin/inventory/transfers', {
    method: 'POST',
    body: JSON.stringify({
      source_location: 'warehouse',
      destination_location: 'retail',
      items: [{ product_id: 'product_regular', quantity: 4 }],
    }),
  });
  assert.equal(stockChangedDraft.response.status, 200);
  db.prepare('UPDATE products SET warehouse_stock = 3 WHERE id = ?').run('product_regular');
  const stockChangedComplete = await requestJson(`/api/admin/inventory/transfers/${stockChangedDraft.data.id}/complete`, {
    method: 'POST',
  });
  assert.equal(stockChangedComplete.response.status, 400);
  assert.equal(
    db.prepare('SELECT status FROM stock_transfers WHERE id = ?').get(stockChangedDraft.data.id).status,
    'draft',
  );
  assert.deepEqual(regularStock(), { stock: 6, warehouse_stock: 3 });
  db.prepare('UPDATE products SET warehouse_stock = 4 WHERE id = ?').run('product_regular');
  await requestJson(`/api/admin/inventory/transfers/${stockChangedDraft.data.id}/cancel`, { method: 'POST' });

  const invalidVariantProcurement = await requestJson('/api/admin/crm/procurements', {
    method: 'POST',
    body: JSON.stringify({
      supplier_name: 'Test invalid',
      items: [{ product_id: 'product_variant', quantity: 2, warehouse_quantity: 1, cost_per_unit: 30 }],
    }),
  });
  assert.equal(invalidVariantProcurement.response.status, 400);

  const createProcurement = await requestJson('/api/admin/crm/procurements', {
    method: 'POST',
    body: JSON.stringify({
      supplier_name: 'Test',
      items: [
        { product_id: 'product_regular', quantity: 10, warehouse_quantity: 5, cost_per_unit: 6 },
        { product_id: 'product_variant', variant_id: 'variant_black', quantity: 4, warehouse_quantity: 3, cost_per_unit: 32 },
        { product_id: 'product_variant', variant_id: 'variant_white', quantity: 2, warehouse_quantity: 1, cost_per_unit: 40 },
      ],
    }),
  });
  assert.equal(createProcurement.response.status, 200);

  const procurementId = createProcurement.data.id;
  const editAfterProcurement = await requestJson('/api/admin/products/product_variant', {
    method: 'PATCH',
    body: JSON.stringify({
      hasVariants: true,
      variants: [
        { id: 'variant_black', name: 'Чёрный', priceRub: 100, stock: 7, images: [] },
        { id: 'variant_white', name: 'Белый', priceRub: 100, stock: 10, images: [] },
      ],
    }),
  });
  assert.equal(editAfterProcurement.response.status, 200);
  assert.equal(
    db.prepare("SELECT variant_id FROM procurement_items WHERE procurement_id = ? AND product_id = ? AND variant_id = 'variant_black'").get(
      procurementId,
      'product_variant',
    ).variant_id,
    'variant_black',
  );
  assert.deepEqual(variantStock(), { stock: 7, warehouse_stock: 3 });
  const complete = await requestJson(`/api/admin/crm/procurements/${procurementId}/complete`, {
    method: 'POST',
  });
  assert.equal(complete.response.status, 200);
  assert.deepEqual(regularStock(), { stock: 11, warehouse_stock: 9 });
  assert.deepEqual(variantStock(), { stock: 8, warehouse_stock: 6 });
  assert.deepEqual(
    db.prepare('SELECT stock, warehouse_stock FROM product_variants WHERE id = ?').get('variant_white'),
    { stock: 11, warehouse_stock: 1 },
  );

  const remove = await requestJson(`/api/admin/crm/procurements/${procurementId}`, {
    method: 'DELETE',
  });
  assert.equal(remove.response.status, 200);
  assert.deepEqual(regularStock(), { stock: 6, warehouse_stock: 4 });
  assert.deepEqual(variantStock(), { stock: 7, warehouse_stock: 3 });
  assert.deepEqual(
    db.prepare('SELECT stock, warehouse_stock FROM product_variants WHERE id = ?').get('variant_white'),
    { stock: 10, warehouse_stock: 0 },
  );
  assert.ok(Math.abs(db.prepare('SELECT cost_price FROM products WHERE id = ?').get('product_variant').cost_price - 30) < 0.000001);

  console.log('inventory-locations tests passed');
} finally {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
