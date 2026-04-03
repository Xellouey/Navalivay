# Deploy extras

Здесь лежат вспомогательные файлы для окружения, не обязательные для самого репозитория.

- `navalivay-bot.service` - пример systemd unit для бота (long polling, `server/bot.js`, `EnvironmentFile` на `server/.env`). На проде бот может быть в PM2 - см. комментарий внутри unit.

Полная процедура перезапуска и сборки: [`docs/DEPLOY_REBUILD_RESTART.md`](../docs/DEPLOY_REBUILD_RESTART.md).
