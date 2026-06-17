/**
 * Monthly review draw — adversarial tests (fraud / edge cases).
 * Run: node server/tests/review-monthly-draw-adversarial.test.js
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'navalivay-review-draw-adv-'));
process.env.DATABASE_FILE = path.join(tempDir, 'test.db');
process.env.NODE_ENV = 'test';

const { initDb, db } = await import('../db.js');
const {
  listEligibleDrawEntries,
  pickWeightedWinners,
  runMonthlyReviewDraw,
  rerollDrawSeat,
  getReviewPeriodKey,
} = await import('../utils/review-monthly-draw.js');

initDb();

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

function expectThrows(fn, code, msg) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  ok(thrown?.code === code, `${msg} — got ${thrown?.code || 'none'}`);
}

function seedReviews({ reviewCountByCustomer = { cust1: 1 }, optOutCustomers = [] } = {}) {
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
    `INSERT INTO categories (id, slug, name, [order], hide_empty)
     VALUES ('cat1', 'cat1', 'Cat', 1, 0)`,
  ).run();
  db.prepare(
    `INSERT INTO category_groups (id, categoryId, slug, name, [order], hide_empty, createdAt, updatedAt)
     VALUES ('grp1', 'cat1', 'grp1', 'G', 1, 0, DATETIME('now'), DATETIME('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO products (id, categoryId, groupId, title, priceRub, description, stock, createdAt)
     VALUES ('prod1', 'cat1', 'grp1', 'Item', 10, '', 5, DATETIME('now'))`,
  ).run();

  let orderNum = 1000;
  let customerIdx = 0;
  for (const [customerId, count] of Object.entries(reviewCountByCustomer)) {
    customerIdx += 1;
    const optOut = optOutCustomers.includes(customerId) ? 1 : 0;
    const telegramId = String(9_000_000 + customerIdx);
    db.prepare(
      `INSERT INTO customers (id, telegram_id, telegram_username, first_name, reviews_opt_out, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, DATETIME('now'), DATETIME('now'))`,
    ).run(customerId, telegramId, customerId, customerId, optOut);

    for (let i = 0; i < count; i += 1) {
      orderNum += 1;
      const orderId = `ord_${customerId}_${i}`;
      db.prepare(
        `INSERT INTO orders (id, order_number, customer_id, status, total_amount, final_amount, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, 'delivered', 10, 10, DATETIME('now'), DATETIME('now'), DATETIME('now'))`,
      ).run(orderId, orderNum, customerId);
      db.prepare(
        `INSERT INTO product_reviews (
          id, customer_id, order_id, group_id, rating, body_text, quick_tag_ids,
          status, created_at, updated_at, approved_at
        ) VALUES (?, ?, ?, 'grp1', 5, 'Длинный одобренный отзыв для розыгрыша', '[]', 'approved', DATETIME('now'), DATETIME('now'), DATETIME('now'))`,
      ).run(`rev_${customerId}_${i}`, customerId, orderId);
    }
  }
}

console.log('\n=== review-monthly-draw adversarial ===\n');

console.log('--- A1: opt-out customer excluded from pool ---');
{
  seedReviews({
    reviewCountByCustomer: { cust1: 3, cust2: 1 },
    optOutCustomers: ['cust1'],
  });
  const tickets = listEligibleDrawEntries(getReviewPeriodKey(0));
  ok(tickets.every((t) => t.customer_id !== 'cust1'), 'opt-out excluded');
  ok(tickets.length === 1, 'only cust2 ticket');
}

console.log('--- A2: one customer cannot win two seats ---');
{
  seedReviews({ reviewCountByCustomer: { whale: 10, small: 1 } });
  const tickets = listEligibleDrawEntries(getReviewPeriodKey(0));
  const winners = pickWeightedWinners(tickets, 5, () => 0);
  const unique = new Set(winners.map((w) => w.customer_id));
  ok(winners.length === unique.size, 'unique winners');
  ok(winners.length === 2, 'both customers max once each');
}

console.log('--- A3: duplicate draw blocked ---');
{
  seedReviews({ reviewCountByCustomer: { cust1: 1 } });
  const periodKey = getReviewPeriodKey(0);
  runMonthlyReviewDraw({ periodKey, seatCount: 1, rng: () => 0 });
  expectThrows(
    () => runMonthlyReviewDraw({ periodKey, seatCount: 1, rng: () => 0 }),
    'draw_already_exists',
    'duplicate draw rejected',
  );
}

console.log('--- A4: reroll invalid seat ---');
{
  seedReviews({ reviewCountByCustomer: { cust1: 1, cust2: 1 } });
  const draw = runMonthlyReviewDraw({ periodKey: `adv-${Date.now()}`, seatCount: 1, rng: () => 0 });
  expectThrows(
    () => rerollDrawSeat(draw.id, 99, { rng: () => 0 }),
    'seat_not_found',
    'invalid seat rejected',
  );
}

console.log('--- A5: empty pool draw yields zero winners ---');
{
  seedReviews({ reviewCountByCustomer: {} });
  const draw = runMonthlyReviewDraw({ periodKey: `empty-${Date.now()}`, seatCount: 5, rng: () => 0 });
  ok(draw.winners.length === 0, 'no winners when pool empty');
}

console.log('--- R1: more reviews increases ticket weight not seat count ---');
{
  seedReviews({ reviewCountByCustomer: { cust1: 5, cust2: 1 } });
  const tickets = listEligibleDrawEntries(getReviewPeriodKey(0));
  ok(tickets.filter((t) => t.customer_id === 'cust1').length === 5, 'cust1 has 5 tickets');
  const draw = runMonthlyReviewDraw({ periodKey: `weight-${Date.now()}`, seatCount: 2, rng: () => 0 });
  const cust1Wins = draw.winners.filter((w) => w.customer_id === 'cust1').length;
  ok(cust1Wins <= 1, 'cust1 wins at most one seat');
}

console.log(`\nDone: ${results.passed} passed, ${results.failed} failed\n`);
process.exit(results.failed > 0 ? 1 : 0);