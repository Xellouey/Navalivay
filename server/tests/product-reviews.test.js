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
  buildOrderLineIconsFromGroups,
  buildOrderFulfillmentMilestones,
  serializeOrderHistoryCard,
  parseQaUsernames,
  isQaReviewUser,
  shouldDevBypassForCustomer,
  setReviewSetting,
  setQaUsernames,
  REVIEW_STATUSES,
  MAX_REVIEW_BODY_LENGTH,
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

  let tooLong = false;
  try {
    validateReviewBodyText('а'.repeat(MAX_REVIEW_BODY_LENGTH + 1));
  } catch (error) {
    tooLong = error.code === 'review_body_too_long';
  }
  ok(tooLong, 'rejects overly long body');

  ok(
    validateReviewBodyText('а'.repeat(MAX_REVIEW_BODY_LENGTH)).length === MAX_REVIEW_BODY_LENGTH,
    'accepts body at max length',
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
  ok(
    optedOut.preferences?.reviews_opt_out === true,
    'opt-out prompt includes preferences',
  );

  db.prepare(`UPDATE customers SET reviews_opt_out = 0, reviews_prefer_anonymous = 1 WHERE id = ?`).run(
    'cust1',
  );
  const withPrefs = getReviewPromptForCustomer(
    db.prepare('SELECT * FROM customers WHERE id = ?').get('cust1'),
  );
  ok(
    withPrefs.preferences?.reviews_prefer_anonymous === true,
    'prompt exposes prefer_anonymous preference',
  );
}

