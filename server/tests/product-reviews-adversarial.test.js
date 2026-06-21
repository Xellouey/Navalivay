/**
 * Product reviews — adversarial + regression unit tests.
 * Fraud patterns: fake purchase, cooldown abuse, duplicate spam, IDOR payloads.
 * Run: node server/tests/product-reviews-adversarial.test.js
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'navalivay-product-reviews-adv-'));
process.env.DATABASE_FILE = path.join(tempDir, 'test.db');
process.env.NODE_ENV = 'test';

const { initDb, db } = await import('../db.js');
const {
  createProductReview,
  getGroupReviewEligibility,
  getPublicGroupReviews,
  getReviewPromptForCustomer,
  setReviewSetting,
  validateReviewBodyText,
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

function expectThrows(fn, code, msg) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  ok(thrown?.code === code, `${msg} — code=${thrown?.code || 'none'}`);
}

function seedWorld({
  customerId = 'cust1',
  telegramId = '111',
  orderStatus = 'delivered',
  secondCustomer = false,
} = {}) {
  db.exec('DELETE FROM product_reviews;');
  db.exec('DELETE FROM order_items;');
  db.exec('DELETE FROM orders;');
  db.exec('DELETE FROM products;');
  db.exec('DELETE FROM category_groups;');
  db.exec('DELETE FROM categories;');
  db.exec('DELETE FROM customers;');
  db.exec('DELETE FROM review_quick_tags;');

  db.prepare(
    `INSERT INTO customers (id, telegram_id, telegram_username, first_name, reviews_opt_out, created_at, updated_at)
     VALUES (?, ?, ?, 'Buyer', 0, DATETIME('now'), DATETIME('now'))`,
  ).run(customerId, telegramId, 'buyer1');

  if (secondCustomer) {
    db.prepare(
      `INSERT INTO customers (id, telegram_id, telegram_username, first_name, reviews_opt_out, created_at, updated_at)
       VALUES ('cust2', '222', 'buyer2', 'Other', 0, DATETIME('now'), DATETIME('now'))`,
    ).run();
  }

  db.prepare(
    `INSERT INTO categories (id, slug, name, [order], hide_empty, storefront_filters_profile)
     VALUES ('cat1', 'salt-liquids', 'Жидкости', 1, 0, 'liquids')`,
  ).run();

  db.prepare(
    `INSERT INTO category_groups (id, categoryId, slug, name, [order], hide_empty, createdAt, updatedAt)
     VALUES ('grp1', 'cat1', 'grp1', 'Подонки', 1, 0, DATETIME('now'), DATETIME('now')),
            ('grp2', 'cat1', 'grp2', 'Другая', 1, 0, DATETIME('now'), DATETIME('now'))`,
  ).run();

  db.prepare(
    `INSERT INTO products (id, categoryId, groupId, title, priceRub, description, stock, createdAt)
     VALUES ('prod1', 'cat1', 'grp1', 'Ананас', 10, '', 5, DATETIME('now')),
            ('prod2', 'cat1', 'grp2', 'Манго', 10, '', 5, DATETIME('now'))`,
  ).run();

  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status, total_amount, final_amount, completed_at, created_at, updated_at)
     VALUES ('ord1', 1001, ?, ?, 10, 10, DATETIME('now'), DATETIME('now'), DATETIME('now'))`,
  ).run(customerId, orderStatus);

  db.prepare(
    `INSERT INTO order_items (id, order_id, product_id, product_title, variant_name, quantity, price_per_unit, total_price, total_cost)
     VALUES ('oi1', 'ord1', 'prod1', 'Ананас', 'Ананасовая шипучка', 1, 10, 10, 4)`,
  ).run();

  db.prepare(
    `INSERT INTO review_quick_tags (id, category_key, star_rating, label, insert_text, sort_order, is_active, created_at, updated_at)
     VALUES ('tag1', 'liquids', 5, 'Хороший вкус', 'Хороший вкус жидкости.', 1, 1, DATETIME('now'), DATETIME('now'))`,
  ).run();
}

console.log('\n=== product-reviews adversarial + regression ===\n');

console.log('--- A1: cannot review without purchase ---');
{
  seedWorld();
  const eligibility = getGroupReviewEligibility({
    customerId: 'cust2',
    groupId: 'grp1',
    orderId: 'ord1',
  });
  ok(eligibility.canReview === false && eligibility.reason === 'not_purchased', 'foreign customer blocked');
}

console.log('\n--- A2: cannot review active order ---');
{
  seedWorld({ orderStatus: 'in_progress' });
  expectThrows(
    () =>
      createProductReview({
        customerId: 'cust1',
        orderId: 'ord1',
        groupId: 'grp1',
        orderItemId: 'oi1',
        rating: 5,
        bodyText: 'Пытаюсь оставить отзыв на незавершённый заказ',
        quickTagIds: [],
      }),
    'order_not_reviewable',
    'active order rejected',
  );
}

console.log('\n--- A3: duplicate pending blocks second review ---');
{
  seedWorld();
  createProductReview({
    customerId: 'cust1',
    orderId: 'ord1',
    groupId: 'grp1',
    orderItemId: 'oi1',
    rating: 5,
    bodyText: 'Первый отзыв на линейку, всё отлично',
    quickTagIds: [],
  });
  expectThrows(
    () =>
      createProductReview({
        customerId: 'cust1',
        orderId: 'ord1',
        groupId: 'grp1',
        orderItemId: 'oi1',
        rating: 4,
        bodyText: 'Второй отзыв сразу же, спам попытка',
        quickTagIds: [],
      }),
    'pending_moderation',
    'duplicate pending blocked',
  );
}

console.log('\n--- A3b: qa/dev bypass still blocks duplicate pending ---');
{
  seedWorld();
  createProductReview({
    customerId: 'cust1',
    orderId: 'ord1',
    groupId: 'grp1',
    orderItemId: 'oi1',
    rating: 5,
    bodyText: 'Первый QA-отзыв на линейку, всё отлично',
    quickTagIds: [],
    devBypass: true,
  });
  expectThrows(
    () =>
      createProductReview({
        customerId: 'cust1',
        orderId: 'ord1',
        groupId: 'grp1',
        orderItemId: 'oi1',
        rating: 4,
        bodyText: 'Повторная отправка в QA-режиме, спам попытка',
        quickTagIds: [],
        devBypass: true,
      }),
    'pending_moderation',
    'qa duplicate pending blocked',
  );
}

console.log('\n--- A4: cooldown after approved review ---');
{
  seedWorld();
  const review = createProductReview({
    customerId: 'cust1',
    orderId: 'ord1',
    groupId: 'grp1',
    orderItemId: 'oi1',
    rating: 5,
    bodyText: 'Отличная линейка, беру снова и снова',
    quickTagIds: [],
  });
  db.prepare(
    `UPDATE product_reviews SET status = ?, approved_at = DATETIME('now') WHERE id = ?`,
  ).run(REVIEW_STATUSES.APPROVED, review.id);

  const blocked = getGroupReviewEligibility({
    customerId: 'cust1',
    groupId: 'grp1',
    orderId: 'ord1',
  });
  ok(blocked.canReview === false && blocked.reason === 'cooldown', 'cooldown enforced');
}

console.log('\n--- A5: invalid quick tag rejected ---');
{
  seedWorld();
  expectThrows(
    () =>
      createProductReview({
        customerId: 'cust1',
        orderId: 'ord1',
        groupId: 'grp1',
        orderItemId: 'oi1',
        rating: 5,
        bodyText: 'Отзыв с подставным тегом для накрутки',
        quickTagIds: ['fake-tag-id'],
      }),
    'invalid_quick_tags',
    'fake quick tag rejected',
  );
}

console.log('\n--- A5b: quick tag with wrong star rating rejected ---');
{
  seedWorld();
  db.prepare(
    `INSERT INTO review_quick_tags (id, category_key, star_rating, label, insert_text, sort_order, is_active, created_at, updated_at)
     VALUES ('tag4', 'liquids', 4, 'Норм', 'Нормальный вкус.', 2, 1, DATETIME('now'), DATETIME('now'))`,
  ).run();
  expectThrows(
    () =>
      createProductReview({
        customerId: 'cust1',
        orderId: 'ord1',
        groupId: 'grp1',
        orderItemId: 'oi1',
        rating: 5,
        bodyText: 'Пытаюсь прикрепить тег от четырёх звёзд к пятёрке',
        quickTagIds: ['tag4'],
      }),
    'invalid_quick_tags',
    'wrong star rating tag rejected',
  );
}

console.log('\n--- A5c: quick tag from another category rejected ---');
{
  seedWorld();
  db.prepare(
    `INSERT INTO review_quick_tags (id, category_key, star_rating, label, insert_text, sort_order, is_active, created_at, updated_at)
     VALUES ('tag_snus', 'snus', 5, 'Крепко', 'Крепкий снюс.', 3, 1, DATETIME('now'), DATETIME('now'))`,
  ).run();
  expectThrows(
    () =>
      createProductReview({
        customerId: 'cust1',
        orderId: 'ord1',
        groupId: 'grp1',
        orderItemId: 'oi1',
        rating: 5,
        bodyText: 'Пытаюсь прикрепить тег от другой категории',
        quickTagIds: ['tag_snus'],
      }),
    'invalid_quick_tags',
    'wrong category tag rejected',
  );
}

console.log('\n--- A6: rating bounds ---');
{
  seedWorld();
  expectThrows(
    () =>
      createProductReview({
        customerId: 'cust1',
        orderId: 'ord1',
        groupId: 'grp1',
        rating: 0,
        bodyText: 'Нулевая оценка не должна пройти валидацию',
        quickTagIds: [],
      }),
    'invalid_rating',
    'rating 0 rejected',
  );
  expectThrows(
    () =>
      createProductReview({
        customerId: 'cust1',
        orderId: 'ord1',
        groupId: 'grp1',
        rating: 6,
        bodyText: 'Шестая звезда не должна пройти валидацию',
        quickTagIds: [],
      }),
    'invalid_rating',
    'rating 6 rejected',
  );
}

console.log('\n--- A7: body too short (anti empty-review) ---');
{
  seedWorld();
  expectThrows(
    () => validateReviewBodyText('коротко'),
    'review_body_too_short',
    'short body rejected',
  );
}

console.log('\n--- A8: wrong group on order rejected ---');
{
  seedWorld();
  expectThrows(
    () =>
      createProductReview({
        customerId: 'cust1',
        orderId: 'ord1',
        groupId: 'grp2',
        orderItemId: 'oi1',
        rating: 5,
        bodyText: 'Отзыв на линейку которую не покупал в заказе',
        quickTagIds: [],
      }),
    'not_purchased',
    'group not in order blocked',
  );
}

console.log('\n--- A9: opt-out hides prompt ---');
{
  seedWorld();
  db.prepare('UPDATE customers SET reviews_opt_out = 1 WHERE id = ?').run('cust1');
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get('cust1');
  const prompt = getReviewPromptForCustomer(customer);
  ok(prompt.show === false && prompt.reason === 'opt_out', 'opt-out respected');
}

console.log('\n--- A10: public reviews hide pending/rejected ---');
{
  seedWorld();
  const pending = createProductReview({
    customerId: 'cust1',
    orderId: 'ord1',
    groupId: 'grp1',
    orderItemId: 'oi1',
    rating: 1,
    bodyText: 'Негативный отзыв пока на модерации, скрыт',
    quickTagIds: [],
    isAnonymous: false,
  });
  db.prepare(`UPDATE product_reviews SET status = ? WHERE id = ?`).run(
    REVIEW_STATUSES.REJECTED,
    pending.id,
  );

  const approved = createProductReview({
    customerId: 'cust1',
    orderId: 'ord1',
    groupId: 'grp1',
    orderItemId: 'oi1',
    rating: 5,
    bodyText: 'Одобренный отзыв виден всем покупателям',
    quickTagIds: [],
    isAnonymous: true,
  });
  db.prepare(`UPDATE product_reviews SET status = ?, approved_at = DATETIME('now') WHERE id = ?`).run(
    REVIEW_STATUSES.APPROVED,
    approved.id,
  );

  const pub = getPublicGroupReviews('grp1');
  ok(pub.review_count === 1, 'only approved visible');
  ok(pub.items[0].reviewer.is_anonymous === true, 'anonymous mask applied');
  ok(!JSON.stringify(pub.items[0]).includes('@'), 'no username in public payload');
}

console.log('\n--- A11: dev test mode allows review without delivered status ---');
{
  seedWorld({ orderStatus: 'new' });
  setReviewSetting('dev_test_mode', '1');
  const review = createProductReview({
    customerId: 'cust1',
    orderId: 'ord1',
    groupId: 'grp1',
    orderItemId: 'oi1',
    rating: 5,
    bodyText: 'Тестовый отзыв в dev mode без выдачи',
    quickTagIds: [],
    devBypass: true,
  });
  ok(review?.id, 'dev bypass creates review');
  setReviewSetting('dev_test_mode', '0');
}

console.log('\n--- R1: whitespace-trimmed body passes at 20 chars ---');
{
  ok(
    validateReviewBodyText('  Двадцать символов тут  ').length >= 20,
    'trimmed body accepted',
  );
}

console.log('\n--- R2: rejected review allows resubmit ---');
{
  seedWorld();
  const first = createProductReview({
    customerId: 'cust1',
    orderId: 'ord1',
    groupId: 'grp1',
    orderItemId: 'oi1',
    rating: 2,
    bodyText: 'Первый отзыв отклонён модератором позже',
    quickTagIds: [],
  });
  db.prepare(`UPDATE product_reviews SET status = ? WHERE id = ?`).run(
    REVIEW_STATUSES.REJECTED,
    first.id,
  );

  const second = createProductReview({
    customerId: 'cust1',
    orderId: 'ord1',
    groupId: 'grp1',
    orderItemId: 'oi1',
    rating: 5,
    bodyText: 'Исправленный отзыв после отклонения модерации',
    quickTagIds: ['tag1'],
  });
  ok(second?.status === REVIEW_STATUSES.PENDING, 'resubmit after reject allowed');
}

console.log(`\nDone: ${results.passed} passed, ${results.failed} failed\n`);
process.exit(results.failed > 0 ? 1 : 0);