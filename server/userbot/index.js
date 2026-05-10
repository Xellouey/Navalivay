/**
 * Userbot main process. Запускается через PM2 как `navalivay-userbot`.
 *
 * Делает три вещи:
 *   1. Подключается к Telegram через MTProto со стороны аккаунта менеджера
 *      (StringSession из data/userbot.session).
 *   2. Слушает входящие сообщения (NewMessage event) от клиентов и
 *      логирует их в bot_message_log direction='in' — это даёт точную
 *      картину «кто из клиентов активен», что использует pre-check
 *      24-часового окна для Business mode (там это всё ещё нужно как
 *      fallback, если userbot вдруг недоступен).
 *   3. Поднимает локальный HTTP API (127.0.0.1:8083) для приёма команд
 *      от api-процесса: «отправь сообщение этому chat_id». api зовёт его
 *      через server/utils/userbot-client.js при смене статуса заказа.
 *
 * Безопасность:
 *   - HTTP API слушает строго на 127.0.0.1 — никого с интернета не пускает.
 *   - Доп. защита: shared secret в заголовке X-Userbot-Secret (env).
 *
 * Failure mode:
 *   - Если процесс упал — api-process, не получив ответ за таймаут,
 *     фоллбэкается на Business mode (старый путь). Сообщение всё равно
 *     попробует уйти.
 */
import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import { NewMessage } from 'telegram/events/index.js';
import { createClient, loadSavedSession, redactSecrets } from './client.js';
import { createRateLimiter } from './rate-limiter.js';
import { db } from '../db.js';

const PORT = Number(process.env.USERBOT_HTTP_PORT || 8083);
const SHARED_SECRET = (process.env.USERBOT_SECRET || '').trim();
const IS_PRODUCTION = (process.env.NODE_ENV || '').toLowerCase() === 'production';

// Defense-in-depth: на проде требуем USERBOT_SECRET. На localhost-only listen
// риск всё равно низкий, но если кто-то получит локальный RCE на api или
// произойдёт SSRF-подобная атака изнутри сервера, секрет — единственная
// преграда между "пишет в Telegram от лица менеджера" и "не пишет".
if (IS_PRODUCTION && !SHARED_SECRET) {
  console.error(
    '[userbot] USERBOT_SECRET не задан в production — обязателен. ' +
      'Сгенерируй: `openssl rand -hex 32` и положи в server/.env',
  );
  process.exit(1);
}

// Лимит безопасности: не больше N исходящих в секунду, чтобы не словить
// FloodWait от Telegram и не привлекать внимания anti-spam систем.
const MAX_SENDS_PER_SECOND = 1;

const sessionString = loadSavedSession();
if (!sessionString) {
  console.error(
    '[userbot] файл сессии пустой — сначала запусти `node server/userbot/login.js` ' +
      'и пройди SMS-авторизацию.',
  );
  process.exit(1);
}

const client = createClient(sessionString);
let myUserId = null;

await client.connect();
const me = await client.getMe();
myUserId = String(me?.id);
console.log(`[userbot] подключён как @${me?.username || me?.firstName} (id=${myUserId})`);

// ---------------------------------------------------------------------------
// Кэшированные prepared statements: better-sqlite3 кэширует внутри по строке
// SQL, но создание Statement-объекта стоит ~0.1ms на каждый вызов prepare.
// При burst 100 входящих/сек это заметная нагрузка → ловим один раз на старте.
// ---------------------------------------------------------------------------
const stmtFindCustomer = db.prepare(`SELECT id FROM customers WHERE telegram_id = ?`);
const stmtInsertLog = db.prepare(
  `INSERT INTO bot_message_log
     (business_connection_id, chat_id, customer_id, customer_telegram_id,
      direction, message_type, text, meta, created_at)
   VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'))`,
);

