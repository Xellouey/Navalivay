/**
 * Product reviews — additional HTTP regression coverage for error paths.
 * Run: node server/tests/product-reviews-routes-regression.test.js
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'navalivay-product-reviews-routes-reg-'));
process.env.DATABASE_FILE = path.join(tempDir, 'test.db');
process.env.BOT_TOKEN = 'test-bot-token';
process.env.NODE_ENV = 'test';

const { initDb, db } = await import('../db.js');
const { publicRouter } = await import('../routes/public.js');
const { MAX_REVIEW_BODY_LENGTH } = await import('../utils/product-reviews.js');

initDb();

const app = express();
app.use(express.json());
app.use(publicRouter);

const server = await new Promise((resolve) => {
  const instance = app.listen(0, () => resolve(instance));
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;

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

function authHeaders(id = '111', username = 'buyer1') {
  return {
    'Content-Type': 'application/json',
    'x-test-telegram-auth': JSON.stringify({ id, username, first_name: 'Buyer' }),
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, options);
  const data = await response.json().catch(() => null);
  return { response, data };
}

function seedDeliveredOrder() {
  db.exec('DELETE FROM product_reviews;');
  db.exec('DELETE FROM order_items;');
  db.exec('DELETE FROM orders;');
  db.exec('DELETE FROM products;');
  db.exec('DELETE FROM category_groups;');
  db.exec('DELETE FROM categories;');
  db.exec('DELETE FROM customers;');

  db.prepare(
    `INSERT INTO customers (id, telegram_id, telegram_username, first_name, reviews_prefer_anonymous, created_at, updated_at)
     VALUES ('cust1', '111', 'buyer1', 'Buyer', 1, DATETIME('now'), DATETIME('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO categories (id, slug, name, [order], hide_empty, storefront_filters_profile)
     VALUES ('cat_liq', 'salt-liquids', 'Жидкости', 1, 0, 'liquids')`,
  ).run();
  db.prepare(
    `INSERT INTO category_groups (id, categoryId, slug, name, [order], hide_empty, createdAt, updatedAt)
     VALUES ('grp1', 'cat_liq', 'grp1', 'Подонки', 1, 0, DATETIME('now'), DATETIME('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO products (id, categoryId, groupId, title, priceRub, description, stock, createdAt)
     VALUES ('prod1', 'cat_liq', 'grp1', 'Ананас', 10, '', 5, DATETIME('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status, total_amount, final_amount, completed_at, created_at, updated_at)
     VALUES ('ord1', 1001, 'cust1', 'delivered', 10, 10, DATETIME('now'), DATETIME('now'), DATETIME('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO order_items (id, order_id, product_id, product_title, variant_name, quantity, price_per_unit, total_price, total_cost)
     VALUES ('oi1', 'ord1', 'prod1', 'Ананас', 'Ананасовая шипучка', 1, 10, 10, 4)`,
  ).run();
}

console.log('\n=== product-reviews routes regression ===\n');

console.log('--- REG1: history card shape without review meta ---');
{
  seedDeliveredOrder();
  const { data } = await requestJson('/api/orders/my-history', { headers: authHeaders() });
  const card = data.items?.[0];
  ok(card && !('pending_review_count' in card), 'no pending_review_count');
  ok(card && !('has_reviews' in card), 'no has_reviews');
}

console.log('\n--- REG2: quick-tags happy path ---');
{
  db.exec('DELETE FROM review_quick_tags;');
  db.prepare(
    `INSERT INTO review_quick_tags (id, category_key, star_rating, label, insert_text, sort_order, is_active, created_at, updated_at)
     VALUES ('tag1', 'liquids', 5, 'Вкусно', 'Вкусно.', 1, 1, DATETIME('now'), DATETIME('now'))`,
  ).run();
  const { response, data } = await requestJson(
    '/api/reviews/quick-tags?category_key=liquids&star_rating=5',
    { headers: authHeaders() },
  );
  ok(response.status === 200, 'quick-tags 200');
  ok(data?.items?.length === 1 && data.items[0].label === 'Вкусно', 'quick-tags item');
}

console.log('\n--- REG3: quick-tags without auth → 401 ---');
{
  const { response } = await requestJson('/api/reviews/quick-tags?category_key=liquids&star_rating=5');
  ok(response.status === 401, 'quick-tags 401');
}

console.log('\n--- REG4: preferences anonymous-only PATCH ---');
{
  seedDeliveredOrder();
  const { response, data } = await requestJson('/api/profile/review-preferences', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ reviews_prefer_anonymous: false }),
  });
  ok(response.status === 200, 'anonymous-only patch 200');
  ok(data?.reviews_prefer_anonymous === false, 'anonymous cleared');
}

console.log('\n--- REG5: preferences without auth → 401 ---');
{
  const { response } = await requestJson('/api/profile/review-preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviews_opt_out: true }),
  });
  ok(response.status === 401, 'preferences 401');
}

console.log('\n--- REG6: prompt includes preferences ---');
{
  seedDeliveredOrder();
  const { data } = await requestJson('/api/reviews/prompt', { headers: authHeaders() });
  ok(data?.preferences?.reviews_prefer_anonymous === true, 'prefer_anonymous from DB');
}

console.log('\n--- REG7: POST review uses prefer_anonymous default ---');
{
  seedDeliveredOrder();
  const { response, data } = await requestJson('/api/reviews', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      order_id: 'ord1',
      group_id: 'grp1',
      order_item_id: 'oi1',
      rating: 5,
      body_text: 'Отзыв без явного флага анонимности',
      quick_tag_ids: [],
    }),
  });
  ok(response.status === 201, 'create 201');
  ok(data?.review?.is_anonymous === 1, 'anonymous default from customer');
}

console.log('\n--- REG8: body too long → 400 ---');
{
  seedDeliveredOrder();
  const { response, data } = await requestJson('/api/reviews', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      order_id: 'ord1',
      group_id: 'grp1',
      order_item_id: 'oi1',
      rating: 5,
      body_text: 'а'.repeat(MAX_REVIEW_BODY_LENGTH + 1),
      quick_tag_ids: [],
    }),
  });
  ok(response.status === 400 && data?.error === 'review_body_too_long', 'body too long 400');
}

console.log('\n--- REG9: invalid rating at HTTP → 400 ---');
{
  seedDeliveredOrder();
  const { response, data } = await requestJson('/api/reviews', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      order_id: 'ord1',
      group_id: 'grp1',
      rating: 0,
      body_text: 'Достаточно длинный текст отзыва',
      quick_tag_ids: [],
    }),
  });
  ok(response.status === 400 && data?.error === 'invalid_rating', 'invalid rating 400');
}

console.log('\n--- REG10: group reviews pagination clamp ---');
{
  const page = await requestJson('/api/groups/grp1/reviews?limit=999&offset=0');
  ok(page.response.status === 200, 'group reviews 200');
  ok(Array.isArray(page.data?.items), 'items array');
}

console.log('\n--- REG11: history empty for unknown customer ---');
{
  db.exec('DELETE FROM customers;');
  const { data } = await requestJson('/api/orders/my-history', { headers: authHeaders('999', 'ghost') });
  ok(Array.isArray(data?.items) && data.items.length === 0, 'empty history without customer');
}

server.close();
console.log(`\nDone: ${results.passed} passed, ${results.failed} failed\n`);
process.exit(results.failed > 0 ? 1 : 0);