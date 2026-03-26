# Пересборка и штатный перезапуск NAVALIVAY

## Что важно знать

- Прод-сборка frontend берётся из [`frontend/package.json`](../frontend/package.json) через скрипт `build-only`.
- Полный `npm run build` из корня проекта вызывает frontend type-check и может падать из-за TypeScript-диагностики, даже если production bundle собирается нормально.
- Штатный production-запуск на текущем сервере выполняется через systemd, а не через PM2.
- Основной backend-сервис — `navalivay-server.service`.
- Сервис `navalivay-bot.service` является опциональным и может отсутствовать на конкретном сервере.
- Проверка живости API выполняется по `http://127.0.0.1:8082/api/health`, как и в [`ops/deploy.sh`](../ops/deploy.sh).
- Конфиг [`server/ecosystem.config.cjs`](../server/ecosystem.config.cjs) сохраняется только как альтернативный вариант для отдельных окружений, где приложения были явно подняты через PM2.

## Правильная процедура после `git pull`

### 1. Обновить зависимости при необходимости
Из корня проекта `/var/www/NAVALIVAY`:

```bash
npm install
npm --prefix frontend install
npm --prefix server install
```

Если lock-файлы не менялись, обычно достаточно обновить зависимости только в нужной части проекта.

### 2. Собрать frontend
Рабочая production-сборка:

```bash
npm --prefix frontend run build-only
```

Почему именно так:
- `npm run build` из корня вызывает frontend build со встроенным type-check,
- из-за этого сборка может завершиться ошибкой на TypeScript-проверке,
- при этом production bundle сам по себе может собираться корректно.

Пока type-check полностью не приведён в порядок, для деплоя использовать именно:

```bash
npm --prefix frontend run build-only
```

### 3. Штатно перезапустить backend через systemd
Основная команда:

```bash
sudo systemctl restart navalivay-server
```

Если на сервере установлен bot service, перезапустить и его:

```bash
if systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -qx 'navalivay-bot.service'; then
  sudo systemctl restart navalivay-bot
fi
```

Безопасный универсальный one-liner:

```bash
sudo systemctl restart navalivay-server && if systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -qx 'navalivay-bot.service'; then sudo systemctl restart navalivay-bot; fi
```

### 4. Проверить статус после рестарта

```bash
sudo systemctl status navalivay-server --no-pager -n 20
if systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -qx 'navalivay-bot.service'; then
  sudo systemctl status navalivay-bot --no-pager -n 20
fi
curl -fsS http://127.0.0.1:8082/api/health
```

Ожидаемый результат:
- `navalivay-server.service` находится в статусе `active (running)`,
- при наличии bot service он тоже находится в статусе `active (running)`,
- healthcheck на `8082` отвечает успешно.

## Правильные команды

### Только перезапуск API

```bash
sudo systemctl restart navalivay-server && sleep 2 && curl -fsS http://127.0.0.1:8082/api/health
```

### Полный штатный сценарий после пересборки frontend

```bash
npm --prefix frontend run build-only && sudo systemctl restart navalivay-server && if systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -qx 'navalivay-bot.service'; then sudo systemctl restart navalivay-bot; fi && sleep 2 && curl -fsS http://127.0.0.1:8082/api/health
```

### Если работаешь из root-shell
Можно выполнить те же команды без `sudo`.

## Когда использовать `ops/deploy.sh`
Скрипт [`ops/deploy.sh`](../ops/deploy.sh) — это штатный deploy helper для полного сценария на сервере:
- установка production-зависимостей,
- проверка конфигурации,
- создание нужных директорий,
- рестарт systemd-сервисов,
- healthcheck.

Важно: скрипт специально запрещает запуск от root, поэтому из root-shell удобнее выполнять команды systemd напрямую.

## Когда использовать PM2
PM2 не является основным production-механизмом на текущем сервере.

Использовать команды из [`server/ecosystem.config.cjs`](../server/ecosystem.config.cjs) имеет смысл только если:
1. на конкретном сервере приложения действительно были подняты через PM2,
2. это осознанно выбранное окружение,
3. в `pm2 status` уже видны соответствующие процессы.

Если этих условий нет, не использовать:

```bash
pm2 restart navalivay-api navalivay-bot --update-env
```

как штатную команду перезапуска.

## Если после рестарта что-то всё равно работает не так

### Проверить статус сервиса и последние логи

```bash
sudo systemctl status navalivay-server --no-pager -n 50
sudo journalctl -u navalivay-server -n 100 --no-pager
```

Если установлен bot service:

```bash
sudo systemctl status navalivay-bot --no-pager -n 50
sudo journalctl -u navalivay-bot -n 100 --no-pager
```

### Проверить, кто слушает порт `8082`

```bash
ss -ltnp | grep 8082
```

### Быстрый рабочий чек-лист
Из корня проекта:

```bash
npm --prefix frontend run build-only
sudo systemctl restart navalivay-server
curl -fsS http://127.0.0.1:8082/api/health
```