// ---------------------------------------------------------------------------
// Слушаем входящие сообщения и логируем активность клиентов в БД.
// ---------------------------------------------------------------------------
client.addEventHandler((event) => {
  try {
    const message = event.message;
    if (!message || !message.peerId) return;
    // Интересуют только private chats (пользователи), не каналы и не группы.
    const peerUserId = message.peerId?.userId;
    if (!peerUserId) return;
    const chatId = String(peerUserId);

    // out = сообщение от менеджера клиенту, in = от клиента менеджеру.
    const direction = message.out ? 'out' : 'in';
    // Сравнение через String(): myUserId уже строка (см. инициализацию выше),
    // senderId от GramJS приходит BigInt — без обёртки `===` всегда false и
    // эхо нашего же userbot-сообщения залогируется как «входящее».
    const senderId = message.senderId ? String(message.senderId) : null;
    if (direction === 'out' && senderId === myUserId) return;

    // Выполняем БД-вставку через setImmediate, чтобы не блокировать
    // GramJS event loop при бурстах (better-sqlite3 синхронный → каждый
    // INSERT держит loop ~0.5ms; 100 messages/sec = 50ms простоя).
    setImmediate(() => {
      try {
        const customer = stmtFindCustomer.get(chatId);
        stmtInsertLog.run(
          chatId,
          customer?.id || null,
          chatId,
          direction,
          direction === 'in' ? 'incoming' : 'manual',
          message.message || null,
          JSON.stringify({ source: 'userbot', telegram_message_id: message.id }),
        );
      } catch (err) {
        console.error('[userbot] ошибка записи в журнал:', redactSecrets(err?.message || err));
      }
    });
  } catch (err) {
    console.error('[userbot] ошибка обработки события:', redactSecrets(err?.message || err));
  }
}, new NewMessage({}));

// ---------------------------------------------------------------------------
// Локальный HTTP API: принимает команды от api-процесса.
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '64kb' }));

