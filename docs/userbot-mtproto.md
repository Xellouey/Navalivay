# Userbot через MTProto (GramJS)

Авто-уведомления клиенту от лица аккаунта менеджера, без 24-часового окна
Telegram Business.

## Зачем

Telegram Business для ботов имеет жёсткое ограничение:
`BusinessBotRights.can_reply` действует **только в чатах с входящим
сообщением за последние 24 часа** ([core.telegram.org/bots/api](https://core.telegram.org/bots/api)).
Клиент молчит сутки → бот не может писать → менеджер видит
`BUSINESS_PEER_USAGE_MISSING`.

Userbot работает как обычный Telegram-клиент (типа iMe или Telegram X)
от имени аккаунта менеджера через MTProto. У него этого ограничения нет
— как и у любого другого Telegram-клиента.

Риск: формальная серая зона ToS Telegram. Митигируется консервативными
лимитами (1 сообщение/секунду, только триггеры на статусы, никаких
массовых рассылок).

## Архитектура

```
┌─────────────────────┐    HTTP 127.0.0.1:8083   ┌────────────────────┐
│ navalivay-api (PM2) │ ────────────────────────►│ navalivay-userbot  │
│ Express endpoints   │                          │ (PM2, GramJS)      │
│ auto-notify         │                          │                    │
│ /bot/send-custom    │ ◄──── auto-fallback ──── │ MTProto ↔ Telegram │
└─────────────────────┘    при недоступности     └────────────────────┘
                            (Business mode)
```

- API процесс — Express endpoints (как сейчас).
- Userbot процесс — отдельный PM2-сервис, держит постоянное MTProto-
  соединение, слушает `NewMessage` от клиентов и логирует входящие в
  `bot_message_log` (`direction='in'`, `meta.source='userbot'`).
- Локальный HTTP API на 127.0.0.1:8083 для приёма команд от api.
- Если userbot недоступен (health-check 127.0.0.1:8083/health) —
  auto-notify фоллбэкается на Business mode (Bot API через прокси).

## Файлы

- `server/userbot/client.js` — конструктор GramJS клиента. Сессия
  лежит в `server/data/userbot.session` (в gitignore, chmod 600).
- `server/userbot/login.js` — CLI скрипт одноразовой SMS-авторизации.
  Запускать `node server/userbot/login.js` интерактивно.
- `server/userbot/index.js` — основной процесс: слушает Telegram updates,
  логирует входящие, поднимает HTTP API для отправки.
- `server/utils/userbot-client.js` — bridge от api-процесса к userbot
  через локальный HTTP, с health-кэшем (30с success / 10с failure).
- Интеграции:
  - `server/utils/auto-notify.js` — пробует userbot first, fallback на Business mode
  - `server/routes/crm.js` `/bot/send-custom` — то же самое для свободных сообщений

## Env переменные

В `server/.env` (на проде уже добавлены):

- `TELEGRAM_API_ID` — число, выдано через [my.telegram.org](https://my.telegram.org)
- `TELEGRAM_API_HASH` — длинная строка, выдана там же
- `USERBOT_HTTP_PORT` — опционально, по умолчанию 8083
- `USERBOT_SECRET` — опционально, shared secret для X-Userbot-Secret заголовка

## Что осталось до запуска (на 9.05.2026)

**Сделано**:
- GramJS + input в зависимостях (server/package.json), установлены на сервере
- Все исходники задеплоены на прод (`/var/www/NAVALIVAY/server/userbot/`)
- `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` в `.env` на сервере
- Auto-notify и `/bot/send-custom` уже умеют пробовать userbot first

**Осталось**:
1. **Один раз** запустить `node server/userbot/login.js` интерактивно на сервере:
   ```
   ssh NavalivayNew "cd /var/www/NAVALIVAY/server && node userbot/login.js"
   ```
   - Введёт номер телефона менеджера
   - Telegram пришлёт код через app или SMS — менеджер диктует
   - Если включена 2FA cloud password — ввести её
   - Сессия запишется в `server/data/userbot.session` (chmod 600)
2. Завести userbot в PM2:
   ```
   pm2 start /var/www/NAVALIVAY/server/userbot/index.js --name navalivay-userbot
   pm2 save
   ```
3. Проверить:
   ```
   curl http://127.0.0.1:8083/health   # должен вернуть {ok:true, connected:true}
   ```
4. Менять статус заказа в админке — auto-notify теперь пойдёт через
   userbot (видно в логе `meta.source='userbot'`).

## Откат / выключение

Чтобы отключить userbot и вернуться к pure Business mode:
```
pm2 stop navalivay-userbot
```
Auto-notify сам сфоллбэкается на Business mode (health-check вернёт false).
Никаких изменений в коде не нужно.

## Если Telegram разлогинит сессию

В Telegram-приложении: `Настройки → Активные сеансы → Завершить
другие сеансы` — это убьёт нашу сессию. Симптом: userbot процесс
получит ошибку `AUTH_KEY_UNREGISTERED` при следующем запросе. Решение:
```
pm2 stop navalivay-userbot
rm /var/www/NAVALIVAY/server/data/userbot.session
node /var/www/NAVALIVAY/server/userbot/login.js  # пройти SMS снова
pm2 start navalivay-userbot
```
