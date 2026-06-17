/**
 * Review CRM — HTTP adversarial + regression route tests.
 * Run: node server/tests/review-crm-routes.test.js
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'navalivay-review-crm-routes-'));
process.env.DATABASE_FILE = path.join(tempDir, 'test.db');
process.env.BOT_TOKEN = '';
process.env.NODE_ENV = 'test';

const { initDb, db } = await import('../db.js');
const { issueToken } = await import('../auth.js');
const { crmRouter } = await import('../routes/crm.js');

initDb();

const app = express();
app.use(express.json());
app.use(crmRouter);

const server = await new Promise((resolve) => {
  const instance = app.listen(0, () => resolve(instance));
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const authToken = issueToken('crm-admin');

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

function seedPendingReview() {
  db.exec('DELETE FROM review_monthly_draw_winners;');
  db.exec('DELETE FROM review_monthly_draws;');
  db.exec('DELETE FROM product_reviews;');
  db.exec('DELETE FROM order_items;');
  db.exec('DELETE FROM orders;');
  db.exec('DELETE FROM products;');
  db.exec('DELETE FROM category_groups;');
  db.exec('DELETE FROM categories;');
  db.exec('DELETE FROM customers;');

  db.prepare(
    `INSERT INTO customers (id, telegram_id, telegram_username, first_name, created_at, updated_at)
     VALUES ('cust1', '111', 'buyer1', 'Buyer', DATETIME('now'), DATETIME('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO categories (id, slug, name, [order], hide_empty)
     VALUES ('cat1', 'cat1', 'Cat', 1, 0)`,
  ).run();
  db.prepare(
    `INSERT INTO category_groups (id, categoryId, slug, name, [order], hide_empty, createdAt, updatedAt)
     VALUES ('grp1', 'cat1', 'grp1', 'Подонки', 1, 0, DATETIME('now'), DATETIME('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO products (id, categoryId, groupId, title, priceRub, description, stock, createdAt)
     VALUES ('prod1', 'cat1', 'grp1', 'Item', 10, '', 5, DATETIME('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status, total_amount, final_amount, created_at, updated_at)
     VALUES ('ord1', 1001, 'cust1', 'delivered', 10, 10, DATETIME('now'), DATETIME('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO product_reviews (
      id, customer_id, order_id, group_id, rating, body_text, quick_tag_ids, status, created_at, updated_at
    ) VALUES ('rev1', 'cust1', 'ord1', 'grp1', 5, 'Отзыв на модерации для CRM тестов', '[]', 'pending', DATETIME('now'), DATETIME('now'))`,
  ).run();
}

console.log('\n=== review CRM routes ===\n');

console.log('--- A-API1: list reviews without auth → 401 ---');
{
  const { response } = await requestJson('/api/admin/crm/product-reviews');
  ok(response.status === 401, '401 without auth');
}

console.log('\n--- A-API2: approve unknown review → 404 ---');
{
  seedPendingReview();
  const { response } = await requestJson('/api/admin/crm/product-reviews/missing/approve', {
    method: 'POST',
    headers: authHeaders(),
  });
  ok(response.status === 404, 'approve missing 404');
}

console.log('\n--- A-API3: reject without reply text on reply endpoint → 400 ---');
{
  const { response } = await requestJson('/api/admin/crm/product-reviews/rev1/reply', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ reply: '   ' }),
  });
  ok(response.status === 400, 'empty reply 400');
}

console.log('\n--- A-API4: invalid cooldown days → 400 ---');
{
  const { response } = await requestJson('/api/admin/crm/review-settings', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ cooldown_days: 0 }),
  });
  ok(response.status === 400, 'invalid cooldown 400');
}

console.log('\n--- A-API5: create quick tag invalid star → 400 ---');
{
  const { response } = await requestJson('/api/admin/crm/review-quick-tags', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      category_key: 'liquids',
      star_rating: 9,
      label: 'Bad',
      insert_text: 'Bad tag text here',
    }),
  });
  ok(response.status === 400, 'invalid star rating 400');
}

console.log('\n--- R-API1: pending count matches list ---');
{
  seedPendingReview();
  const list = await requestJson('/api/admin/crm/product-reviews?status=pending', {
    headers: authHeaders(),
  });
  const count = await requestJson('/api/admin/crm/product-reviews/pending-count', {
    headers: authHeaders(),
  });
  ok(list.data.items.length === 1, 'one pending in list');
  ok(count.data.count === 1, 'pending count 1');
}

console.log('\n--- R-API2: approve → removed from pending ---');
{
  const approve = await requestJson('/api/admin/crm/product-reviews/rev1/approve', {
    method: 'POST',
    headers: authHeaders(),
  });
  ok(approve.response.status === 200, 'approve 200');
  ok(approve.data.review?.status === 'approved', 'status approved');

  const count = await requestJson('/api/admin/crm/product-reviews/pending-count', {
    headers: authHeaders(),
  });
  ok(count.data.count === 0, 'no pending after approve');
}

console.log('\n--- R-API3: manager reply persisted ---');
{
  const reply = await requestJson('/api/admin/crm/product-reviews/rev1/reply', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ reply: 'Спасибо за отзыв!' }),
  });
  ok(reply.response.status === 200, 'reply 200');
  ok(reply.data.review?.manager_reply === 'Спасибо за отзыв!', 'reply text saved');
  ok(reply.data.manager_display_name, 'manager display name returned');
}

console.log('\n--- R-API4: settings round-trip ---');
{
  const patch = await requestJson('/api/admin/crm/review-settings', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({
      cooldown_days: 40,
      dev_test_mode: true,
      lottery_hint_text: 'Тест подарков',
    }),
  });
  ok(patch.response.status === 200, 'settings patch 200');
  ok(patch.data.cooldown_days === 40, 'cooldown persisted');
  ok(patch.data.dev_test_mode === true, 'dev mode persisted');

  const get = await requestJson('/api/admin/crm/review-settings', { headers: authHeaders() });
  ok(get.data.cooldown_days === 40, 'settings get matches');
}

console.log('\n--- A-API6: reject pending review ---');
{
  seedPendingReview();
  const reject = await requestJson('/api/admin/crm/product-reviews/rev1/reject', {
    method: 'POST',
    headers: authHeaders(),
  });
  ok(reject.response.status === 200, 'reject 200');
  ok(reject.data.review?.status === 'rejected', 'status rejected');

  const count = await requestJson('/api/admin/crm/product-reviews/pending-count', {
    headers: authHeaders(),
  });
  ok(count.data.count === 0, 'no pending after reject');
}

console.log('\n--- A-API7: cannot approve already rejected review ---');
{
  const again = await requestJson('/api/admin/crm/product-reviews/rev1/approve', {
    method: 'POST',
    headers: authHeaders(),
  });
  ok(again.response.status === 404, 'approve rejected review 404');
}

console.log('\n--- A-API8: invalid token → 401 ---');
{
  const { response } = await requestJson('/api/admin/crm/product-reviews', {
    headers: { Authorization: 'Bearer invalid.token.here' },
  });
  ok(response.status === 401, 'invalid token 401');
}

console.log('\n--- R-API5: monthly draw run + duplicate blocked ---');
{
  seedPendingReview();
  db.prepare(`UPDATE product_reviews SET status = 'approved', approved_at = DATETIME('now') WHERE id = 'rev1'`).run();

  const draw = await requestJson('/api/admin/crm/review-monthly-draws/run', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  ok(draw.response.status === 200, 'draw run 200');
  ok(draw.data.draw?.winners?.length >= 1, 'at least one winner');

  const dup = await requestJson('/api/admin/crm/review-monthly-draws/run', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  ok(dup.response.status === 409, 'duplicate draw 409');
}

server.close();
console.log(`\nDone: ${results.passed} passed, ${results.failed} failed\n`);
process.exit(results.failed > 0 ? 1 : 0);