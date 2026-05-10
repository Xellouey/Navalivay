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
console.log('\n=== Test 6: клиент не верифицирован → skip + лог skipped ===');
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
  // Дима 10.05.2026: «при любых ошибках должна быть рамка». Запись в журнал
  // нужна, чтобы плашка переживала рефреш админки (GET /orders подтягивает
  // последний auto-notify по meta.auto=1).
  const logRows = db.prepare(`SELECT meta FROM bot_message_log ORDER BY id DESC LIMIT 1`).all();
  assertEq(logRows.length, 1, 'запись skipped попала в bot_message_log');
  const meta = JSON.parse(logRows[0].meta || '{}');
  assertEq(meta.outcome, 'skipped', 'meta.outcome=skipped');
  assertEq(meta.reason, 'customer_not_verified', 'meta.reason=customer_not_verified');
  assertEq(meta.auto, true, 'meta.auto=true (auto-notify, не manual)');
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
console.log('\n=== Test 8: business_connection отсутствует → skip + лог skipped ===');
resetDb();
makeOrderAndCustomer({ telegramId: '444', verified: true });
// Сознательно не регистрируем коннект.
_resetHealthCacheForTests(); // userbot health-кэш мог быть прогретый предыдущим тестом
{
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.reason, 'no_active_connection', 'reason=no_active_connection');
  const logRows = db.prepare(`SELECT meta FROM bot_message_log ORDER BY id DESC LIMIT 1`).all();
  assertEq(logRows.length, 1, 'запись skipped попала в bot_message_log');
  const meta = JSON.parse(logRows[0].meta || '{}');
  assertEq(meta.outcome, 'skipped', 'meta.outcome=skipped');
  assertEq(meta.reason, 'no_active_connection', 'meta.reason=no_active_connection');
  assertEq(meta.auto, true, 'meta.auto=true');
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

// --- TEST 15: userbot OK → no business-mode fallback ----------------------
console.log('\n=== Test 15: userbot ответил ok=true → business mode не дёргается ===');
resetDb();
makeOrderAndCustomer({ telegramId: '15151', verified: true });
registerConnection();
// Тесты 9-14 ходили на 127.0.0.1:8083 без userbot — health-кэш сохранил
// ok=false на 10 секунд. Сбрасываем, иначе isUserbotAvailable() сразу
// вернёт false и весь mock /health окажется бесполезен.
_resetHealthCacheForTests();

let businessFetchCount = 0;
let userbotFetchCount = 0;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('127.0.0.1') && u.includes('/health')) {
    return { ok: true, async json() { return { ok: true, connected: true }; } };
  }
  if (u.includes('127.0.0.1') && u.includes('/send-message')) {
    userbotFetchCount++;
    return { ok: true, async json() { return { ok: true, telegram_message_id: 7777 }; } };
  }
  if (u.includes('api.telegram.org')) {
    businessFetchCount++;
    return { ok: true, async json() { return { ok: true, result: { message_id: 9999 } }; } };
  }
  throw new Error(`unexpected fetch ${u}`);
};
try {
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.sent, true, 'sent=true через userbot');
  assertEq(result.via, 'userbot', 'via=userbot');
  assertEq(result.telegram_message_id, 7777, 'telegram_message_id из userbot ответа');
  assertEq(userbotFetchCount, 1, 'userbot вызван один раз');
  assertEq(businessFetchCount, 0, 'business mode НЕ вызывался (нет дубля)');
} finally {
  globalThis.fetch = originalFetch;
  // Принудительно сбрасываем health-кэш userbot-client.js — он закэширует
  // mock-ответ /health=ok на 30с и испортит следующий тест.
  _resetHealthCacheForTests();
}

// --- TEST 16: userbot ambiguous → НЕТ fallback (защита от дубля) -----------
console.log('\n=== Test 16: userbot timeout → НЕТ fallback на business mode ===');
resetDb();
makeOrderAndCustomer({ telegramId: '16161', verified: true });
registerConnection();
_resetHealthCacheForTests();

