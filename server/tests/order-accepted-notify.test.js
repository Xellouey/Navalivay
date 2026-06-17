/**
 * order_accepted — авто-сообщение постоянным клиентам при POST /api/orders.
 * Adversarial tests: returning gate, block, idempotency, template off, userbot down.
 *
 * Запуск: node server/tests/order-accepted-notify.test.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TMP_DB = path.resolve(__dirname, `./.tmp-order-accepted-${Date.now()}.db`);
process.env.DATABASE_FILE = TMP_DB;
process.env.BOT_TOKEN = 'test-token-1234567890';

const { db, initDb } = await import('../db.js');
initDb();

const { upsertStatusTemplate } = await import('../utils/business-bot.js');
const {
  autoNotifyOrderAccepted,
  autoNotifyForStatusChange,
  isReturningCustomer,
  ORDER_ACCEPTED_EVENT,
} = await import('../utils/auto-notify.js');
const { migrateOrderAcceptedTemplate } = await import('../migrations/add_order_accepted_template.js');
const { enrichOrdersWithRelations } = await import('../utils/crm-order-enrichment.js');
const { _resetHealthCacheForTests } = await import('../utils/userbot-client.js');

const results = { passed: 0, failed: 0 };
function assertEq(actual, expected, msg) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    results.passed++;
    console.log(`  OK: ${msg}`);
  } else {
    results.failed++;
    console.log(`  FAIL: ${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function assert(cond, msg) {
  assertEq(Boolean(cond), true, msg);
}

function resetDb() {
  db.exec(`DELETE FROM bot_message_log;`);
  db.exec(`DELETE FROM customer_blocks;`);
  db.exec(`DELETE FROM customers;`);
  db.exec(`DELETE FROM order_items;`);
  db.exec(`DELETE FROM orders;`);
  upsertStatusTemplate('order_accepted', {
    title: 'Заказ принят',
    body: 'Добрый день! Заказ №{order_number} принят, сумма {final_amount} BYN.',
    is_active: 1,
  });
}

function mockUserbotOk({ captureBody = null } = {}) {
  return async (url, init) => {
    const u = String(url);
    if (u.includes('127.0.0.1') && u.includes('/health')) {
      return { ok: true, async json() { return { ok: true, connected: true }; } };
    }
    if (u.includes('127.0.0.1') && u.includes('/send-message')) {
      if (captureBody) captureBody.value = JSON.parse(init.body);
      return { ok: true, async json() { return { ok: true, telegram_message_id: 9001 }; } };
    }
    throw new Error(`unexpected fetch ${u}`);
  };
}

function makeReturningCustomer({ telegramId = '111', verified = true, priorOrders = 1 } = {}) {
  const customerId = 'c_ret';
  db.prepare(
    `INSERT INTO customers (id, telegram_id, telegram_username, first_name, total_orders)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(customerId, telegramId, 'returning_user', 'Постоянный', priorOrders + 1);
  if (verified) {
    db.prepare(`UPDATE customers SET bot_verified_at = DATETIME('now') WHERE id = ?`).run(customerId);
  }
  for (let i = 0; i < priorOrders; i += 1) {
    db.prepare(
      `INSERT INTO orders (id, order_number, customer_id, status, total_amount, final_amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(`o_prior_${i}`, 8000 + i, customerId, 'delivered', 50, 50);
  }
  const orderId = 'o_new';
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status, total_amount, final_amount)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(orderId, 1001, customerId, 'new', 100, 100);
  return { orderId, customerId, telegramId };
}

// --- T1: returning + userbot ok ---
console.log('\n=== T1: returning customer → sent order_accepted ===');
resetDb();
const returning = makeReturningCustomer();
let sendBody = { value: null };
const origFetch = globalThis.fetch;
globalThis.fetch = mockUserbotOk({ captureBody: sendBody });
_resetHealthCacheForTests();
try {
  const result = await autoNotifyOrderAccepted({ orderId: returning.orderId });
  assertEq(result.sent, true, 'sent=true');
  assertEq(result.event, ORDER_ACCEPTED_EVENT, 'event=order_accepted');
  assertEq(sendBody.value?.chat_id, returning.telegramId, 'chat_id корректный');
  assert(sendBody.value?.text?.includes('1001'), 'текст содержит order_number');
} finally {
  globalThis.fetch = origFetch;
  _resetHealthCacheForTests();
}

// --- T2: new customer → skip ---
console.log('\n=== T2: new customer (0 prior) → new_customer_no_dialog ===');
resetDb();
{
  const customerId = 'c_new';
  db.prepare(
    `INSERT INTO customers (id, telegram_id, telegram_username, first_name, total_orders, bot_verified_at)
     VALUES (?, ?, ?, ?, 1, DATETIME('now'))`,
  ).run(customerId, '222', 'newbie', 'Новый');
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status, total_amount, final_amount)
     VALUES (?, ?, ?, 'new', 100, 100)`,
  ).run('o_newbie', 1002, customerId);

  let sendHits = 0;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/health')) {
      return { ok: true, async json() { return { ok: true, connected: true }; } };
    }
    if (u.includes('/send-message')) {
      sendHits++;
      throw new Error('must not send');
    }
    throw new Error(`unexpected ${u}`);
  };
  try {
    const result = await autoNotifyOrderAccepted({ orderId: 'o_newbie' });
    assertEq(result.skipped, true, 'skipped=true');
    assertEq(result.reason, 'new_customer_no_dialog', 'reason=new_customer_no_dialog');
    assertEq(sendHits, 0, 'send не вызывался');
  } finally {
    globalThis.fetch = origFetch;
    _resetHealthCacheForTests();
  }
}

// --- T3: blocked customer ---
console.log('\n=== T3: blocked customer → customer_blocked ===');
resetDb();
const blocked = makeReturningCustomer({ telegramId: '333' });
db.prepare(
  `INSERT INTO customer_blocks (id, customer_id, block_until, reason, active)
   VALUES (?, ?, NULL, ?, 1)`,
).run('blk_1', blocked.customerId, 'test');
let blockedHits = 0;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/health')) {
    return { ok: true, async json() { return { ok: true, connected: true }; } };
  }
  if (u.includes('/send-message')) {
    blockedHits++;
    throw new Error('must not send');
  }
  throw new Error(`unexpected ${u}`);
};
try {
  const result = await autoNotifyOrderAccepted({ orderId: blocked.orderId });
  assertEq(result.reason, 'customer_blocked', 'reason=customer_blocked');
  assertEq(blockedHits, 0, 'send не вызывался');
} finally {
  globalThis.fetch = origFetch;
  _resetHealthCacheForTests();
}

// --- T4: template inactive ---
console.log('\n=== T4: template is_active=0 → skip ===');
resetDb();
makeReturningCustomer({ telegramId: '444' });
upsertStatusTemplate('order_accepted', {
  title: 'Заказ принят',
  body: 'Текст',
  is_active: 0,
});
try {
  const result = await autoNotifyOrderAccepted({ orderId: 'o_new' });
  assertEq(result.reason, 'template_inactive_or_missing', 'template inactive');
} finally {
  _resetHealthCacheForTests();
}

// --- T5: idempotency — double call ---
console.log('\n=== T5: double call → already_sent, один send ===');
resetDb();
makeReturningCustomer({ telegramId: '555' });
let sendCount = 0;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('/health')) {
    return { ok: true, async json() { return { ok: true, connected: true }; } };
  }
  if (u.includes('/send-message')) {
    sendCount++;
    return { ok: true, async json() { return { ok: true, telegram_message_id: 1 }; } };
  }
  throw new Error(`unexpected ${u}`);
};
try {
  const first = await autoNotifyOrderAccepted({ orderId: 'o_new' });
  assertEq(first.sent, true, 'first sent=true');
  const second = await autoNotifyOrderAccepted({ orderId: 'o_new' });
  assertEq(second.reason, 'already_sent', 'second already_sent');
  assertEq(sendCount, 1, 'только один send');
} finally {
  globalThis.fetch = origFetch;
  _resetHealthCacheForTests();
}

// --- T6: userbot unavailable ---
console.log('\n=== T6: userbot /health fail → userbot_unavailable ===');
resetDb();
makeReturningCustomer({ telegramId: '666' });
_resetHealthCacheForTests();
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/health')) {
    return { ok: false, status: 503, async json() { return {}; } };
  }
  throw new Error(`unexpected ${u}`);
};
try {
  const result = await autoNotifyOrderAccepted({ orderId: 'o_new' });
  assertEq(result.reason, 'userbot_unavailable', 'userbot_unavailable');
  const logRows = db.prepare(`SELECT meta FROM bot_message_log ORDER BY id DESC LIMIT 1`).all();
  const meta = JSON.parse(logRows[0]?.meta || '{}');
  assertEq(meta.reason, 'userbot_unavailable', 'logged skipped');
} finally {
  globalThis.fetch = origFetch;
  _resetHealthCacheForTests();
}

// --- T7: isReturningCustomer aligns with enrichment SQL ---
console.log('\n=== T7: isReturningCustomer excludes current order ===');
resetDb();
{
  const customerId = 'c_align';
  db.prepare(
    `INSERT INTO customers (id, telegram_id, first_name) VALUES (?, ?, ?)`,
  ).run(customerId, '777', 'Align');
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status) VALUES (?, ?, ?, ?)`,
  ).run('o_only', 1003, customerId, 'new');
  assertEq(isReturningCustomer(customerId, { excludeOrderId: 'o_only' }), false, 'нет prior → false');
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status) VALUES (?, ?, ?, ?)`,
  ).run('o_delivered', 1004, customerId, 'delivered');
  assertEq(isReturningCustomer(customerId, { excludeOrderId: 'o_only' }), true, 'есть prior → true');
}

// --- T8: not verified returning → skip ---
console.log('\n=== T8: returning but not verified → customer_not_verified ===');
resetDb();
{
  const customerId = 'c_unverified';
  db.prepare(
    `INSERT INTO customers (id, telegram_id, telegram_username, first_name, total_orders)
     VALUES (?, ?, ?, ?, 0)`,
  ).run(customerId, '888', 'unverified', 'Без верификации');
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status, total_amount, final_amount)
     VALUES (?, ?, ?, 'delivered', 50, 50)`,
  ).run('o_prior_uv', 8001, customerId);
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status, total_amount, final_amount)
     VALUES (?, ?, ?, 'new', 100, 100)`,
  ).run('o_new_uv', 1005, customerId);
  globalThis.fetch = mockUserbotOk();
  try {
    const result = await autoNotifyOrderAccepted({ orderId: 'o_new_uv' });
    assertEq(result.reason, 'customer_not_verified', 'not verified');
  } finally {
    globalThis.fetch = origFetch;
    _resetHealthCacheForTests();
  }
}

// --- T9: retry after userbot_unavailable — skip log не блокирует ---
console.log('\n=== T9: retry after userbot_unavailable → second call sends ===');
resetDb();
makeReturningCustomer({ telegramId: '901' });
let t9SendCount = 0;
let t9HealthFailsLeft = 1;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/health')) {
    if (t9HealthFailsLeft > 0) {
      t9HealthFailsLeft -= 1;
      return { ok: false, status: 503, async json() { return {}; } };
    }
    return { ok: true, async json() { return { ok: true, connected: true }; } };
  }
  if (u.includes('/send-message')) {
    t9SendCount++;
    return { ok: true, async json() { return { ok: true, telegram_message_id: 901 }; } };
  }
  throw new Error(`unexpected ${u}`);
};
try {
  const first = await autoNotifyOrderAccepted({ orderId: 'o_new' });
  assertEq(first.reason, 'userbot_unavailable', 'first=userbot_unavailable');
  _resetHealthCacheForTests();
  const second = await autoNotifyOrderAccepted({ orderId: 'o_new' });
  assertEq(second.sent, true, 'retry sent=true');
  assertEq(t9SendCount, 1, 'один send после retry');
} finally {
  globalThis.fetch = origFetch;
  _resetHealthCacheForTests();
}

// --- T10: prior only cancelled → not returning ---
console.log('\n=== T10: prior cancelled only → new_customer_no_dialog ===');
resetDb();
{
  const customerId = 'c_cancel_only';
  db.prepare(
    `INSERT INTO customers (id, telegram_id, telegram_username, first_name, bot_verified_at)
     VALUES (?, ?, ?, ?, DATETIME('now'))`,
  ).run(customerId, '902', 'cancel_only', 'Отменённый');
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status, total_amount, final_amount)
     VALUES (?, ?, ?, 'cancelled', 50, 50)`,
  ).run('o_cancel_prior', 8002, customerId);
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status, total_amount, final_amount)
     VALUES (?, ?, ?, 'new', 100, 100)`,
  ).run('o_cancel_new', 1006, customerId);
  let t10Hits = 0;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/health')) {
      return { ok: true, async json() { return { ok: true, connected: true }; } };
    }
    if (u.includes('/send-message')) {
      t10Hits++;
      throw new Error('must not send');
    }
    throw new Error(`unexpected ${u}`);
  };
  try {
    const result = await autoNotifyOrderAccepted({ orderId: 'o_cancel_new' });
    assertEq(result.reason, 'new_customer_no_dialog', 'cancelled prior не считается');
    assertEq(t10Hits, 0, 'send не вызывался');
  } finally {
    globalThis.fetch = origFetch;
    _resetHealthCacheForTests();
  }
}

// --- T11: prior completed (not delivered) → returning ---
console.log('\n=== T11: prior completed → sent ===');
resetDb();
{
  const customerId = 'c_completed';
  db.prepare(
    `INSERT INTO customers (id, telegram_id, telegram_username, first_name, bot_verified_at)
     VALUES (?, ?, ?, ?, DATETIME('now'))`,
  ).run(customerId, '903', 'completed_user', 'Завершён');
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status, total_amount, final_amount)
     VALUES (?, ?, ?, 'completed', 50, 50)`,
  ).run('o_comp_prior', 8003, customerId);
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status, total_amount, final_amount)
     VALUES (?, ?, ?, 'new', 100, 100)`,
  ).run('o_comp_new', 1007, customerId);
  globalThis.fetch = mockUserbotOk();
  try {
    const result = await autoNotifyOrderAccepted({ orderId: 'o_comp_new' });
    assertEq(result.sent, true, 'completed prior → sent');
  } finally {
    globalThis.fetch = origFetch;
    _resetHealthCacheForTests();
  }
}

// --- T12: missing order / empty orderId / no customer ---
console.log('\n=== T12: invalid orderId inputs ===');
resetDb();
{
  const empty = await autoNotifyOrderAccepted({ orderId: '' });
  assertEq(empty.reason, 'order_id_required', 'пустой orderId');
  const missing = await autoNotifyOrderAccepted({ orderId: 'ghost_order' });
  assertEq(missing.reason, 'order_not_found', 'несуществующий заказ');
  db.prepare(
    `INSERT INTO orders (id, order_number, status, total_amount, final_amount)
     VALUES ('o_anon', 1008, 'new', 50, 50)`,
  ).run();
  const noCustomer = await autoNotifyOrderAccepted({ orderId: 'o_anon' });
  assertEq(noCustomer.reason, 'order_has_no_customer', 'заказ без customer_id');
}

// --- T13: template empty body ---
console.log('\n=== T13: template empty body → template_empty ===');
resetDb();
makeReturningCustomer({ telegramId: '904' });
upsertStatusTemplate('order_accepted', { title: 'X', body: '   ', is_active: 1 });
try {
  const result = await autoNotifyOrderAccepted({ orderId: 'o_new' });
  assertEq(result.reason, 'template_empty', 'template_empty');
} finally {
  _resetHealthCacheForTests();
}

// --- T14: expired block → still sends ---
console.log('\n=== T14: expired block_until → send proceeds ===');
resetDb();
const expiredBlock = makeReturningCustomer({ telegramId: '905' });
db.prepare(
  `INSERT INTO customer_blocks (id, customer_id, block_until, reason, active)
   VALUES (?, ?, DATETIME('now', '-1 day'), ?, 1)`,
).run('blk_exp', expiredBlock.customerId, 'expired');
globalThis.fetch = mockUserbotOk();
try {
  const result = await autoNotifyOrderAccepted({ orderId: expiredBlock.orderId });
  assertEq(result.sent, true, 'истёкший блок не мешает');
} finally {
  globalThis.fetch = origFetch;
  _resetHealthCacheForTests();
}

// --- T15: concurrent double invoke → один send ---
console.log('\n=== T15: concurrent Promise.all → один send ===');
resetDb();
makeReturningCustomer({ telegramId: '906' });
let t15SendCount = 0;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('/health')) {
    return { ok: true, async json() { return { ok: true, connected: true }; } };
  }
  if (u.includes('/send-message')) {
    t15SendCount++;
    await new Promise((r) => setTimeout(r, 30));
    return { ok: true, async json() { return { ok: true, telegram_message_id: 906 }; } };
  }
  throw new Error(`unexpected ${u}`);
};
try {
  const [a, b] = await Promise.all([
    autoNotifyOrderAccepted({ orderId: 'o_new' }),
    autoNotifyOrderAccepted({ orderId: 'o_new' }),
  ]);
  const sentCount = [a, b].filter((r) => r.sent).length;
  const alreadyCount = [a, b].filter((r) => r.reason === 'already_sent').length;
  assertEq(sentCount, 1, 'ровно один sent');
  assertEq(alreadyCount, 1, 'второй already_sent');
  assertEq(t15SendCount, 1, 'один фактический send');
} finally {
  globalThis.fetch = origFetch;
  _resetHealthCacheForTests();
}

// --- T16: order_accepted + order_assembled — оба уходят ---
console.log('\n=== T16: order_accepted then order_assembled — independent ===');
resetDb();
makeReturningCustomer({ telegramId: '907' });
upsertStatusTemplate('order_assembled', {
  title: 'Собран',
  body: 'Заказ {order_number} собран.',
  is_active: 1,
});
let t16Events = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('/health')) {
    return { ok: true, async json() { return { ok: true, connected: true }; } };
  }
  if (u.includes('/send-message')) {
    const body = JSON.parse(init.body);
    t16Events.push(body.text?.includes('принят') ? 'accepted' : 'assembled');
    return { ok: true, async json() { return { ok: true, telegram_message_id: 907 }; } };
  }
  throw new Error(`unexpected ${u}`);
};
try {
  const accepted = await autoNotifyOrderAccepted({ orderId: 'o_new' });
  assertEq(accepted.sent, true, 'order_accepted sent');
  db.prepare(`UPDATE orders SET status = 'in_progress' WHERE id = 'o_new'`).run();
  const assembled = await autoNotifyForStatusChange({
    orderId: 'o_new',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(assembled.sent, true, 'order_assembled sent');
  assertEq(t16Events, ['accepted', 'assembled'], 'два разных сообщения');
} finally {
  globalThis.fetch = origFetch;
  _resetHealthCacheForTests();
}

// --- R1: migration seed INSERT OR IGNORE ---
console.log('\n=== R1: migrateOrderAcceptedTemplate seeds order_accepted ===');
resetDb();
db.prepare(`DELETE FROM bot_status_templates WHERE event = 'order_accepted'`).run();
migrateOrderAcceptedTemplate();
const seeded = db
  .prepare(`SELECT event, is_active, body FROM bot_status_templates WHERE event = 'order_accepted'`)
  .get();
assertEq(seeded?.event, 'order_accepted', 'event seeded');
assertEq(seeded?.is_active, 1, 'is_active=1');
assert(seeded?.body?.includes('{order_number}'), 'body содержит плейсхолдер');
const bodyBefore = seeded.body;
migrateOrderAcceptedTemplate();
const afterSecond = db
  .prepare(`SELECT body FROM bot_status_templates WHERE event = 'order_accepted'`)
  .get();
assertEq(afterSecond.body, bodyBefore, 'повторная миграция не перезаписывает');

// --- R2: enrichOrdersWithRelations — failed badge на skip log ---
console.log('\n=== R2: enrichOrdersWithRelations shows failed for skip log ===');
resetDb();
const enrichCase = makeReturningCustomer({ telegramId: '908' });
db.prepare(
  `INSERT INTO bot_message_log (chat_id, direction, message_type, template_kind, template_event, meta)
   VALUES (?, 'out', 'status', 'status', 'order_accepted', ?)`,
).run(
  enrichCase.telegramId,
  JSON.stringify({
    order_id: enrichCase.orderId,
    auto: 1,
    outcome: 'skipped',
    reason: 'userbot_unavailable',
  }),
);
const orderRow = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(enrichCase.orderId);
const enriched = enrichOrdersWithRelations(db, [orderRow]);
assertEq(enriched[0]?.auto_notification?.status, 'failed', 'status=failed');
assertEq(enriched[0]?.auto_notification?.error, 'userbot_unavailable', 'error из reason');
assertEq(enriched[0]?.is_returning_customer, true, 'returning badge');

console.log(`\n=== Total: ${results.passed} passed, ${results.failed} failed ===`);

try { db.close(); } catch {}
for (const p of [TMP_DB, `${TMP_DB}-shm`, `${TMP_DB}-wal`]) {
  try { fs.unlinkSync(p); } catch {}
}

if (results.failed > 0) {
  process.exitCode = 1;
}