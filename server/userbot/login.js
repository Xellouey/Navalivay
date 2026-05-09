/**
 * CLI-скрипт одноразовой авторизации userbot.
 *
 * Запуск: node server/userbot/login.js
 * Что делает:
 *   1. Создаёт GramJS-клиент с пустой сессией.
 *   2. Спрашивает phone (+375...), затем SMS-код, затем 2FA-пароль если есть.
 *   3. Сохраняет StringSession в server/data/userbot.session с chmod 600.
 *
 * Запускается ОДИН раз при первой настройке (или повторно, если Telegram
 * разлогинил сессию через «Все сессии»). После сохранения основной процесс
 * (server/userbot/index.js) подхватывает сессию из файла и работает без
 * вмешательства человека.
 */
import 'dotenv/config';
import input from 'input';
import { createClient, saveSession, SESSION_FILE } from './client.js';

console.log('=== Userbot login ===');
console.log('Файл сессии:', SESSION_FILE);
console.log('');

const client = createClient('');

await client.start({
  phoneNumber: async () => input.text('Номер телефона менеджера (с +): '),
  password: async () => input.text('Пароль 2FA (если включён, иначе Enter): '),
  phoneCode: async () => input.text('Код из SMS / Telegram: '),
  onError: (err) => {
    console.error('[login] ошибка:', err?.message || err);
  },
});

console.log('');
console.log('Авторизация прошла. Сохраняю сессию в', SESSION_FILE);
const sessionString = client.session.save();
saveSession(sessionString);

const me = await client.getMe();
console.log('Залогинены как:', me?.firstName, me?.lastName || '', '(@' + (me?.username || '—') + ')');
console.log('User ID:', String(me?.id));
console.log('');
console.log('Сессия сохранена. Можно запускать основной процесс userbot.');
await client.disconnect();
process.exit(0);
