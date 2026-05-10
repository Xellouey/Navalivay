/**
 * Авторизация userbot. Non-interactive flow:
 *   PHONE из env.PHONE, SMS-код через файл `data/userbot.code`,
 *   2FA-пароль через файл `data/userbot.password`.
 *
 * Запуск (на сервере):
 *   PHONE=+375XXXXXXXXX node server/userbot/login.js
 *
 * Скрипт:
 *   1. Подключается к Telegram → отправляет SMS на указанный номер.
 *   2. Ждёт появления файла data/userbot.code (60 сек polling, до 10 минут).
 *   3. Если включена 2FA — ждёт data/userbot.password.
 *   4. Сохраняет сессию в data/userbot.session (chmod 600).
 *
 * После успеха файлы userbot.code и userbot.password удаляются,
 * чтобы пароль не лежал в plain text.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, saveSession, SESSION_FILE } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const CODE_FILE = path.join(DATA_DIR, 'userbot.code');
const PASSWORD_FILE = path.join(DATA_DIR, 'userbot.password');

const PHONE = (process.env.PHONE || '').trim();
if (!PHONE) {
  console.error('[login] env PHONE не задан. Запусти: PHONE=+375... node userbot/login.js');
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

console.log('=== Userbot login ===');
console.log('Телефон:', PHONE);
console.log('Сессия будет сохранена в:', SESSION_FILE);
console.log('');
console.log('Когда придёт код в Telegram (или SMS), запиши его в файл:');
console.log('  echo "12345" >', CODE_FILE);
console.log('Если включена 2FA, пароль положи в:');
console.log('  echo "your-password" >', PASSWORD_FILE);
console.log('');

/**
 * Ждёт появления файла, читает содержимое, удаляет файл, возвращает строку.
 * timeoutMs — общий таймаут ожидания. Polling каждые 2 секунды.
 */
async function waitForFile(filePath, label, timeoutMs = 10 * 60_000) {
  const start = Date.now();
  let lastLog = 0;
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(filePath)) {
      const value = fs.readFileSync(filePath, 'utf8').trim();
      // Удаляем файл, чтобы секреты не оставались на диске.
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
      if (value) {
        console.log(`[login] получил ${label}: ${'*'.repeat(value.length)}`);
        return value;
      }
    }
    if (Date.now() - lastLog > 30_000) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`[login] жду ${label}... (${elapsed}с прошло, лимит ${Math.round(timeoutMs / 1000)}с)`);
      lastLog = Date.now();
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`${label}: timeout waiting for ${filePath}`);
}

const client = createClient('');

await client.start({
  phoneNumber: async () => PHONE,
  password: async () => waitForFile(PASSWORD_FILE, '2FA-пароль'),
  phoneCode: async () => waitForFile(CODE_FILE, 'SMS-код'),
  onError: (err) => {
    console.error('[login] ошибка от Telegram:', err?.message || err);
  },
});

console.log('');
console.log('Авторизация прошла. Сохраняю сессию.');
const sessionString = client.session.save();
saveSession(sessionString);

const me = await client.getMe();
console.log('Залогинены как:', me?.firstName, me?.lastName || '', '(@' + (me?.username || '—') + ')');
console.log('User ID:', String(me?.id));
console.log('Сессия сохранена. Можно запускать pm2 start userbot/index.js --name navalivay-userbot');

await client.disconnect();
process.exit(0);
