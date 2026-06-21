/**
 * Выключает QA/dev-режим отзывов и удаляет тестовые данные сценариев.
 *
 * Usage:
 *   node server/scripts/disable-review-qa-and-cleanup.js --dry-run
 *   node server/scripts/disable-review-qa-and-cleanup.js
 */
import { initDb, db } from '../db.js';
import {
  disableReviewQaModes,
  getQaUsernames,
  setQaUsernames,
} from '../utils/product-reviews.js';

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const dryRun = hasFlag('dry-run');

const DEV_ORDER_PREFIXES = ['order_dev_%'];
const DEV_DRAW_PREFIXES = ['draw_dev_scn_%', 'draw_dev_%'];
const TEST_TELEGRAM_IDS = ['900000001', '900000002', '900000003', '900000004'];
const TEST_USERNAMES = [
  'review_demo',
  'review_pending',
  'review_cooldown',
  'review_optout',
];

initDb();

function count(sql, params = []) {
  return Number(db.prepare(sql).get(...params)?.n || 0);
}

function listDevOrderIds() {
  return db
    .prepare(
      `SELECT id FROM orders WHERE id LIKE 'order_dev_%' OR id LIKE 'ord_dev_%' OR id LIKE 'ord_konst_%' OR id LIKE 'ord_pending_%' OR id LIKE 'ord_repeat%' OR id LIKE 'ord_last_hap%'`,
    )
    .all()
    .map((row) => row.id);
}

function listTestCustomerIds() {
  const placeholders = TEST_TELEGRAM_IDS.map(() => '?').join(', ');
  const usernamePlaceholders = TEST_USERNAMES.map(() => '?').join(', ');
  return db
    .prepare(
      `SELECT id FROM customers
       WHERE telegram_id IN (${placeholders})
          OR LOWER(telegram_username) IN (${usernamePlaceholders})`,
    )
    .all(...TEST_TELEGRAM_IDS, ...TEST_USERNAMES)
    .map((row) => row.id);
}

const before = {
  qa_active: db.prepare(`SELECT value FROM review_settings WHERE key = 'qa_active'`).get()?.value,
  dev_test_mode: db
    .prepare(`SELECT value FROM review_settings WHERE key = 'dev_test_mode'`)
    .get()?.value,
  qa_usernames: db
    .prepare(`SELECT value FROM review_settings WHERE key = 'qa_usernames'`)
    .get()?.value,
  product_reviews: count('SELECT COUNT(*) AS n FROM product_reviews'),
  review_draws: count('SELECT COUNT(*) AS n FROM review_monthly_draws'),
  dev_orders: count(`SELECT COUNT(*) AS n FROM orders WHERE id LIKE 'order_dev_%'`),
};

const devOrderIds = listDevOrderIds();
const testCustomerIds = listTestCustomerIds();

console.log('[disable-review-qa-and-cleanup] before:', JSON.stringify(before, null, 2));
console.log('devOrderIds:', devOrderIds.length, devOrderIds.slice(0, 10));
console.log('testCustomerIds:', testCustomerIds.length, testCustomerIds);

if (dryRun) {
  console.log('\n[dry-run] Изменения не применены.');
  process.exit(0);
}

const qaUsernames = getQaUsernames();

const result = db.transaction(() => {
  let reviewsDeleted = 0;
  let winnersDeleted = 0;
  let drawsDeleted = 0;
  let ordersDeleted = 0;

  if (qaUsernames.length) {
    const usernamePlaceholders = qaUsernames.map(() => '?').join(', ');
    reviewsDeleted += db
      .prepare(
        `DELETE FROM product_reviews
         WHERE customer_id IN (
           SELECT id FROM customers WHERE LOWER(telegram_username) IN (${usernamePlaceholders})
         )`,
      )
      .run(...qaUsernames).changes;
  }

  if (devOrderIds.length) {
    const orderPlaceholders = devOrderIds.map(() => '?').join(', ');
    reviewsDeleted += db
      .prepare(`DELETE FROM product_reviews WHERE order_id IN (${orderPlaceholders})`)
      .run(...devOrderIds).changes;
    db.prepare(`DELETE FROM order_items WHERE order_id IN (${orderPlaceholders})`)
      .run(...devOrderIds);
    db.prepare(`DELETE FROM order_status_history WHERE order_id IN (${orderPlaceholders})`)
      .run(...devOrderIds);
    ordersDeleted += db
      .prepare(`DELETE FROM orders WHERE id IN (${orderPlaceholders})`)
      .run(...devOrderIds).changes;
  }

  if (testCustomerIds.length) {
    const customerPlaceholders = testCustomerIds.map(() => '?').join(', ');
    reviewsDeleted += db
      .prepare(`DELETE FROM product_reviews WHERE customer_id IN (${customerPlaceholders})`)
      .run(...testCustomerIds).changes;
  }

  for (const prefix of DEV_DRAW_PREFIXES) {
    const drawIds = db
      .prepare(`SELECT id FROM review_monthly_draws WHERE id LIKE ?`)
      .all(prefix)
      .map((row) => row.id);
    if (!drawIds.length) continue;
    const drawPlaceholders = drawIds.map(() => '?').join(', ');
    winnersDeleted += db
      .prepare(`DELETE FROM review_monthly_draw_winners WHERE draw_id IN (${drawPlaceholders})`)
      .run(...drawIds).changes;
    drawsDeleted += db
      .prepare(`DELETE FROM review_monthly_draws WHERE id IN (${drawPlaceholders})`)
      .run(...drawIds).changes;
  }

  disableReviewQaModes();
  setQaUsernames([]);

  return {
    reviewsDeleted,
    winnersDeleted,
    drawsDeleted,
    ordersDeleted,
    qaUsernamesCleared: qaUsernames,
  };
})();

const after = {
  qa_active: db.prepare(`SELECT value FROM review_settings WHERE key = 'qa_active'`).get()?.value,
  dev_test_mode: db
    .prepare(`SELECT value FROM review_settings WHERE key = 'dev_test_mode'`)
    .get()?.value,
  qa_usernames: db
    .prepare(`SELECT value FROM review_settings WHERE key = 'qa_usernames'`)
    .get()?.value,
  product_reviews: count('SELECT COUNT(*) AS n FROM product_reviews'),
  review_draws: count('SELECT COUNT(*) AS n FROM review_monthly_draws'),
  dev_orders: count(`SELECT COUNT(*) AS n FROM orders WHERE id LIKE 'order_dev_%'`),
};

console.log('');
console.log('[disable-review-qa-and-cleanup] deleted:', result);
console.log('[disable-review-qa-and-cleanup] after:', JSON.stringify(after, null, 2));