let businessHits = 0;
let userbotHits = 0;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('127.0.0.1') && u.includes('/health')) {
    return { ok: true, async json() { return { ok: true, connected: true }; } };
  }
  if (u.includes('127.0.0.1') && u.includes('/send-message')) {
    userbotHits++;
    // Симулируем timeout (AbortError) — userbot мог отправить, ответ потерян.
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    throw err;
  }
  if (u.includes('api.telegram.org')) {
    businessHits++;
    return { ok: true, async json() { return { ok: true, result: { message_id: 1 } }; } };
  }
  throw new Error(`unexpected fetch ${u}`);
};
try {
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.sent, false, 'sent=false при ambiguous (мы не уверены)');
  assertEq(result.reason, 'userbot_ambiguous', 'reason=userbot_ambiguous');
  assertEq(userbotHits, 1, 'userbot попытка одна');
  assertEq(businessHits, 0, 'business mode НЕ вызвался — иначе дубль клиенту');
  // safeLog должен записать ambiguous в журнал для аудита.
  const logRows = db.prepare(`SELECT * FROM bot_message_log ORDER BY id DESC LIMIT 1`).all();
  const meta = JSON.parse(logRows[0]?.meta || '{}');
  assertEq(meta.outcome, 'ambiguous', 'meta.outcome=ambiguous');
  assertEq(meta.via, 'userbot', 'meta.via=userbot');
} finally {
  globalThis.fetch = originalFetch;
  _resetHealthCacheForTests();
}

// --- TEST 17: userbot unreachable → FALLBACK на business mode --------------
console.log('\n=== Test 17: userbot ECONNREFUSED → fallback на business mode ===');
resetDb();
makeOrderAndCustomer({ telegramId: '17171', verified: true });
registerConnection();
_resetHealthCacheForTests();

let businessHits2 = 0;
let userbotHits2 = 0;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('127.0.0.1') && u.includes('/health')) {
    // /health сам провалится — это симулирует «процесса нет вообще».
    const err = new TypeError('fetch failed');
    err.cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8083'), {
      code: 'ECONNREFUSED',
    });
    throw err;
  }
  if (u.includes('127.0.0.1') && u.includes('/send-message')) {
    userbotHits2++;
    const err = new TypeError('fetch failed');
    err.cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8083'), {
      code: 'ECONNREFUSED',
    });
    throw err;
  }
  if (u.includes('api.telegram.org')) {
    businessHits2++;
    return { ok: true, async json() { return { ok: true, result: { message_id: 5555 } }; } };
  }
  throw new Error(`unexpected fetch ${u}`);
};
try {
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.sent, true, 'sent=true через business mode после fallback');
  assertEq(result.via, 'business_mode', 'via=business_mode');
  // userbot не должен был вызваться — health=fail, isUserbotAvailable=false.
  assertEq(userbotHits2, 0, 'userbot send не дёрнулся (health=fail)');
  assertEq(businessHits2, 1, 'business mode дёрнулся');
} finally {
  globalThis.fetch = originalFetch;
  _resetHealthCacheForTests();
}

// --- TEST 18: userbot rejected (HTTP 200 + ok:false) → FALLBACK на business -
console.log('\n=== Test 18: userbot ответил {ok:false} → fallback на business mode ===');
resetDb();
makeOrderAndCustomer({ telegramId: '18181', verified: true });
registerConnection();
_resetHealthCacheForTests();

