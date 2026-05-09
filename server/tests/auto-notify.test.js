/**
 * Auto-notify util — авто-отправка статусных уведомлений при смене статуса
 * заказа. Покрывает все skip-причины (reactivate, no telegram_id, не верифицирован,
 * шаблон выключен, шаблон с пустым телом, нет коннекта) и happy path
 * (через mock global.fetch).
 *
 * Запуск: node server/tests/auto-notify.test.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TMP_DB = path.resolve(__dirname, `./.tmp-auto-notify-${Date.now()}.db`);
process.env.DATABASE_FILE = TMP_DB;
process.env.BOT_TOKEN = 'test-token-1234567890';

const { db, initDb } = await import('../db.js');
initDb();

const {
  registerBusinessConnection,
  upsertStatusTemplate,
} = await import('../utils/business-bot.js');

const { autoNotifyForStatusChange, STATUS_TO_EVENT } = await import('../utils/auto-notify.js');

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
  db.exec(`DELETE FROM business_connections;`);
  db.exec(`DELETE FROM customers;`);
  db.exec(`DELETE FROM order_items;`);
  db.exec(`DELETE FROM orders;`);
  // Шаблоны статусов восстанавливаем дефолтные (миграция при initDb их кладёт).
  upsertStatusTemplate('order_assembled', {
    title: 'Заказ собран',
    body: 'Заказ {order_number} собран. {customer_name}, можно забирать.',
    is_active: 1,
  });
  upsertStatusTemplate('order_issued', {
    title: 'Заказ выдан',
    body: 'Заказ {order_number} выдан. Спасибо за покупку!',
    is_active: 1,
  });
  upsertStatusTemplate('order_cancelled', {
    title: 'Заказ отменён',
    body: 'Заказ {order_number} отменён.',
    is_active: 1,
  });
}

function makeOrderAndCustomer({ telegramId = '111', verified = true, totalOrders = 0 } = {}) {
  const customerId = 'c_test';
  db.prepare(
    `INSERT INTO customers (id, telegram_id, telegram_username, first_name, total_orders)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(customerId, telegramId, 'tester', 'Тест', totalOrders);
  if (verified) {
    db.prepare(`UPDATE customers SET bot_verified_at = DATETIME('now') WHERE id = ?`).run(customerId);
  }
  const orderId = 'o_test';
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status, total_amount)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(orderId, 1001, customerId, 'new', 100);
  return { orderId, customerId };
}

function registerConnection() {
  registerBusinessConnection({
    id: 'conn1',
    userId: '999',
    userChatId: '999',
    username: 'manager',
    isEnabled: 1,
    canReply: 1,
  });
}

// --- TEST 1: STATUS_TO_EVENT mapping ----------------------------------------
console.log('\n=== Test 1: STATUS_TO_EVENT mapping ===');
assertEq(STATUS_TO_EVENT.in_progress, 'order_assembled', 'in_progress → order_assembled');
assertEq(STATUS_TO_EVENT.completed, 'order_issued', 'completed → order_issued');
assertEq(STATUS_TO_EVENT.delivered, 'order_issued', 'delivered → order_issued');
assertEq(STATUS_TO_EVENT.cancelled, 'order_cancelled', 'cancelled → order_cancelled');
assertEq(STATUS_TO_EVENT.new, undefined, 'new → no event (молчим при создании)');

// --- TEST 2: reactivate → skipped -------------------------------------------
console.log('\n=== Test 2: reactivate=true → пропускаем ===');
resetDb();
makeOrderAndCustomer();
registerConnection();
{
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'cancelled',
    reactivate: true,
  });
  assertEq(result.sent, false, 'sent=false при реактивации');
  assertEq(result.skipped, true, 'skipped=true');
  assertEq(result.reason, 'reactivation_skipped', 'reason=reactivation_skipped');
}

// --- TEST 3: status_unchanged → skipped -------------------------------------
console.log('\n=== Test 3: previousStatus === newStatus → skip ===');
{
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'in_progress',
  });
  assertEq(result.skipped, true, 'skipped=true');
  assertEq(result.reason, 'status_unchanged', 'reason=status_unchanged');
}

// --- TEST 4: новый статус без event (например new) --------------------------
console.log('\n=== Test 4: статус без mapping (new) → skip ===');
{
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'new',
    previousStatus: 'in_progress',
  });
  assertEq(result.reason, 'no_event_for_status', 'reason=no_event_for_status');
}

// --- TEST 5: customer без telegram_id ---------------------------------------
console.log('\n=== Test 5: клиент без telegram_id → skip ===');
resetDb();
{
  db.prepare(
    `INSERT INTO customers (id, first_name, total_orders, bot_verified_at)
     VALUES (?, ?, ?, DATETIME('now'))`,
  ).run('c_no_tg', 'Без TG', 1);
  db.prepare(
    `INSERT INTO orders (id, order_number, customer_id, status)
     VALUES (?, ?, ?, ?)`,
  ).run('o_no_tg', 2002, 'c_no_tg', 'new');
  registerConnection();

  const result = await autoNotifyForStatusChange({
    orderId: 'o_no_tg',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.sent, false, 'sent=false');
  assertEq(result.reason, 'customer_has_no_telegram_id', 'reason=customer_has_no_telegram_id');
}

// --- TEST 6: customer не верифицирован --------------------------------------
console.log('\n=== Test 6: клиент не верифицирован → skip ===');
resetDb();
makeOrderAndCustomer({ telegramId: '222', verified: false, totalOrders: 0 });
registerConnection();
{
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.sent, false, 'sent=false');
  assertEq(result.reason, 'customer_not_verified', 'reason=customer_not_verified');
}

// --- TEST 7: шаблон выключен ------------------------------------------------
console.log('\n=== Test 7: шаблон события is_active=0 → skip ===');
resetDb();
makeOrderAndCustomer({ telegramId: '333', verified: true });
registerConnection();
upsertStatusTemplate('order_assembled', {
  title: 'Заказ собран',
  body: 'Заказ {order_number} собран.',
  is_active: 0,
});
{
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.reason, 'template_inactive_or_missing', 'reason=template_inactive_or_missing');
}

// --- TEST 8: нет активного коннекта ----------------------------------------
console.log('\n=== Test 8: business_connection отсутствует → skip ===');
resetDb();
makeOrderAndCustomer({ telegramId: '444', verified: true });
// Сознательно не регистрируем коннект.
{
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.reason, 'no_active_connection', 'reason=no_active_connection');
}

// --- TEST 9: happy path с мок-fetch ----------------------------------------
console.log('\n=== Test 9: happy path → fetch вызван, sent=true ===');
resetDb();
makeOrderAndCustomer({ telegramId: '555', verified: true });
registerConnection();

const originalFetch = globalThis.fetch;
const fetchCalls = [];
globalThis.fetch = async (url, init) => {
  fetchCalls.push({ url: String(url), init });
  return {
    ok: true,
    status: 200,
    async json() {
      return { ok: true, result: { message_id: 4242 } };
    },
  };
};
try {
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.sent, true, 'sent=true');
  assertEq(result.event, 'order_assembled', 'event=order_assembled');
  assertEq(result.telegram_message_id, 4242, 'telegram_message_id из ответа Telegram');
  assertEq(fetchCalls.length, 1, 'fetch вызван один раз');
  assert(fetchCalls[0].url.includes('/sendMessage'), 'POST на /sendMessage');
  const body = JSON.parse(fetchCalls[0].init.body);
  assertEq(body.chat_id, '555', 'chat_id = telegram_id клиента');
  assertEq(body.business_connection_id, 'conn1', 'business_connection_id из активного коннекта');
  assert(body.text.includes('1001'), 'текст содержит order_number');

  // Проверим, что в журнале появилась запись с meta.outcome=sent.
  const logRows = db.prepare(`SELECT * FROM bot_message_log ORDER BY id DESC LIMIT 1`).all();
  assertEq(logRows.length, 1, 'одна запись в bot_message_log');
  const meta = JSON.parse(logRows[0].meta || '{}');
  assertEq(meta.outcome, 'sent', 'meta.outcome=sent');
  assertEq(meta.auto, true, 'meta.auto=true');
  assertEq(meta.order_id, 'o_test', 'meta.order_id сохранён');
} finally {
  globalThis.fetch = originalFetch;
}

// --- TEST 10: Telegram отказал (5xx / business connection not found) -------
console.log('\n=== Test 10: Telegram отказал → sent=false, лог с outcome=failed ===');
resetDb();
makeOrderAndCustomer({ telegramId: '666', verified: true });
registerConnection();

globalThis.fetch = async () => ({
  ok: false,
  status: 400,
  async json() {
    return { ok: false, description: 'Bad Request: chat not found' };
  },
});
try {
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'cancelled',
    previousStatus: 'in_progress',
  });
  assertEq(result.sent, false, 'sent=false');
  assertEq(result.event, 'order_cancelled', 'event=order_cancelled');
  assert(result.reason && result.reason.includes('chat not found'), 'reason содержит описание ошибки');

  const logRows = db.prepare(`SELECT * FROM bot_message_log ORDER BY id DESC LIMIT 1`).all();
  const meta = JSON.parse(logRows[0].meta || '{}');
  assertEq(meta.outcome, 'failed', 'meta.outcome=failed');
  assert(meta.error, 'meta.error присутствует');
} finally {
  globalThis.fetch = originalFetch;
}

// --- TEST 11: completed → order_issued (не дублируется delivered) ----------
console.log('\n=== Test 11: completed → order_issued ===');
resetDb();
makeOrderAndCustomer({ telegramId: '777', verified: true });
registerConnection();

const completedFetchCalls = [];
globalThis.fetch = async (url, init) => {
  completedFetchCalls.push({ url: String(url), init });
  return {
    ok: true,
    status: 200,
    async json() {
      return { ok: true, result: { message_id: 99 } };
    },
  };
};
try {
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'completed',
    previousStatus: 'in_progress',
  });
  assertEq(result.sent, true, 'sent=true');
  assertEq(result.event, 'order_issued', 'event=order_issued (а не completed)');
  const body = JSON.parse(completedFetchCalls[0].init.body);
  assert(body.text.toLowerCase().includes('выдан') || body.text.toLowerCase().includes('спасибо'),
    'текст соответствует шаблону order_issued');
} finally {
  globalThis.fetch = originalFetch;
}

// --- TEST 12: шаблон с пустым body (is_active=1) → template_empty ----------
console.log('\n=== Test 12: шаблон активен, но body пустой → skip ===');
resetDb();
makeOrderAndCustomer({ telegramId: '888', verified: true });
registerConnection();
upsertStatusTemplate('order_assembled', {
  title: 'Заказ собран',
  body: '   ',
  is_active: 1,
});
{
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.sent, false, 'sent=false');
  assertEq(result.reason, 'template_empty', 'reason=template_empty');
  // Лог не должен записываться, если до Telegram не дошло.
  const logCount = db.prepare(`SELECT COUNT(*) AS n FROM bot_message_log`).get().n;
  assertEq(logCount, 0, 'bot_message_log пустой при skip до отправки');
}

// --- TEST 13: retry на сетевом таймауте → вторая попытка успешна ----------
console.log('\n=== Test 13: timeout на 1й попытке → retry → success ===');
resetDb();
makeOrderAndCustomer({ telegramId: '999', verified: true });
registerConnection();

let callCount = 0;
globalThis.fetch = async () => {
  callCount++;
  if (callCount === 1) {
    // Имитируем AbortSignal.timeout: настоящий timeout кидает DOMException.
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    throw err;
  }
  return {
    ok: true,
    status: 200,
    async json() {
      return { ok: true, result: { message_id: 7777 } };
    },
  };
};
try {
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.sent, true, 'после retry sent=true');
  assertEq(callCount, 2, 'fetch вызван дважды (один retry)');
  // attempts включается в результат sendBusinessMessage, но autoNotifyForStatusChange
  // его не пробрасывает — в журнале достаточно outcome=sent.
  const logRows = db.prepare(`SELECT meta FROM bot_message_log ORDER BY id DESC LIMIT 1`).all();
  const meta = JSON.parse(logRows[0].meta || '{}');
  assertEq(meta.outcome, 'sent', 'meta.outcome=sent после retry');
} finally {
  globalThis.fetch = originalFetch;
}

// --- TEST 14: permanent ошибка (PEER_ID_INVALID) → нет retry --------------
console.log('\n=== Test 14: HTTP 400 PEER_ID_INVALID → один вызов, без retry ===');
resetDb();
makeOrderAndCustomer({ telegramId: '101010', verified: true });
registerConnection();

let permanentCallCount = 0;
globalThis.fetch = async () => {
  permanentCallCount++;
  return {
    ok: false,
    status: 400,
    async json() {
      return { ok: false, description: 'Bad Request: PEER_ID_INVALID' };
    },
  };
};
try {
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.sent, false, 'sent=false');
  assertEq(permanentCallCount, 1, 'fetch вызван один раз (4xx не ретраится)');
  assert(result.reason && result.reason.includes('PEER_ID_INVALID'), 'reason содержит PEER_ID_INVALID');
} finally {
  globalThis.fetch = originalFetch;
}

// --- Final ------------------------------------------------------------------
console.log(`\n=== Total: ${results.passed} passed, ${results.failed} failed ===`);

// Чистим временный sqlite-файл (и -shm/-wal от WAL-режима), чтобы тест
// не оставлял мусор в server/tests/. Каждый unlink в try/catch: если файл
// не успел создаться (тест упал на initDb до записи WAL/SHM), не хотим,
// чтобы ENOENT затёр реальную ошибку из ассертов выше.
try { db.close(); } catch {}
for (const p of [TMP_DB, `${TMP_DB}-shm`, `${TMP_DB}-wal`]) {
  try { fs.unlinkSync(p); } catch {}
}

if (results.failed > 0) {
  process.exitCode = 1;
}
