/**
 * Category group completeness — HTTP API tests.
 * Запуск: node server/tests/category-group-completeness-routes.test.js
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'navalivay-completeness-routes-'));
const tempDbPath = path.join(tempDir, 'test.db');

process.env.DATABASE_FILE = tempDbPath;
process.env.BOT_TOKEN = '';

const { initDb, db } = await import('../db.js');
const { issueToken } = await import('../auth.js');
const { adminRouter } = await import('../routes/admin.js');
const { getActiveWholesaleTiers } = await import('../wholesale-service.js');

initDb();

const app = express();
app.use(express.json());
app.use(adminRouter);

const server = await new Promise((resolve) => {
  const instance = app.listen(0, () => resolve(instance));
});

const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;
const authToken = issueToken('admin-test');

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, options);
  const data = await response.json().catch(() => null);
  return { response, data };
}

const results = { passed: 0, failed: 0 };
function ok(cond, msg) {
  if (cond) {
    results.passed++;
    console.log(`  OK: ${msg}`);
  } else {
    results.failed++;
    console.log(`  FAIL: ${msg}`);
  }
}

function resetDb() {
  db.exec('DELETE FROM category_group_wholesale_prices;');
  db.exec('DELETE FROM products;');
  db.exec('DELETE FROM category_groups;');
  db.exec('DELETE FROM categories;');
}

function seedCategory() {
  db.prepare(`INSERT INTO categories (id, slug, name, [order]) VALUES ('c1', 'cat', 'Liquids', 1)`).run();
}

function seedIncompleteGroup() {
  db.prepare(
    `INSERT INTO category_groups
      (id, categoryId, slug, name, [order], hide_empty, createdAt, updatedAt)
     VALUES ('g1', 'c1', 'g1', 'PODGON', 1, 1, DATETIME('now'), DATETIME('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO products (id, categoryId, groupId, title, priceRub, stock, min_stock, createdAt)
     VALUES ('p1', 'c1', 'g1', 'T1', 10, 5, 0, DATETIME('now'))`,
  ).run();
}

function fullWholesale(groupId) {
  const tiers = getActiveWholesaleTiers();
  const stmt = db.prepare(
    `INSERT INTO category_group_wholesale_prices (group_id, tier_id, price_byn, created_at, updated_at)
     VALUES (?, ?, 12, DATETIME('now'), DATETIME('now'))`,
  );
  tiers.forEach((tier) => stmt.run(groupId, tier.id));
}

resetDb();
seedCategory();
seedIncompleteGroup();

console.log('\n=== A-API1: GET incomplete without auth → 401 ===');
{
  const { response } = await requestJson('/api/admin/category-groups/incomplete');
  ok(response.status === 401, 'status 401');
}

console.log('\n=== A-API2: GET incomplete with auth → shape ===');
{
  const { response, data } = await requestJson('/api/admin/category-groups/incomplete', {
    headers: authHeaders(),
  });
  ok(response.status === 200, 'status 200');
  ok(Array.isArray(data?.items), 'items array');
  ok(data?.items.length === 1, 'one incomplete group');
  ok(data?.items[0]?.id === 'g1', 'group id');
  ok(Array.isArray(data?.items[0]?.missingFields), 'missingFields array');
  ok(data?.fieldLabels?.description === 'Описание', 'field labels');
}

console.log('\n=== A-API3: GET summary matches list count ===');
{
  const list = await requestJson('/api/admin/category-groups/incomplete', { headers: authHeaders() });
  const summary = await requestJson('/api/admin/category-groups/incomplete/summary', {
    headers: authHeaders(),
  });
  ok(summary.response.status === 200, 'summary 200');
  ok(summary.data?.count === list.data?.items?.length, 'count matches');
  ok(summary.data?.hasAny === true, 'hasAny true');
}

console.log('\n=== A-API4: PATCH waivers → removes from list ===');
{
  const { response, data } = await requestJson('/api/admin/category-groups/g1/completeness-waivers', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({
      waive_description: true,
      waive_min_stock: true,
      waive_wholesale: true,
    }),
  });
  ok(response.status === 200, 'patch 200');
  ok(data?.ok === true, 'ok true');
  const after = await requestJson('/api/admin/category-groups/incomplete', { headers: authHeaders() });
  ok(after.data?.items?.length === 0, 'list empty after waivers');
}

console.log('\n=== A-API5: PATCH invalid waiver → 400 ===');
{
  const { response, data } = await requestJson('/api/admin/category-groups/g1/completeness-waivers', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ waive_description: 'maybe' }),
  });
  ok(response.status === 400, 'status 400');
  ok(data?.error === 'invalid_waiver_value', 'error code');
}

console.log('\n=== A-API6: PATCH unknown group → 404 ===');
{
  const { response, data } = await requestJson('/api/admin/category-groups/g_404/completeness-waivers', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ waive_description: true }),
  });
  ok(response.status === 404, 'status 404');
  ok(data?.error === 'group_not_found', 'not found');
}

console.log('\n=== R-API1: PUT group fills data → disappears from incomplete ===');
{
  resetDb();
  seedCategory();
  seedIncompleteGroup();
  const { response } = await requestJson('/api/admin/category-groups/g1', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      metaValue: '60 mg',
      minStockThreshold: 20,
      wholesalePrices: Object.fromEntries(
        getActiveWholesaleTiers().map((tier) => [tier.code, 15]),
      ),
    }),
  });
  ok(response.status === 200, 'put 200');
  const after = await requestJson('/api/admin/category-groups/incomplete', { headers: authHeaders() });
  ok(after.data?.items?.length === 0, 'complete after put');
}

console.log('\n=== R-API2: PUT with waive fields persists ===');
{
  resetDb();
  seedCategory();
  seedIncompleteGroup();
  await requestJson('/api/admin/category-groups/g1', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      waiveDescription: true,
      waiveMinStock: false,
      waiveWholesale: true,
    }),
  });
  const row = db.prepare('SELECT waive_description, waive_wholesale FROM category_groups WHERE id = ?').get('g1');
  ok(Number(row.waive_description) === 1, 'waive_description saved');
  ok(Number(row.waive_wholesale) === 1, 'waive_wholesale saved');
}

console.log(`\n=== Results: ${results.passed} passed, ${results.failed} failed ===`);

server.close();
try {
  fs.rmSync(tempDir, { recursive: true, force: true });
} catch {
  // ignore
}

if (results.failed > 0) {
  process.exit(1);
}