let businessHits3 = 0;
let userbotHits3 = 0;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('127.0.0.1') && u.includes('/health')) {
    return { ok: true, async json() { return { ok: true, connected: true }; } };
  }
  if (u.includes('127.0.0.1') && u.includes('/send-message')) {
    userbotHits3++;
    // userbot жив, но конкретно эта отправка отказана — например, Telegram
    // вернул PEER_ID_INVALID. Это безопасно фоллбэкнуть, потому что userbot
    // гарантированно НЕ отправил (он сам же ответил отказом).
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: false, error: 'PEER_ID_INVALID' };
      },
    };
  }
  if (u.includes('api.telegram.org')) {
    businessHits3++;
    return { ok: true, async json() { return { ok: true, result: { message_id: 18180 } }; } };
  }
  throw new Error(`unexpected fetch ${u}`);
};
try {
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.sent, true, 'sent=true через business mode после rejected');
  assertEq(result.via, 'business_mode', 'via=business_mode');
  assertEq(userbotHits3, 1, 'userbot отправка попыталась один раз');
  assertEq(businessHits3, 1, 'business mode дёрнулся (rejected → fallback безопасен)');
} finally {
  globalThis.fetch = originalFetch;
  _resetHealthCacheForTests();
}

// --- TEST 19: userbot HTTP 5xx → FALLBACK на business mode -----------------
console.log('\n=== Test 19: userbot HTTP 502 → fallback на business mode ===');
resetDb();
makeOrderAndCustomer({ telegramId: '19191', verified: true });
registerConnection();
_resetHealthCacheForTests();

let businessHits4 = 0;
let userbotHits4 = 0;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('127.0.0.1') && u.includes('/health')) {
    return { ok: true, async json() { return { ok: true, connected: true }; } };
  }
  if (u.includes('127.0.0.1') && u.includes('/send-message')) {
    userbotHits4++;
    return {
      ok: false,
      status: 502,
      async json() {
        return { ok: false, error: 'bad_gateway' };
      },
    };
  }
  if (u.includes('api.telegram.org')) {
    businessHits4++;
    return { ok: true, async json() { return { ok: true, result: { message_id: 19190 } }; } };
  }
  throw new Error(`unexpected fetch ${u}`);
};
try {
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  // HTTP 502 = userbot ответил → server жив, но обработчик упал. Контракт
  // userbot-client.js говорит outcome='rejected' → fallback безопасен.
  assertEq(result.sent, true, 'sent=true через business mode после HTTP 502');
  assertEq(result.via, 'business_mode', 'via=business_mode');
  assertEq(userbotHits4, 1, 'userbot отправка попыталась один раз');
  assertEq(businessHits4, 1, 'business mode дёрнулся (HTTP 5xx = rejected → fallback)');
} finally {
  globalThis.fetch = originalFetch;
  _resetHealthCacheForTests();
}

// --- TEST 20: userbot не доступен (health=false), нет fallback fallback'а -
// Защита от регрессии: если userbot недоступен И business mode тоже падает —
// результат должен корректно отработать (не throw, sent=false).
console.log('\n=== Test 20: userbot health=false + business mode 400 → sent=false ===');
resetDb();
makeOrderAndCustomer({ telegramId: '20202', verified: true });
registerConnection();
_resetHealthCacheForTests();

let businessHits5 = 0;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('127.0.0.1') && u.includes('/health')) {
    return { ok: false, status: 503, async json() { return {}; } };
  }
  if (u.includes('api.telegram.org')) {
    businessHits5++;
    return {
      ok: false,
      status: 400,
      async json() {
        return { ok: false, description: 'Bad Request: chat not found' };
      },
    };
  }
  throw new Error(`unexpected fetch ${u}`);
};
try {
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.sent, false, 'sent=false (оба канала упали)');
  assert(result.reason && result.reason.includes('chat not found'),
    'reason содержит описание ошибки business mode');
  assertEq(businessHits5, 1, 'business mode попытался ровно раз');
} finally {
  globalThis.fetch = originalFetch;
  _resetHealthCacheForTests();
}

