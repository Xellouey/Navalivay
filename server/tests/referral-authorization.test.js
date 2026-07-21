import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDb = path.resolve(__dirname, `.tmp-referral-${Date.now()}.db`);
process.env.DATABASE_FILE = tmpDb;
process.env.BOT_TOKEN = '';

const { db, initDb } = await import('../db.js');
initDb();
const referral = await import('../utils/referral-authorization.js');
const blocks = await import('../utils/customer-blocks.js');
const { createOrderFromBot } = await import('../bot.js');

function customer(id, telegramId, username, { authorized = false, deleted = false } = {}) {
  db.prepare(`
    INSERT INTO customers (
      id, telegram_id, telegram_username, first_visit_at, total_orders, total_spent,
      access_authorized_at, access_authorization_source, deleted_at
    ) VALUES (?, ?, ?, DATETIME('now'), 0, 0, ?, ?, ?)
  `).run(
    id, telegramId, username,
    authorized ? '2026-01-01 00:00:00' : null,
    authorized ? 'legacy' : null,
    deleted ? '2026-01-02 00:00:00' : null,
  );
}

function order(id, number, customerId, status) {
  db.prepare(`
    INSERT INTO orders (
      id, order_number, customer_id, status, delivery_type,
      total_amount, final_amount, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'pickup', 10, 10, DATETIME('now'), DATETIME('now'))
  `).run(id, number, customerId, status);
}

function identity(id = '900', username = 'new_person') {
  return { telegramId: id, telegramUsername: username, firstName: 'Новый', lastName: null };
}