console.log('\n--- parent vs child public review summaries ---');
{
  seedBase();
  db.prepare(
    `INSERT INTO category_groups (id, categoryId, parent_group_id, slug, name, [order], hide_empty, createdAt, updatedAt)
     VALUES ('grp_parent', 'cat_liq', NULL, 'podonki', 'PODONKI', 0, 0, DATETIME('now'), DATETIME('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO category_groups (id, categoryId, parent_group_id, slug, name, [order], hide_empty, createdAt, updatedAt)
     VALUES ('grp_child', 'cat_liq', 'grp_parent', 'podonki-podgon', 'PODONKI PODGON', 1, 0, DATETIME('now'), DATETIME('now'))`,
  ).run();
  db.prepare(`UPDATE products SET groupId = 'grp_child' WHERE id = 'prod1'`).run();

  createProductReview({
    customerId: 'cust1',
    orderId: 'ord1',
    groupId: 'grp_child',
    orderItemId: 'oi1',
    rating: 5,
    bodyText: 'Отличная линейка, беру не первый раз',
    quickTagIds: [],
    isAnonymous: false,
  });
  const childReviewId = db.prepare('SELECT id FROM product_reviews LIMIT 1').get().id;
  db.prepare(`UPDATE product_reviews SET status = 'approved', approved_at = DATETIME('now') WHERE id = ?`).run(
    childReviewId,
  );

  const parentSummary = getPublicGroupReviews('grp_parent', { limit: 1, offset: 0 });
  const childSummary = getPublicGroupReviews('grp_child', { limit: 1, offset: 0 });

  ok(parentSummary.review_count === 0, 'parent group summary stays empty');
  ok(childSummary.review_count === 1, 'child line keeps published review');
  ok(childSummary.average_rating === 5, 'child line average rating is exposed');
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

console.log('\n--- order history line icons ---');
{
  seedBase();
  db.prepare(`UPDATE categories SET cover_image = ? WHERE id = ?`).run(
    'data:image/webp;base64,CATEGORY_COVER',
    'cat_liq',
  );
  db.prepare(`UPDATE category_groups SET cover_image = ? WHERE id = ?`).run(
    'data:image/webp;base64,GROUP_ONE_COVER',
    'grp1',
  );
  db.prepare(
    `INSERT INTO category_groups (id, categoryId, slug, name, cover_image, [order], hide_empty, createdAt, updatedAt)
     VALUES ('grp2', 'cat_liq', 'grp2', 'Другая линейка', 'data:image/webp;base64,GROUP_TWO_COVER', 2, 0, DATETIME('now'), DATETIME('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO products (id, categoryId, groupId, title, priceRub, description, stock, createdAt)
     VALUES ('prod2', 'cat_liq', 'grp2', 'Манго', 12, '', 5, DATETIME('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO order_items (id, order_id, product_id, product_title, variant_name, quantity, price_per_unit, total_price, total_cost)
     VALUES ('oi2', 'ord1', 'prod2', 'Манго', 'Манговая', 1, 12, 12, 5)`,
  ).run();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get('ord1');
  const card = serializeOrderHistoryCard(order);

  ok(card.category_icons.length === 2, 'two line icons for two groups in one category');
  ok(
    card.category_icons.every((icon) => icon.image?.includes('GROUP_') && !icon.image?.includes('CATEGORY')),
    'history thumbs prefer group cover, not parent category cover',
  );
  ok(card.category_icons[0].group_id === 'grp1', 'first icon is first product line');
  ok(
    buildOrderLineIconsFromGroups([
      {
        group_id: 'grp1',
        category_id: 'cat_liq',
        category_name: 'Жидкости',
        group_name: 'Подонки',
        group_cover_image: null,
        category_cover_image: 'data:image/webp;base64,CATEGORY_ONLY',
      },
    ]).icons[0].image?.includes('CATEGORY_ONLY'),
    'category cover is fallback when group cover is missing',
  );
}

console.log('\n--- fulfillment milestones ---');
{
  seedBase();
  const submittedAt = '2026-06-19T09:54:00.000Z';
  const readyAt = '2026-06-19T09:56:00.000Z';
  const issuedAt = '2026-06-19T10:04:00.000Z';
  db.prepare(`UPDATE orders SET delivery_type = 'pickup', created_at = ?, completed_at = ? WHERE id = ?`).run(
    submittedAt,
    issuedAt,
    'ord1',
  );
  db.prepare(
    `INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_at)
     VALUES ('osh1', 'ord1', NULL, 'new', ?), ('osh2', 'ord1', 'new', 'in_progress', ?), ('osh3', 'ord1', 'in_progress', 'delivered', ?)`,
  ).run(submittedAt, readyAt, issuedAt);

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get('ord1');
  const milestones = buildOrderFulfillmentMilestones(order);
  const card = serializeOrderHistoryCard(order);

  ok(milestones.submitted_at === submittedAt, 'submitted milestone');
  ok(milestones.ready_at === readyAt, 'ready milestone');
  ok(milestones.issued_at === issuedAt, 'issued milestone');
  ok(card.delivery_type === 'pickup', 'history card exposes delivery type');
  ok(card.fulfillment_milestones.ready_at === readyAt, 'history card exposes milestones');
  ok(!('pending_review_count' in card), 'history card omits pending_review_count');
  ok(!('has_reviews' in card), 'history card omits has_reviews');
}

console.log('\n--- QA usernames: parse and bypass ---');
{
  setReviewSetting('dev_test_mode', '0');
  setReviewSetting('qa_active', '0');
  setQaUsernames(['rk0ff', '@Review_Demo']);

  ok(parseQaUsernames('rk0ff, @demo\nfoo').join(',') === 'rk0ff,demo,foo', 'parse usernames');
  ok(!shouldDevBypassForCustomer({ telegram_username: 'rk0ff' }), 'no bypass when qa inactive');

  setReviewSetting('qa_active', '1');
  ok(isQaReviewUser({ telegram_username: 'review_demo' }), 'qa user recognized');
  ok(!isQaReviewUser({ telegram_username: 'stranger' }), 'non-qa user rejected');
  ok(shouldDevBypassForCustomer({ telegram_username: 'review_demo' }), 'qa user bypass');

  seedBase();
  createProductReview({
    customerId: 'cust1',
    orderId: 'ord1',
    groupId: 'grp1',
    orderItemId: 'oi1',
    rating: 5,
    bodyText: 'QA отзыв на линейку, всё отлично',
    quickTagIds: [],
    devBypass: true,
  });
  const qaBlocked = getGroupReviewEligibility({
    customerId: 'cust1',
    groupId: 'grp1',
    orderId: 'ord1',
    devBypass: true,
  });
  ok(qaBlocked.canReview === false && qaBlocked.reason === 'pending_moderation', 'qa bypass still blocks duplicate pending');

  setReviewSetting('dev_test_mode', '1');
  ok(shouldDevBypassForCustomer({ telegram_username: 'anyone' }), 'global dev mode bypass');
  setReviewSetting('dev_test_mode', '0');
  setReviewSetting('qa_active', '0');
}

console.log(`\nDone: ${results.passed} passed, ${results.failed} failed\n`);
process.exit(results.failed > 0 ? 1 : 0);