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
import express from 'express';
import { NewMessage } from 'telegram/events/index.js';
import { createClient, loadSavedSession } from './client.js';
import { db } from '../db.js';

const PORT = Number(process.env.USERBOT_HTTP_PORT || 8083);
const SHARED_SECRET = (process.env.USERBOT_SECRET || '').trim();
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
// Слушаем входящие сообщения и логируем активность клиентов в БД.
// ---------------------------------------------------------------------------
client.addEventHandler(async (event) => {
  try {
    const message = event.message;
    if (!message || !message.peerId) return;
    // Интересуют только private chats (пользователи), не каналы и не группы.
    const peerUserId = message.peerId?.userId;
    if (!peerUserId) return;
    const chatId = String(peerUserId);

    // out = сообщение от менеджера клиенту, in = от клиента менеджеру.
    const direction = message.out ? 'out' : 'in';
    const senderId = message.senderId ? String(message.senderId) : null;
    // Игнорируем echo нашего же userbot отправки — там message.out=true,
    // мы уже залогировали при отправке через HTTP API.
    if (direction === 'out' && senderId === myUserId) return;

    const customer = db
      .prepare(`SELECT id FROM customers WHERE telegram_id = ?`)
      .get(chatId);

    db.prepare(
      `INSERT INTO bot_message_log
         (business_connection_id, chat_id, customer_id, customer_telegram_id,
          direction, message_type, text, meta, created_at)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'))`,
    ).run(
      chatId,
      customer?.id || null,
      chatId,
      direction,
      direction === 'in' ? 'incoming' : 'manual',
      message.message || null,
      JSON.stringify({ source: 'userbot', telegram_message_id: message.id }),
    );
  } catch (err) {
    console.error('[userbot] ошибка обработки события:', err?.message || err);
  }
}, new NewMessage({}));

// ---------------------------------------------------------------------------
// Локальный HTTP API: принимает команды от api-процесса.
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '64kb' }));

function checkSecret(req, res, next) {
  if (!SHARED_SECRET) return next(); // секрет необязателен (опционально)
  const got = req.header('X-Userbot-Secret');
  if (got !== SHARED_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

// Простой rate-limiter — token bucket с интервалом 1 секунда.
let lastSendAt = 0;
async function rateLimitedDelay() {
  const now = Date.now();
  const minInterval = 1000 / MAX_SENDS_PER_SECOND;
  const wait = lastSendAt + minInterval - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSendAt = Date.now();
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    me: myUserId,
    connected: client.connected,
  });
});

app.post('/send-message', checkSecret, async (req, res) => {
  try {
    const chatId = req.body?.chat_id;
    const text = String(req.body?.text || '').trim();
    if (!chatId || !text) {
      return res.status(400).json({ ok: false, error: 'chat_id_and_text_required' });
    }
    await rateLimitedDelay();

    const result = await client.sendMessage(BigInt(chatId), { message: text });
    const messageId = result?.id ? Number(result.id) : null;

    // Логируем исходящее в bot_message_log — для журнала в админке.
    const customer = db
      .prepare(`SELECT id FROM customers WHERE telegram_id = ?`)
      .get(String(chatId));
    db.prepare(
      `INSERT INTO bot_message_log
         (business_connection_id, chat_id, customer_id, customer_telegram_id,
          direction, message_type, text, meta, created_at)
       VALUES (NULL, ?, ?, ?, 'out', 'manual', ?, ?, DATETIME('now'))`,
    ).run(
      String(chatId),
      customer?.id || null,
      String(chatId),
      text,
      JSON.stringify({
        source: 'userbot',
        outcome: 'sent',
        telegram_message_id: messageId,
        order_id: req.body?.order_id || null,
      }),
    );

    res.json({ ok: true, telegram_message_id: messageId });
  } catch (err) {
    const errorText = err?.errorMessage || err?.message || String(err);
    console.error('[userbot] sendMessage error:', errorText);
    // Логируем неудачу — пусть в журнале админки видно что попытка была.
    try {
      const chatId = String(req.body?.chat_id || '');
      const customer = db
        .prepare(`SELECT id FROM customers WHERE telegram_id = ?`)
        .get(chatId);
      db.prepare(
        `INSERT INTO bot_message_log
           (business_connection_id, chat_id, customer_id, customer_telegram_id,
            direction, message_type, text, meta, created_at)
         VALUES (NULL, ?, ?, ?, 'out', 'manual', ?, ?, DATETIME('now'))`,
      ).run(
        chatId,
        customer?.id || null,
        chatId,
        String(req.body?.text || ''),
        JSON.stringify({
          source: 'userbot',
          outcome: 'failed',
          error: errorText,
          order_id: req.body?.order_id || null,
        }),
      );
    } catch (logErr) {
      console.error('[userbot] failed to log failure:', logErr?.message);
    }
    res.status(502).json({ ok: false, error: errorText });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[userbot] HTTP API listens on 127.0.0.1:${PORT}`);
});

// Корректный shutdown по SIGTERM (PM2 reload).
async function shutdown() {
  console.log('[userbot] shutdown...');
  try {
    await client.disconnect();
  } catch {}
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