try {
  referral.setReferralAuthorizationEnabled(true);
  customer('eligible', '100', 'Good_User', { authorized: true });
  order('issued', 1, 'eligible', 'delivered');
  customer('not_issued', '101', 'NotIssued', { authorized: true });
  order('new_order', 2, 'not_issued', 'new');
  customer('deleted', '102', 'DeletedOne', { authorized: true, deleted: true });
  order('deleted_order', 3, 'deleted', 'completed');

  assert.equal(referral.getReferralAuthorizationStatus('900').required, true);
  assert.equal(referral.getReferralOrderCreationGate('900').allowed, false);
  assert.equal(referral.inspectInviter({ telegramId: '900', rawUsername: '@GOOD_user' }).ok, true);
  assert.equal(referral.inspectInviter({ telegramId: '900', rawUsername: ' good_user ' }).ok, true);
  for (const raw of ['', 'a', '@@good_user', 'юзер', "x' OR 1=1 --", 'a'.repeat(33)]) {
    assert.equal(referral.inspectInviter({ telegramId: '900', rawUsername: raw }).ok, false);
  }
  assert.equal(referral.inspectInviter({ telegramId: '900', rawUsername: 'NotIssued' }).code, 'referral_inviter_not_eligible');

  const disallowed = referral.addDisallowedInviterUsernames(['@Admin_User', 'admin_user'], 'admin');
  assert.deepEqual(disallowed.map((item) => item.username), ['admin_user']);
  const reserved = referral.inspectInviter({ telegramId: '900', rawUsername: '@ADMIN_USER' });
  assert.equal(reserved.code, 'referral_inviter_reserved');
  assert.equal(reserved.consumesAttempt, false);
  referral.recordReferralOutcome({ identity: identity(), rawUsername: '@ADMIN_USER', result: reserved });
  assert.equal(referral.getReferralAuthorizationStatus('900').attempts_used, 0);
  assert.throws(
    () => referral.addDisallowedInviterUsernames(['корень'], 'admin'),
    (error) => error.code === 'username_invalid',
  );
  assert.equal(referral.removeDisallowedInviterUsername('ADMIN_USER'), true);
  assert.equal(referral.isDisallowedInviterUsername('admin_user'), false);

  assert.equal(referral.inspectInviter({ telegramId: '100', rawUsername: 'Good_User' }).code, 'referral_self_invite');
  customer('legacy_self', null, 'legacy_self', { authorized: true });
  order('legacy_self_order', 6, 'legacy_self', 'delivered');
  assert.equal(referral.inspectInviter({
    telegramId: '999',
    telegramUsername: 'LEGACY_SELF',
    rawUsername: '@legacy_self',
  }).code, 'referral_self_invite');
  assert.equal(referral.inspectInviter({ telegramId: '900', rawUsername: 'DeletedOne' }).code, 'referral_inviter_not_eligible');

  customer('duplicate', '103', 'good_user', { authorized: true });
  order('duplicate_order', 4, 'duplicate', 'delivered');
  const ambiguous = referral.inspectInviter({ telegramId: '900', rawUsername: 'GOOD_USER' });
  assert.equal(ambiguous.code, 'referral_username_ambiguous');
  referral.recordReferralOutcome({ identity: identity(), rawUsername: 'GOOD_USER', result: ambiguous });
  assert.equal(referral.getReferralAuthorizationStatus('900').attempts_used, 0);
  db.prepare("UPDATE customers SET telegram_username = 'former_good' WHERE id = 'duplicate'").run();

  const ordinaryBlock = blocks.createBlock({ customer_id: 'eligible', reason: 'test', blocked_by: 'admin' });
  const blockedInviter = referral.inspectInviter({ telegramId: '900', rawUsername: 'Good_User' });
  assert.equal(blockedInviter.code, 'referral_inviter_blocked');
  referral.recordReferralOutcome({ identity: identity(), rawUsername: 'Good_User', result: blockedInviter });
  assert.equal(referral.getReferralAuthorizationStatus('900').attempts_used, 0);
  blocks.unblockCustomerBlock(ordinaryBlock.block.id);

  // Если обычный бан появился между проверкой и записью ошибки, попытка не
  // расходуется и скрытый вечный authorization_failed не создаётся.
  customer('attempt_race_customer', '905', 'attempt_race');
  const raceWrong = referral.inspectInviter({ telegramId: '905', rawUsername: 'Unknown_User' });
  referral.recordReferralOutcome({ identity: identity('905', 'attempt_race'), rawUsername: 'Unknown_User', result: raceWrong });
  referral.recordReferralOutcome({ identity: identity('905', 'attempt_race'), rawUsername: 'Unknown_User', result: raceWrong });
  const raceOrdinaryBlock = blocks.createBlock({
    customer_id: 'attempt_race_customer',
    reason: 'обычный бан в гонке',
    blocked_by: 'admin',
  });
  const racedStatus = referral.recordReferralOutcome({
    identity: identity('905', 'attempt_race'),
    rawUsername: 'Unknown_User',
    result: raceWrong,
  });
  assert.equal(racedStatus.customer_blocked, true);
  assert.equal(racedStatus.attempts_used, 2);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM customer_blocks WHERE customer_id = ? AND block_type = 'authorization_failed'")
      .get('attempt_race_customer').count,
    0,
  );
  blocks.unblockCustomerBlock(raceOrdinaryBlock.block.id);
  assert.equal(referral.getReferralAuthorizationStatus('905').blocked, false);
  assert.equal(referral.getReferralAuthorizationStatus('905').attempts_remaining, 1);

  const inviteBan = referral.createInviteBan({ customerId: 'eligible', reason: 'кого попало', bannedBy: 'admin' });
  db.prepare("UPDATE customers SET telegram_username = 'RenamedGood' WHERE id = 'eligible'").run();
  const forbidden = referral.inspectInviter({ telegramId: '900', rawUsername: 'RenamedGood' });
  assert.equal(forbidden.code, 'referral_inviter_forbidden');
  referral.recordReferralOutcome({ identity: identity(), rawUsername: 'RenamedGood', result: forbidden });
  assert.equal(referral.getReferralAuthorizationStatus('900').attempts_used, 0);
  const combinedBlock = blocks.createBlock({ customer_id: 'eligible', reason: 'оба запрета', blocked_by: 'admin' });
  assert.equal(
    referral.inspectInviter({ telegramId: '900', rawUsername: 'RenamedGood' }).code,
    'referral_inviter_blocked',
  );
  blocks.unblockCustomerBlock(combinedBlock.block.id);
  assert.equal(referral.removeInviteBan(inviteBan.id, { unbannedBy: 'admin' }), true);
  db.prepare("UPDATE customers SET telegram_username = 'Good_User' WHERE id = 'eligible'").run();

  const wrong = referral.inspectInviter({ telegramId: '900', rawUsername: 'Unknown_User' });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const status = referral.recordReferralOutcome({ identity: identity(), rawUsername: 'Unknown_User', result: wrong });
    assert.equal(status.attempts_used, attempt);
  }
  const failedCustomer = db.prepare("SELECT * FROM customers WHERE telegram_id = '900'").get();
  assert.equal(failedCustomer.access_authorized_at, null);
  const failedBlock = blocks.getActiveBlockForCustomerId(failedCustomer.id);
  assert.equal(failedBlock.block_type, 'authorization_failed');
  assert.equal(failedBlock.reason, 'Авторизация не пройдена');
  blocks.unblockCustomerBlock(failedBlock.id, { unblocked_by: 'admin' });
  assert.equal(referral.getReferralAuthorizationStatus('900').attempts_used, 0);
  assert.equal(referral.getReferralAuthorizationStatus('900').required, true);

  const valid = referral.inspectInviter({ telegramId: '900', rawUsername: '@Good_User' });
  const validWithoutAt = referral.inspectInviter({ telegramId: '900', rawUsername: '  Good_User  ' });
  assert.equal(valid.ok, true);
  assert.equal(validWithoutAt.ok, true);
  assert.equal(validWithoutAt.username, valid.username);
  assert.equal(validWithoutAt.inviter.id, valid.inviter.id);
  order('first_new_order', 5, failedCustomer.id, 'new');
  referral.markReferralAuthorized({
    customerId: failedCustomer.id,
    telegramId: '900',
    inviter: valid.inviter,
    submittedUsername: '@Good_User',
    orderId: 'first_new_order',
  });
  assert.equal(referral.getReferralAuthorizationStatus('900').authorized, true);
  assert.equal(referral.getReferralOrderCreationGate('900').allowed, true);
  const relation = db.prepare('SELECT * FROM customer_referrals WHERE invitee_customer_id = ?').get(failedCustomer.id);
  assert.equal(relation.inviter_customer_id, 'eligible');

  db.prepare("UPDATE customers SET telegram_username = 'CurrentGood' WHERE id = 'eligible'").run();
  const listRow = referral.listReferralAuthorizations().find((row) => row.telegram_id === '900');
  assert.equal(listRow.inviter_username, 'CurrentGood');
  db.prepare("UPDATE customers SET telegram_username = NULL WHERE id = 'eligible'").run();
  const fallbackRow = referral.listReferralAuthorizations().find((row) => row.telegram_id === '900');
  assert.equal(fallbackRow.inviter_username, 'good_user');

  // Первый заказ должен привязаться независимо от того, создал его клиент,
  // Telegram-бот или менеджер. Повторный заказ не перезаписывает первый.
  customer('channel_invitee', '904', 'channel_invitee');
  referral.markReferralAuthorized({
    customerId: 'channel_invitee',
    telegramId: '904',
    inviter: valid.inviter,
    submittedUsername: 'Good_User',
    orderId: null,
  });
  order('channel_first_order', 7, 'channel_invitee', 'new');
  assert.equal(referral.attachFirstOrderToReferral('channel_invitee', 'channel_first_order'), true);
  order('channel_second_order', 8, 'channel_invitee', 'new');
  assert.equal(referral.attachFirstOrderToReferral('channel_invitee', 'channel_second_order'), false);
  assert.equal(
    db.prepare('SELECT first_order_id FROM customer_referrals WHERE invitee_customer_id = ?')
      .get('channel_invitee').first_order_id,
    'channel_first_order',
  );

  // Даже если ранняя версия ошибочно оставила legacy-флаг, доступ даёт только
  // выданный заказ. Новый, собранный и отменённый заказ не подходят.
  customer('stale_legacy_zero', '907', 'stale_legacy_zero', { authorized: true });
  assert.equal(referral.isCustomerAccessAuthorized('stale_legacy_zero'), false);
  assert.equal(referral.getReferralAuthorizationStatus('907').required, true);
  const staleWrong = referral.inspectInviter({ telegramId: '907', rawUsername: 'Unknown_User' });
  assert.equal(
    referral.recordReferralOutcome({
      identity: identity('907', 'stale_legacy_zero'),
      rawUsername: 'Unknown_User',
      result: staleWrong,
    }).attempts_used,
    1,
  );
  order('stale_legacy_first_order', 9, 'stale_legacy_zero', 'cancelled');
  assert.equal(referral.isCustomerAccessAuthorized('stale_legacy_zero'), false);
  assert.equal(referral.getReferralAuthorizationStatus('907').required, true);
  db.prepare("UPDATE orders SET status = 'in_progress' WHERE id = 'stale_legacy_first_order'").run();
  assert.equal(referral.isCustomerAccessAuthorized('stale_legacy_zero'), false);
  db.prepare("UPDATE orders SET status = 'completed' WHERE id = 'stale_legacy_first_order'").run();
  assert.equal(referral.isCustomerAccessAuthorized('stale_legacy_zero'), true);
  assert.equal(referral.getReferralAuthorizationStatus('907').required, false);

  // Адверсариальный случай: менеджер выдал заказ между внешней проверкой и
  // записью третьей ошибки. Вечный authorization_failed создаваться не должен.
  customer('issued_race_customer', '908', 'issued_race');
  const issuedRaceWrong = referral.inspectInviter({ telegramId: '908', rawUsername: 'Unknown_User' });
  referral.recordReferralOutcome({ identity: identity('908', 'issued_race'), rawUsername: 'Unknown_User', result: issuedRaceWrong });
  referral.recordReferralOutcome({ identity: identity('908', 'issued_race'), rawUsername: 'Unknown_User', result: issuedRaceWrong });
  order('issued_race_order', 11, 'issued_race_customer', 'new');
  db.prepare("UPDATE orders SET status = 'delivered' WHERE id = 'issued_race_order'").run();
  const issuedRaceStatus = referral.recordReferralOutcome({
    identity: identity('908', 'issued_race'),
    rawUsername: 'Unknown_User',
    result: issuedRaceWrong,
  });
  assert.equal(issuedRaceStatus.authorized, true);
  assert.equal(issuedRaceStatus.attempts_used, 2);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM customer_blocks WHERE customer_id = ? AND block_type = 'authorization_failed'")
      .get('issued_race_customer').count,
    0,
  );

  customer('staff_over_legacy', '909', 'staff_over_legacy', { authorized: true });
  referral.authorizeCustomerWithoutReferral('staff_over_legacy', 'staff');
  assert.equal(
    db.prepare("SELECT access_authorization_source FROM customers WHERE id = 'staff_over_legacy'").get()
      .access_authorization_source,
    'staff',
  );
  assert.equal(referral.isCustomerAccessAuthorized('staff_over_legacy'), true);

  referral.setReferralAuthorizationEnabled(false);
  assert.equal(referral.getReferralAuthorizationStatus('901').required, false);
  assert.equal(referral.getReferralOrderCreationGate('901').allowed, true);
  customer('feature_off_customer', '902', 'feature_off', { authorized: false });
  order('feature_off_order', 10, 'feature_off_customer', 'new');
  referral.authorizeCustomerWithoutReferral('feature_off_customer', 'feature_disabled');
  assert.equal(referral.getReferralAuthorizationStatus('902').authorized, false);
  assert.equal(referral.isCustomerAccessAuthorized('feature_off_customer'), false);

  // Новый невыданный заказ при выключенной функции не даёт обход после
  // включения. После фактической выдачи доступ появляется автоматически.
  customer('bot_feature_off_customer', '906', 'bot_feature_off');
  db.prepare("INSERT INTO categories (id, slug, name) VALUES ('bot_test_category', 'bot-test', 'Bot test')").run();
  db.prepare(`
    INSERT INTO products (id, categoryId, title, priceRub, createdAt, stock, cost_price)
    VALUES ('bot_test_product', 'bot_test_category', 'Bot product', 15, DATETIME('now'), 5, 4)
  `).run();
  createOrderFromBot({
    customerId: 'bot_feature_off_customer',
    product: db.prepare("SELECT * FROM products WHERE id = 'bot_test_product'").get(),
    quantity: 1,
    telegramMessageId: 1,
    originalMessage: 'заказать Bot product',
  });
  assert.equal(
    db.prepare('SELECT access_authorization_source FROM customers WHERE id = ?')
      .get('bot_feature_off_customer').access_authorization_source,
    'feature_disabled',
  );
  referral.setReferralAuthorizationEnabled(true);
  assert.equal(referral.getReferralAuthorizationStatus('902').required, true);
  assert.equal(referral.getReferralAuthorizationStatus('902').authorized, false);
  assert.equal(referral.getReferralAuthorizationStatus('906').required, true);
  db.prepare("UPDATE orders SET status = 'delivered' WHERE id = 'feature_off_order'").run();
  const botFeatureOrder = db.prepare("SELECT id FROM orders WHERE customer_id = 'bot_feature_off_customer'").get();
  db.prepare("UPDATE orders SET status = 'completed' WHERE id = ?").run(botFeatureOrder.id);
  assert.equal(referral.getReferralAuthorizationStatus('902').authorized, true);
  assert.equal(referral.getReferralAuthorizationStatus('906').authorized, true);
  console.log('referral-authorization.test.js: ok');
} finally {
  db.close();
  fs.rmSync(tmpDb, { force: true });
  fs.rmSync(`${tmpDb}-wal`, { force: true });
  fs.rmSync(`${tmpDb}-shm`, { force: true });
}