// Constant-time сравнение секрета (защита от timing-side-channel,
// малореалистично на localhost, но дёшево).
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function checkSecret(req, res, next) {
  if (!SHARED_SECRET) return next(); // dev-режим: на localhost секрет опционален
  const got = req.header('X-Userbot-Secret') || '';
  if (!safeEqual(got, SHARED_SECRET)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

// Rate-limiter: гарантирует строгую очередь даже при N параллельных запросах.
// Реализация — в server/userbot/rate-limiter.js (там же подробный комментарий
// про race до фикса). Извлекли в отдельный файл, чтобы покрыть юнит-тестами
// без поднятия реального MTProto/HTTP — импорт index.js стартует процесс.
const rateLimitedDelay = createRateLimiter({ maxPerSecond: MAX_SENDS_PER_SECOND });

// Когда Telegram отзывает сессию (менеджер сделал «Завершить другие сеансы»
// в Настройках Telegram), GramJS продолжает держать TCP/MTProto-соединение,
// и `client.connected` возвращает true. Но каждый sendMessage будет падать
// с AUTH_KEY_UNREGISTERED. Для api-процесса это выглядит как «health=ok,
// но send всегда падает» → каждый PATCH делает userbot-попытку → таймаут
// → fallback. Шум в логах + лишние 1-3 сек на каждом PATCH.
//
// Защита: при первой AUTH_KEY_UNREGISTERED-ошибке выставляем sessionDead
// и /health начинает возвращать ok=false. Кэш health в userbot-client.js
// быстро это подхватит и api перестанет дёргать userbot до перезапуска
// процесса с новой сессией.
let sessionDead = false;
let sessionDeadReason = null;

const SESSION_DEAD_PATTERNS = [
  /AUTH_KEY_UNREGISTERED/i,
  /AUTH_KEY_DUPLICATED/i,
  /SESSION_REVOKED/i,
  /SESSION_EXPIRED/i,
  /USER_DEACTIVATED/i,
];
function looksLikeSessionDead(errorText) {
  if (!errorText) return false;
  const s = String(errorText);
  return SESSION_DEAD_PATTERNS.some((rx) => rx.test(s));
}

app.get('/health', (req, res) => {
  res.json({
    ok: !sessionDead,
    me: myUserId,
    connected: client.connected && !sessionDead,
    session_dead: sessionDead || undefined,
    session_dead_reason: sessionDeadReason || undefined,
  });
});

// Валидация chat_id: только положительный целый числовой Telegram user ID.
// Defense-in-depth от вектора, когда кто-то с локальным RCE на api-процесс
// пытается через userbot HTTP отправить сообщение в канал/группу или в
// диалог с самим собой через подмену chat_id. Userbot предназначен только
// для общения с клиентами — это всегда положительный user_id.
//
// Telegram user IDs — целые до ~2^41 (документация Telegram), укладываются
// в обычный Number, но из-за будущего расширения принимаем строкой и
// конвертируем в BigInt только после проверки формата.
function parseUserChatId(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!/^[1-9]\d{0,18}$/.test(s)) return null; // только положительные, без ведущих нулей
  return s;
}

// Лимит длины: Telegram режет на 4096, если прислать больше — ошибка
// MESSAGE_TOO_LONG. Отрезать самим, чтобы не тратить попытку.
const MAX_TEXT_LEN = 4096;

// FloodWait state: Telegram возвращает FLOOD_WAIT_X (X секунд) при превышении
// rate-limit. GramJS бросает err с .seconds. До истечения окна fast-fail
// все запросы — иначе Telegram эскалирует и может забанить аккаунт.
let floodWaitUntil = 0; // ms timestamp

app.post('/send-message', checkSecret, async (req, res) => {
  try {
    const chatId = parseUserChatId(req.body?.chat_id);
    const text = String(req.body?.text || '').trim();
    if (!chatId || !text) {
      return res.status(400).json({ ok: false, error: 'chat_id_and_text_required' });
    }
    if (text.length > MAX_TEXT_LEN) {
      return res.status(400).json({ ok: false, error: 'text_too_long' });
    }
    // Активный FloodWait — не дёргаем Telegram. auto-notify по 429 пометит
    // как unreachable и пойдёт в business-mode fallback.
    if (floodWaitUntil > Date.now()) {
      const retryAfter = Math.ceil((floodWaitUntil - Date.now()) / 1000);
      return res.status(429).json({
        ok: false,
        error: 'flood_wait',
        retry_after_seconds: retryAfter,
      });
    }
    // MTProto-соединение могло порваться (proxy down, DC switch). GramJS
    // делает autoReconnect, но в окне реконнекта sendMessage может зависнуть
    // или выпасть с ошибкой. Лучше fast-fail с 503 — auto-notify пойдёт в
    // business-mode (там может пройти) либо будет видно «не дошло» в UI.
    if (!client.connected) {
      return res.status(503).json({ ok: false, error: 'disconnected' });
    }
    await rateLimitedDelay();

    const result = await client.sendMessage(BigInt(chatId), { message: text });
    const messageId = result?.id ? Number(result.id) : null;

    // Отвечаем сразу, журналим асинхронно через setImmediate — caller
    // не ждёт INSERT, освобождаем event loop для следующего запроса.
    res.json({ ok: true, telegram_message_id: messageId });
    setImmediate(() => {
      try {
        const customer = stmtFindCustomer.get(String(chatId));
        stmtInsertLog.run(
          String(chatId),
          customer?.id || null,
          String(chatId),
          'out',
          'manual',
          text,
          JSON.stringify({
            source: 'userbot',
            outcome: 'sent',
            telegram_message_id: messageId,
            order_id: req.body?.order_id || null,
          }),
        );
      } catch (logErr) {
        console.error('[userbot] failed to log success:', logErr?.message);
      }
    });
    return;
  } catch (err) {
    const rawError = err?.errorMessage || err?.message || String(err);
    const errorText = redactSecrets(rawError);
    console.error('[userbot] sendMessage error:', errorText);

    // Detect FloodWait: Telegram анти-спам. Семантика разная у GramJS-
    // версий, ловим оба варианта (err.seconds или строка FLOOD_WAIT_N).
    let floodWaitSec = 0;
    if (typeof err?.seconds === 'number' && err.seconds > 0) {
      floodWaitSec = err.seconds;
    } else {
      const m = rawError.match(/FLOOD(?:_WAIT)?[_\s]+(\d+)/i);
      if (m) floodWaitSec = Number(m[1]);
    }
    if (floodWaitSec > 0) {
      floodWaitUntil = Date.now() + floodWaitSec * 1000;
      console.warn(`[userbot] FLOOD_WAIT ${floodWaitSec}s — userbot блокирован до ${new Date(floodWaitUntil).toISOString()}`);
    }

    // Detect dead session: после первого AUTH_KEY_UNREGISTERED помечаем
    // сессию как мёртвую — /health начнёт возвращать ok=false, и api-
    // процесс перестанет дёргать userbot до его перезапуска с новой
    // сессией (см. docs/userbot-mtproto.md «Если Telegram разлогинит»).
    if (!sessionDead && looksLikeSessionDead(rawError)) {
      sessionDead = true;
      sessionDeadReason = errorText;
      console.error(
        '[userbot] СЕССИЯ МЁРТВАЯ:',
        errorText,
        '— /health будет возвращать ok=false. ',
        'Останови процесс, удали data/userbot.session, пройди login заново.',
      );
    }
    // Логируем неудачу — пусть в журнале админки видно что попытка была.
    // setImmediate, чтобы не блокировать ответ HTTP клиенту.
    setImmediate(() => {
      try {
        const chatId = String(req.body?.chat_id || '');
        const customer = stmtFindCustomer.get(chatId);
        stmtInsertLog.run(
          chatId,
          customer?.id || null,
          chatId,
          'out',
          'manual',
          String(req.body?.text || ''),
          JSON.stringify({
            source: 'userbot',
            outcome: 'failed',
            error: errorText,
            flood_wait_seconds: floodWaitSec || undefined,
            order_id: req.body?.order_id || null,
          }),
        );
      } catch (logErr) {
        console.error('[userbot] failed to log failure:', logErr?.message);
      }
    });

    // FloodWait → 429 (auto-notify обработает как unreachable).
    // Сессия мёртвая → 503 (userbot нерабочий до restart, business-mode fallback).
    // Прочее → 502 (общая ошибка).
    if (floodWaitSec > 0) {
      return res.status(429).json({
        ok: false,
        error: 'flood_wait',
        retry_after_seconds: floodWaitSec,
      });
    }
    if (sessionDead) {
      return res.status(503).json({ ok: false, error: 'session_dead' });
    }
    res.status(502).json({ ok: false, error: errorText });
  }
});

const httpServer = app.listen(PORT, '127.0.0.1', () => {
  console.log(`[userbot] HTTP API listens on 127.0.0.1:${PORT}`);
});

// Корректный shutdown по SIGTERM (PM2 reload) и SIGINT (Ctrl+C).
//
// Защита от двойного вызова: PM2 шлёт SIGTERM, потом через kill_timeout
// (по умолчанию 1.6с) — SIGKILL. Если первая попытка disconnect долгая,
// а второй сигнал прилетает — игнорируем, чтобы не плодить параллельные
// disconnect()-вызовы (GramJS на double-disconnect ловит unhandled rejection).
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[userbot] shutdown by ${signal}...`);
  // 1) Закрываем HTTP listener — новых /send-message не примем, текущие
  //    дорабатывают (их обычно <1с, кроме залипшего FloodWait).
  try {
    await new Promise((resolve) => httpServer.close(() => resolve()));
  } catch (err) {
    console.error('[userbot] http close error:', redactSecrets(err?.message || err));
  }
  // 2) Отключаемся от Telegram. Жёсткий timeout 5с: GramJS иногда залипает
  //    на disconnect, если соединение висит — нет смысла блокировать PM2,
  //    он всё равно через kill_timeout отправит SIGKILL.
  try {
    await Promise.race([
      client.disconnect(),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  } catch (err) {
    console.error('[userbot] disconnect error:', redactSecrets(err?.message || err));
  }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Diagnostic guards: если рантайм-ошибка долетела сюда — её причина важна
// для дебага. Не перезапускаем сами, PM2 это сделает (autorestart=true).
process.on('uncaughtException', (err) => {
  console.error('[userbot] uncaughtException:', redactSecrets(err?.stack || err));
  // В неопределённом состоянии оставаться хуже, чем потерять секунду на
  // PM2-перезапуск — инициируем shutdown.
  shutdown('uncaughtException').catch(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  console.error('[userbot] unhandledRejection:', redactSecrets(reason?.stack || reason));
  // Promise rejection обычно менее опасен, чем uncaught throw — логируем
  // и продолжаем работу. Если их штормит, PM2 max_restarts отловит.
});
