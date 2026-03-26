# NAVALIVAY - E-commerce Platform with Telegram Mini App

## Project Overview

A full-featured e-commerce platform for a vape shop with:
- **Frontend**: Vue 3 + Vite + TypeScript customer app and admin panel
- **Backend**: Node.js + Express API server
- **Bot**: Telegram bot integration
- **Database**: SQLite with migrations
- **Deployment**: Systemd services (primary) with PM2 kept only as an optional alternative for explicitly configured environments

## Architecture

### Frontend (`frontend/`)
- Vue 3 application with customer-facing Telegram Mini App
- Admin panel for product/category/order management
- Built with Vite, TypeScript, and UnoCSS

### Backend (`server/`)
- Express.js REST API server
- SQLite database with migration support
- Image upload and processing
- Telegram WebApp authentication

### Bot (`server/bot.js`)
- Telegram bot for notifications and integration
- Optional production service depending on server setup

## Development

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Install dependencies
```bash
npm install
npm --prefix frontend install
npm --prefix server install
```

### Run in development
```bash
# All services
npm run dev

# Individual services
npm run dev:frontend
npm run dev:server
npm run dev:bot
```

## Production Build

### Frontend build
Recommended production bundle command:
```bash
npm --prefix frontend run build-only
```

Root `npm run build` may fail on frontend type-check even when the production bundle itself builds successfully.

### Server build
```bash
npm run build:server
```

## Production Deployment

### Standard deployment flow
1. Update code on the server
2. Install dependencies if needed
3. Build frontend
4. Restart production services
5. Verify health

### Deployment helper
From the project root:
```bash
./ops/deploy.sh
```

The deploy script:
- pulls latest code when git is available,
- installs production dependencies,
- checks configuration,
- ensures required directories exist,
- restarts systemd services,
- validates API health.

## Production Process Management

### Systemd Services (primary / standard)
Primary production runtime on this project is systemd.

- `navalivay-server.service` - main API server
- `navalivay-bot.service` - optional Telegram bot service

**Useful commands:**
```bash
# Restart API
sudo systemctl restart navalivay-server

# Restart bot only if the unit exists
if systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -qx 'navalivay-bot.service'; then
  sudo systemctl restart navalivay-bot
fi

# Status
sudo systemctl status navalivay-server --no-pager -n 20

# Logs
sudo journalctl -u navalivay-server -f
sudo journalctl -u navalivay-bot -f

# Health check
curl -fsS http://127.0.0.1:8082/api/health
```

**Recommended one-liner after frontend rebuild:**
```bash
npm --prefix frontend run build-only && sudo systemctl restart navalivay-server && if systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -qx 'navalivay-bot.service'; then sudo systemctl restart navalivay-bot; fi && sleep 2 && curl -fsS http://127.0.0.1:8082/api/health
```

### PM2 (optional alternative only)
[`server/ecosystem.config.cjs`](server/ecosystem.config.cjs) should be used only on servers where the application was intentionally started and is actively managed through PM2.

Do **not** assume PM2 is the standard runtime on production for this repository.

Example PM2 commands for such dedicated environments:
```bash
pm2 start server/ecosystem.config.cjs --only navalivay-api --update-env
pm2 start server/ecosystem.config.cjs --only navalivay-bot --update-env
pm2 status
```

If `pm2 status` does not show the apps, restarting by name will fail.

## File Structure

```
NAVALIVAY/
├── frontend/          # Vue.js frontend application
├── server/            # Node.js backend and bot
├── ops/               # Deployment and operations
│   ├── deploy.sh      # Production deployment script
│   ├── backup.sh      # Database backup script
│   └── monitor.sh     # Health monitoring script
├── uploads/           # User uploaded files
└── docs/              # Documentation
```

## Important Notes

### Frontend build nuance
The recommended deploy-time command is `npm --prefix frontend run build-only` because it skips the stricter type-check path that may block deployment while still allowing Vite to emit the production bundle.

### vite-plugin-vue-devtools Known Issue
**CRITICAL:** `vite-plugin-vue-devtools` is disabled in `frontend/vite.config.ts` due to a RouterView compatibility issue that causes: `"TypeError: Cannot set properties of null (setting '__vrv_devtools')"`. Do not re-enable without testing thoroughly.

### Security
- Never commit `.env` files
- Keep Telegram bot tokens secure
- Use proper file permissions on `uploads/`
- Run deployment with least privilege

## Troubleshooting

### API not responding after restart
```bash
sudo systemctl status navalivay-server --no-pager -n 50
sudo journalctl -u navalivay-server -n 100 --no-pager
ss -ltnp | grep 8082
curl -fsS http://127.0.0.1:8082/api/health
```

### Bot service missing
If `navalivay-bot.service` is not installed on a server, skip bot restart and bot status checks.
