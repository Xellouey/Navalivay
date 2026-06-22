# Деплой и перезапуск NAVALIVAY (production)

Документ сверен с `NavalivayNew` (2026-06-22). Если поведение сервера изменилось — сначала проверьте факты командами из раздела «Как устроен prod».

## Как устроен prod сейчас

| Компонент | Кто запускает | Порт | Штатный рестарт |
|-----------|---------------|------|-----------------|
| API + CRM | `systemd` → `navalivay-server.service` | `8082` | `systemctl restart navalivay-server` |
| nginx `/api` | прокси на `127.0.0.1:8082` | 443/80 | — |
| Telegraf-бот (`bot.js`) | **PM2** → `navalivay-bot` | — | `pm2 restart navalivay-bot` |
| Userbot MTProto | **PM2** → `navalivay-userbot` | `8083` | `pm2 restart navalivay-userbot` |

SSH: `NavalivayNew`, пользователь `root`, каталог `/var/www/NAVALIVAY`, Node `/usr/bin/node` (v22).

**Важно:**
- `8082` обслуживает **только** systemd-процесс (`MainPID` = владелец порта).
- В PM2 может висеть `navalivay-api` — он **не** слушает `8082`. Не рестартовать для деплоя API; лучше удалить: `pm2 delete navalivay-api`.
- Unit `navalivay-bot.service` на сервере **есть**, но `disabled` / `inactive`. Бот реально работает в PM2. **`systemctl restart navalivay-bot` не использовать** — можно поднять второй экземпляр.

### Быстрая проверка фактов на сервере

```bash
ss -ltnp 'sport = :8082'                    # владелец :8082
systemctl show navalivay-server -p MainPID --value
pm2 list                                    # navalivay-bot, navalivay-userbot
curl -fsS http://127.0.0.1:8082/api/health
curl -fsS http://127.0.0.1:8083/health      # "connected":true
```

## Штатный деплой

Типичный сценарий после `git pull` (frontend + backend, как при обычном релизе):

```bash
cd /var/www/NAVALIVAY
git pull

npm --prefix frontend ci
npm --prefix frontend run build-only

npm --prefix server ci --omit=dev
systemctl restart navalivay-server

curl -fsS http://127.0.0.1:8082/api/health
curl -fsS http://127.0.0.1:8083/health
```

`npm … ci` можно пропустить, если в коммите не менялись `package-lock.json` в `frontend/` или `server/`.

Для сборки frontend использовать **`build-only`**, не `npm run build` из корня (type-check может упасть при рабочем bundle).

### Что ещё рестартить

| Менялось | Дополнительно |
|----------|----------------|
| `server/bot.js`, `.env` с `BOT_TOKEN` | `pm2 restart navalivay-bot` |
| `server/userbot/` | `pm2 restart navalivay-userbot` |
| Только `frontend/` | рестарт API **не нужен** |
| Только `server/` (API) | достаточно `systemctl restart navalivay-server` |

## Проверка после деплоя

```bash
systemctl is-active navalivay-server          # active
curl -fsS http://127.0.0.1:8082/api/health   # {"ok":true,...}
curl -fsS http://127.0.0.1:8083/health       # "connected":true
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8082/api/admin/crm/orders/poll-summary
# ожидается 401 без токена (404 = не тот код/процесс на :8082)
```

Логи API:

```bash
journalctl -u navalivay-server -n 50 --no-pager
```

Логи бота / userbot:

```bash
pm2 logs navalivay-bot --lines 30 --nostream
pm2 logs navalivay-userbot --lines 30 --nostream
```

## Чего не делать

```bash
pm2 restart navalivay-api      # API на prod не в PM2; трафик не обновится
systemctl restart navalivay-bot # бот на prod в PM2; риск дубля
```

## Если что-то сломалось

```bash
ss -ltnp | grep 8082
systemctl status navalivay-server --no-pager -n 30
journalctl -u navalivay-server -n 100 --no-pager
```

Если API не стартует после смены Node — см. [`docs/prod-hotfix-playbook.md`](prod-hotfix-playbook.md) (native modules / `better-sqlite3`).

## Почему systemd + PM2 вместе

Это **не баг**, а **гибрид после миграции**:

- API перевели на **systemd** (стабильный рестарт, `ExecStartPre` для `better-sqlite3`, владелец `:8082`).
- **Бот** и **userbot** остались в **PM2** (long polling, proxychains, отдельные рестарты).

Ненормально другое: **два способа запуска одного и того же** — например PM2 `navalivay-api` + systemd API, или `systemctl start navalivay-bot` при живом PM2-боте. Такое накапливается, если после смены схемы не почистили старые процессы.

### Как ловить расхождения

На сервере (после деплоя или по cron):

```bash
./ops/check-prod-runtime.sh
```

Скрипт проверяет: `:8082` = systemd MainPID, бот/userbot в PM2, userbot `connected`, нет активного дубля `navalivay-bot.service`, предупреждает про зомби `navalivay-api`.

Рекомендуемая разовая уборка на prod:

```bash
pm2 delete navalivay-api
pm2 save
```

## Прочее

- Mini App / опт: [`docs/telegram-mini-app.md`](telegram-mini-app.md)
- PM2 ecosystem: [`server/ecosystem.config.cjs`](../server/ecosystem.config.cjs) — для dev или нестандартных инсталляций, не шаблон для API на текущем prod
- Мониторинг: `./ops/monitor.sh`