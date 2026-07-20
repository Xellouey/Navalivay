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

initDb();

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
  assert.deepEqual(regularStock(), { stock: 6, warehouse_stock: 4 });
  assert.deepEqual(variantStock(), { stock: 7, warehouse_stock: 3 });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM stock_transfer_items').get().count, 2);

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