// --- TEST 21: userbot success → не записывает дубль через safeLog ----------
// Регрессия: userbot/index.js сам логирует исходящее в bot_message_log
// (с meta.source='userbot', meta.outcome='sent'). Auto-notify в случае
// userbot.ok НЕ должен дублировать запись через safeLog.
console.log('\n=== Test 21: userbot success → auto-notify не дублирует лог ===');
resetDb();
makeOrderAndCustomer({ telegramId: '21212', verified: true });
registerConnection();
_resetHealthCacheForTests();

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('127.0.0.1') && u.includes('/health')) {
    return { ok: true, async json() { return { ok: true, connected: true }; } };
  }
  if (u.includes('127.0.0.1') && u.includes('/send-message')) {
    return { ok: true, async json() { return { ok: true, telegram_message_id: 21210 }; } };
  }
  throw new Error(`unexpected fetch ${u}`);
};
try {
  const before = db.prepare(`SELECT COUNT(*) AS n FROM bot_message_log`).get().n;
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.sent, true, 'sent=true');
  assertEq(result.via, 'userbot', 'via=userbot');
  const after = db.prepare(`SELECT COUNT(*) AS n FROM bot_message_log`).get().n;
  // Userbot HTTP-процесс пишет лог сам; auto-notify через mock-fetch
  // его не пишет (это другой процесс). Поэтому в auto-notify добавляться
  // не должно — иначе будет дубль когда оба процесса живы.
  assertEq(after, before, 'auto-notify не записал дубль (userbot пишет сам)');
} finally {
  globalThis.fetch = originalFetch;
  _resetHealthCacheForTests();
}

// --- TEST 22: client_inactive_over_24h → лог skipped с business connection -
// Если в bot_message_log уже есть хоть одна 'in' запись от клиента (он когда-то
// писал боту), но за последние 23 часа активности нет — Telegram Business не
// разрешит ответить (BUSINESS_PEER_USAGE_MISSING). Пропускаем до Telegram'а
// и логируем skipped с businessConnectionId, чтобы рамка осталась после рефреша.
console.log('\n=== Test 22: 24h окно истекло → skip + лог skipped ===');
resetDb();
makeOrderAndCustomer({ telegramId: '22222', verified: true });
registerConnection();
_resetHealthCacheForTests();
// Старая входящая запись (24h+ назад) — есть прошлый диалог, но окно истекло.
db.prepare(
  `INSERT INTO bot_message_log
     (business_connection_id, chat_id, customer_id, customer_telegram_id,
      direction, message_type, text, meta, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run('conn1', '22222', 'c_test', '22222', 'in', 'incoming', 'привет', '{}', '2020-01-01 00:00:00');

// userbot должен быть «недоступен», чтобы код пошёл в business mode (там
// проверка 24h-окна и лежит). Mock health=fail.
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('127.0.0.1') && u.includes('/health')) {
    return { ok: false, status: 503, async json() { return {}; } };
  }
  throw new Error(`unexpected fetch ${u} (Telegram не должен дёрнуться)`);
};
try {
  const result = await autoNotifyForStatusChange({
    orderId: 'o_test',
    newStatus: 'in_progress',
    previousStatus: 'new',
  });
  assertEq(result.sent, false, 'sent=false');
  assertEq(result.reason, 'client_inactive_over_24h', 'reason=client_inactive_over_24h');
  // В журнале две записи: исходный 'in' (мы вставили выше) + наш skipped 'out'.
  const skippedRow = db
    .prepare(`SELECT * FROM bot_message_log WHERE direction='out' ORDER BY id DESC LIMIT 1`)
    .get();
  assert(skippedRow, 'skipped запись существует');
  const meta = JSON.parse(skippedRow.meta || '{}');
  assertEq(meta.outcome, 'skipped', 'meta.outcome=skipped');
  assertEq(meta.reason, 'client_inactive_over_24h', 'meta.reason=client_inactive_over_24h');
  assertEq(meta.auto, true, 'meta.auto=true');
  // Привязка к business connection — попытка планировалась через business mode.
  assertEq(skippedRow.business_connection_id, 'conn1', 'business_connection_id=conn1');
} finally {
  globalThis.fetch = originalFetch;
  _resetHealthCacheForTests();
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
