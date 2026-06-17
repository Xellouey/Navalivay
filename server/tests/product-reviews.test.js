/**
 * Product reviews core logic tests.
 * Run: node server/tests/product-reviews.test.js
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'navalivay-product-reviews-'));
process.env.DATABASE_FILE = path.join(tempDir, 'test.db');
process.env.NODE_ENV = 'test';

const { initDb, db } = await import('../db.js');
const {
  createProductReview,
  getGroupReviewEligibility,
  getReviewPromptForCustomer,
  validateReviewBodyText,
  resolveReviewCategoryKey,
  getPublicGroupReviews,
  REVIEW_STATUSES,
} = await import('../utils/product-reviews.js');

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

function seedBase() {
  db.exec('DELETE FROM product_reviews;');
  db.exec('DELETE FROM order_items;');
  db.exec('DELETE FROM orders;');
  db.exec('DELETE FROM products;');
  db.exec('DELETE FROM category_groups;');
  db.exec('DELETE FROM categories;');
  db.exec('DELETE FROM customers;');

  db.prepare(
    `INSERT INTO customers (id, telegram_id, telegram_username, first_name, reviews_opt_out, created_at, updated_at)
     VALUES ('cust1', '111', 'buyer1', 'Buyer', 0, DATETIME('now'), DATETIME('now'))`,
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

console.log('\n=== product-reviews core ===\n');

console.log('--- resolveReviewCategoryKey ---');
{
  ok(
    resolveReviewCategoryKey({ slug: 'salt-liquids', storefrontFiltersProfile: 'liquids' }) === 'liquids',
    'liquids category',
  );
  ok(
    resolveReviewCategoryKey({ slug: 'accessories' }) === 'consumables',
    'consumables from accessories slug',
  );
}

console.log('\n--- validateReviewBodyText ---');
{
  let threw = false;
  try {
    validateReviewBodyText('коротко');
  } catch (error) {
    threw = error.code === 'review_body_too_short';
  }
  ok(threw, 'rejects short body');

  ok(
    validateReviewBodyText('Мне очень понравился вкус, беру ещё раз') ===
      'Мне очень понравился вкус, беру ещё раз',
    'accepts long enough body',
  );
}

console.log('\n--- eligibility ---');
{
  seedBase();
  const eligible = getGroupReviewEligibility({
    customerId: 'cust1',
    groupId: 'grp1',
    orderId: 'ord1',
    orderItemId: 'oi1',
  });
  ok(eligible.canReview === true, 'eligible after delivered purchase');
  ok(eligible.purchasedVariantName === 'Ананасовая шипучка', 'captures purchased variant');
}

console.log('\n--- create + cooldown ---');
{
  seedBase();
  const review = createProductReview({
    customerId: 'cust1',
    orderId: 'ord1',
    groupId: 'grp1',
    orderItemId: 'oi1',
    rating: 5,
    bodyText: 'Отличная линейка, вкус сочный и насыщенный',
    quickTagIds: [],
    isAnonymous: false,
  });
  ok(review?.id, 'review created');
  ok(review.status === REVIEW_STATUSES.PENDING, 'pending moderation');

  const blocked = getGroupReviewEligibility({
    customerId: 'cust1',
    groupId: 'grp1',
    orderId: 'ord1',
  });
  ok(blocked.canReview === false, 'blocked while pending');
  ok(blocked.reason === 'pending_moderation', 'pending reason');
}

console.log('\n--- review prompt ---');
{
  seedBase();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get('cust1');

  createProductReview({
    customerId: 'cust1',
    orderId: 'ord1',
    groupId: 'grp1',
    orderItemId: 'oi1',
    rating: 5,
    bodyText: 'Отличная линейка, вкус сочный и насыщенный',
    quickTagIds: [],
    isAnonymous: false,
  });

  const hiddenWhilePending = getReviewPromptForCustomer(customer);
  ok(hiddenWhilePending.show === false, 'no prompt while pending moderation blocks line');

  db.prepare(`UPDATE product_reviews SET status = 'rejected' WHERE customer_id = ?`).run('cust1');
  const promptAfterReject = getReviewPromptForCustomer(customer);
  ok(promptAfterReject.show === true, 'prompt returns when line becomes reviewable again');

  db.prepare(`UPDATE customers SET reviews_opt_out = 1 WHERE id = ?`).run('cust1');
  const optedOut = getReviewPromptForCustomer(
    db.prepare('SELECT * FROM customers WHERE id = ?').get('cust1'),
  );
  ok(optedOut.show === false && optedOut.reason === 'opt_out', 'opt-out hides prompt');
}

console.log('\n--- public reviews ---');
{
  seedBase();
  createProductReview({
    customerId: 'cust1',
    orderId: 'ord1',
    groupId: 'grp1',
    orderItemId: 'oi1',
    rating: 4,
    bodyText: 'Нормальная линейка, в целом доволен покупкой',
    quickTagIds: [],
    isAnonymous: true,
  });
  const reviewId = db.prepare('SELECT id FROM product_reviews LIMIT 1').get().id;
  db.prepare(`UPDATE product_reviews SET status = 'approved', approved_at = DATETIME('now') WHERE id = ?`).run(reviewId);

  const publicReviews = getPublicGroupReviews('grp1');
  ok(publicReviews.review_count === 1, 'one public review');
  ok(publicReviews.items[0].reviewer.is_anonymous === true, 'anonymous mask');
  ok(publicReviews.items[0].purchased_variant_name === 'Ананасовая шипучка', 'variant in public review');
}

console.log(`\nDone: ${results.passed} passed, ${results.failed} failed\n`);
process.exit(results.failed > 0 ? 1 : 0);