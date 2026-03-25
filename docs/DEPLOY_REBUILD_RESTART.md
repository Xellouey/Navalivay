# Пересборка и перезапуск NAVALIVAY

## Что важно знать

- Прод-сборка frontend берётся из [`frontend/package.json`](frontend/package.json) через скрипт [`build-only`](frontend/package.json:14).
- Полный [`npm run build`](package.json:11) сейчас включает [`vue-tsc --build`](frontend/package.json:15) и может падать из-за накопившихся TypeScript-ошибок, даже если production bundle собирается нормально.
- Backend и bot должны запускаться через PM2 из конфига [`server/ecosystem.config.cjs`](server/ecosystem.config.cjs).
- Для API фактический production-порт задаётся в [`server/ecosystem.config.cjs`](server/ecosystem.config.cjs:9) и сейчас это `8082`.
- Значение `PORT=8080` в [`server/.env.production`](server/.env.production:2) не является определяющим, если сервис поднят через PM2 с env из ecosystem.

## Правильная процедура после `git pull`

### 1. Обновить зависимости при необходимости
Из корня проекта [`/var/www/NAVALIVAY`](package.json):

```bash
npm install
npm --prefix frontend install
npm --prefix server install
```

Если [`package-lock.json`](package-lock.json) и lock-файлы не менялись, достаточно серверной/фронтовой установки по месту, но безопасный вариант — выполнить все три команды.

### 2. Собрать frontend
Рабочая production-сборка:

```bash
npm --prefix frontend run build-only
```

Почему так:
- [`npm run build`](package.json:11) вызывает [`frontend build`](frontend/package.json:12),
- а тот сначала запускает type-check,
- из-за этого пересборка может оборваться не на bundle, а на TypeScript-диагностике.

Пока type-check не приведён в порядок, для деплоя использовать именно:

```bash
npm --prefix frontend run build-only
```

### 3. Перезапустить backend и bot через PM2
Из директории [`server`](server/package.json):

```bash
pm2 start ecosystem.config.cjs --only navalivay-api --update-env
pm2 start ecosystem.config.cjs --only navalivay-bot --update-env
```

Если процессы уже существуют, стандартный вариант:

```bash
pm2 restart navalivay-api --update-env
pm2 restart navalivay-bot --update-env
```

Или одной командой:

```bash
pm2 restart navalivay-api navalivay-bot --update-env
```

### 4. Проверить статус после рестарта

```bash
pm2 status
pm2 logs navalivay-api --lines 50 --nostream
pm2 logs navalivay-bot --lines 50 --nostream
curl http://127.0.0.1:8082/api/health
```

Ожидаемый результат:
- в [`pm2 status`](server/ecosystem.config.cjs) процесс [`navalivay-api`](server/ecosystem.config.cjs:4) в статусе `online`,
- healthcheck на `8082` отвечает успешно.

## Если после перезапуска что-то всё равно работает не так

### Симптом: PM2-процесс падает, а сайт отвечает частично
Наиболее вероятная причина — порт уже занят старым standalone-процессом Node.

Проверка:

```bash
ss -ltnp | grep 8082
pm2 status
pm2 logs navalivay-api --lines 100 --nostream
```

Если в логах есть `EADDRINUSE`, значит:
- PM2 не смог поднять актуальный backend,
- а запросы продолжают попадать в старый процесс, который остался висеть на порту.

### Как исправлять конфликт порта
1. Найти PID процесса на `8082`.
2. Убедиться, что это не актуальный PM2-процесс.
3. Остановить его.
4. Повторно выполнить рестарт PM2.

Пример:

```bash
ss -ltnp | grep 8082
ps -fp <PID>
kill <PID>
pm2 restart navalivay-api navalivay-bot --update-env
```

После этого снова проверить:

```bash
curl http://127.0.0.1:8082/api/health
```

## Короткий рабочий чек-лист

Из корня проекта:

```bash
npm --prefix frontend run build-only
npm --prefix server install
```

Из директории [`server`](server/package.json):

```bash
pm2 restart navalivay-api navalivay-bot --update-env
pm2 status
curl http://127.0.0.1:8082/api/health
```

## Что было исправлено дополнительно

- Удалены временные диагностические логи из [`frontend/src/main.ts`](frontend/src/main.ts), [`frontend/src/App.vue`](frontend/src/App.vue) и [`frontend/src/views/ProfileView.vue`](frontend/src/views/ProfileView.vue).
- Фикс белого экрана сохранён в [`frontend/src/views/HomeView.vue`](frontend/src/views/HomeView.vue).
- Причина ошибки `Request failed` была связана не с frontend, а с конфликтом порта и неактуальным backend-процессом вместо PM2-инстанса.
