/**
 * GramJS клиент для userbot — работает от лица аккаунта менеджера через
 * MTProto (как обычный Telegram-клиент типа iMe / Telegram X).
 *
 * Зачем: Telegram Business для ботов имеет жёсткое 24-часовое окно — бот
 * не может писать клиентам, которые молчат больше суток. Userbot этого
 * ограничения не имеет, потому что технически он = аккаунт менеджера.
 *
 * Сессия (StringSession) — самое чувствительное: кто получит её, получит
 * доступ к Telegram-аккаунту менеджера. Храним в файле data/userbot.session
 * (gitignore + chmod 600 на сервере), читаем при старте процесса.
 *
 * Создание клиента — создаёт объект, но НЕ подключается. connect() надо
 * звать отдельно (login.js делает это с интерактивным SMS-flow, основной
 * процесс — просто .connect() со store сессией).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Сессия живёт в server/data/userbot.session — рядом с БД.
export const SESSION_FILE = path.resolve(__dirname, '../data/userbot.session');

export function loadSavedSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return fs.readFileSync(SESSION_FILE, 'utf8').trim();
    }
  } catch (err) {
    console.error('[userbot] не удалось прочитать сессию:', err.message);
  }
  return '';
}

export function saveSession(sessionString) {
  if (!sessionString) return;
  // Создаём data/ если ещё нет (на чистом сервере).
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  fs.writeFileSync(SESSION_FILE, sessionString, { mode: 0o600 });
}

/**
 * Создаёт GramJS-клиент. Не подключается — это делает caller.
 *
 * @param {string} [sessionString] — если пустой, сессия будет создана пустой
 *   (для login flow); если непустой, клиент сразу авторизован.
 */
export function createClient(sessionString = '') {
  const apiId = Number(process.env.TELEGRAM_API_ID || 0);
  const apiHash = (process.env.TELEGRAM_API_HASH || '').trim();
  if (!apiId || !apiHash) {
    throw new Error(
      'TELEGRAM_API_ID / TELEGRAM_API_HASH не заданы в .env — userbot не может работать',
    );
  }
  const session = new StringSession(sessionString);
  // connectionRetries=5 — небольшой автоматический ретрай при разрыве.
  // baseLogger — выключен, чтобы наш stdout не засорялся внутренними
  // логами GramJS (они шумные).
  return new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
    autoReconnect: true,
    useWSS: true,
  });
}
