# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

NAVALIVAY is a Telegram Mini App built as a full-stack e-commerce platform with integrated Telegram bot functionality. The project is a monorepo containing a Vue 3 frontend and Express.js backend with SQLite database.

## Development Commands

### Main Commands (run from project root)

```bash
# Development - run both frontend and backend concurrently
npm run dev

# Development with Telegram bot enabled
npm run dev:bot

# Run frontend only
npm run dev:frontend

# Run backend only
npm run dev:server

# Build frontend for production
npm run build

# Build backend (if needed)
npm run build:server

# Run production server
npm start

# Run production bot
npm run start:bot

# Run all tests (frontend unit tests + server tests)
npm run test

# Lint all code (frontend + server)
npm run lint

# Format code with Prettier
npm run format
```

### Frontend-Specific Commands (run from `/frontend`)

```bash
# Start dev server on http://localhost:5173
npm run dev

# Type-check TypeScript
npm run type-check

# Build for production
npm run build

# Build without type-checking
npm run build-only

# Preview production build
npm run preview

# Lint and fix
npm run lint

# Run unit tests with Vitest
npm run test:unit
```

### Server-Specific Commands (run from `/server`)

```bash
# Start development server on port 8081 (or PORT from .env)
npm run dev

# Start production server
npm start

# Start bot in production
npm run start:bot

# Lint (currently not configured, logs skip message)
npm run lint
```

## Architecture

### Monorepo Structure

```
NAVALIVAY/
├── frontend/          # Vue 3 + TypeScript SPA
│   ├── src/
│   │   ├── components/    # Vue components (admin, crm, icons, product)
│   │   ├── composables/   # Vue composables
│   │   ├── config/        # Configuration files
│   │   ├── constants/     # Constants and enums
│   │   ├── router/        # Vue Router configuration
│   │   ├── stores/        # Pinia stores (admin, catalog, crm, settings)
│   │   ├── styles/        # CSS and styling
│   │   ├── types/         # TypeScript type definitions
│   │   ├── utils/         # Utility functions
│   │   └── views/         # Page components
│   └── public/        # Static assets
├── server/            # Express.js API + Telegram Bot
│   ├── routes/        # Express route handlers
│   │   ├── public.js       # Public API routes
│   │   ├── admin.js        # Admin API routes
│   │   ├── crm.js          # CRM routes
│   │   ├── crm-operations.js
│   │   └── crm-finance.js
│   ├── migrations/    # Database migration scripts
│   ├── seed/          # Seed data (JSON files)
│   ├── data/          # SQLite database location
│   ├── scripts/       # Server utility scripts
│   ├── config/        # Configuration files
│   ├── index.js       # Main Express server
│   ├── bot.js         # Telegram bot (Telegraf)
│   ├── db.js          # Database initialization and migrations
│   ├── auth.js        # Authentication middleware
│   └── upload.js      # File upload handling
├── scripts/           # Development scripts
│   └── dev.js         # Concurrent dev server launcher
├── ops/               # Deployment and operations
│   ├── deploy.sh          # Production deployment script
│   ├── backup.sh          # Database backup script
│   ├── monitor.sh         # Service monitoring
│   ├── nginx.conf         # Nginx configuration
│   └── systemd/           # Systemd service files
├── uploads/           # User-uploaded files (images, etc.)
└── prepare_deploy.py  # Archive creation for deployment
```

### Technology Stack

**Frontend:**
- Vue 3 with Composition API
- TypeScript
- Vite (build tool)
- Pinia (state management)
- Vue Router
- UnoCSS (atomic CSS)
- Headless UI & Heroicons
- VeeValidate + Zod (form validation)
- Vitest (unit testing)
- Telegram WebApp API integration

**Backend:**
- Express.js
- better-sqlite3 (SQLite database)
- Telegraf (Telegram Bot Framework)
- JWT authentication
- Multer (file uploads)
- Sharp (image processing)
- bcryptjs (password hashing)
- Morgan (logging)
- Helmet + CORS (security)

**Deployment:**
- PM2 process manager (see `ecosystem.config.cjs`)
- Systemd services
- Nginx reverse proxy

### Key Architectural Concepts

#### Database Migrations
The project uses a migration-based approach for database schema changes. All migrations are in `server/migrations/` and are executed automatically on server startup via `db.js`. Migrations are idempotent and safe to run multiple times.

**Adding a new migration:**
1. Create a new file in `server/migrations/` following the naming convention (e.g., `add_<feature>_to_<table>.js`)
2. Export a function that checks if migration is needed and applies changes
3. Import and call the migration in `server/db.js` `initDb()` function

#### Telegram Integration
The frontend integrates deeply with Telegram's WebApp API:
- Fullscreen mode handling (v8.0+ API)
- Safe area insets for notched devices
- PostEvent API for native Telegram features
- Eruda debugging console in Telegram environment

The bot (`server/bot.js`) handles:
- Order creation from Telegram messages
- Customer management
- Product link parsing
- Duplicate order prevention
- Integration with main database

#### CRM System
The application includes a comprehensive CRM with:
- Customer tracking (linked to Telegram IDs)
- Order management with status history
- Payment tracking (paid/unpaid amounts)
- Profit calculations
- Finance reporting
- Operations dashboard

#### State Management
Pinia stores are organized by domain:
- `admin.ts` - Admin authentication and product/category management
- `catalog.ts` - Public catalog browsing
- `crm.ts` - CRM data and operations
- `settings.ts` - Application settings

## Environment Configuration

### Server Environment Variables (`.env`)
Create `server/.env` based on `server/.env.example`:

```bash
# Server
PORT=8080                                    # API server port
BASE_URL=https://your-domain.example         # Public URL
SESSION_SECRET=please_change_me              # JWT secret

# Database
DATABASE_FILE=./data/navalivay.db           # SQLite DB path

# Admin
ADMIN_CONFIG=./data/admin.json              # Admin credentials

# Telegram
BOT_TOKEN={{TELEGRAM_BOT_TOKEN}}            # Telegram Bot API token
MANAGER_USERNAME=@dmitriy_mityuk            # Default manager contact
```

### Frontend Environment Variables
Set `VITE_API_TARGET` to override the API proxy target (default: `http://127.0.0.1:8081`).

## Development Workflow

### Running the App Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   # Copy and edit server/.env
   cp server/.env.example server/.env
   # Edit with your values
   ```

3. **Start development servers:**
   ```bash
   npm run dev
   # Frontend: http://localhost:5173
   # Backend: http://localhost:8081
   ```

4. **With Telegram bot:**
   ```bash
   npm run dev:bot
   ```

### Testing Telegram Integration
- Use Telegram's Bot API to set webhook or use polling
- Test with ngrok or similar tunneling service for local development
- Eruda console auto-loads in Telegram WebApp for debugging

### Database Management
- Database auto-initializes on first run
- Seed data loaded from `server/seed/*.json` if tables are empty
- Manual backup: Use `ops/backup.sh` (Linux/macOS)
- Database location: `server/data/navalivay.db`

### Adding New Features

**New Product Field:**
1. Add migration in `server/migrations/`
2. Update `db.js` table schema if needed
3. Update seed data structure in `server/seed/products.json`
4. Update TypeScript types in `frontend/src/types/`
5. Update Pinia stores if necessary
6. Update UI components

**New API Route:**
1. Create or update route handler in `server/routes/`
2. Register router in `server/index.js`
3. Add corresponding API calls in frontend stores or composables
4. Update TypeScript types

## Deployment

### Production Deployment (Linux/Ubuntu)

The project is designed to run on Ubuntu with systemd services:

1. **Prepare deployment archive:**
   ```bash
   python prepare_deploy.py --format tar.gz
   ```

2. **Transfer and extract on server:**
   ```bash
   scp deploy_*.tar.gz user@server:/var/www/
   ssh user@server
   cd /var/www/
   tar -xzf deploy_*.tar.gz
   ```

3. **Run deployment script:**
   ```bash
   cd /var/www/NAVALIVAY
   ./ops/deploy.sh
   ```

The deploy script will:
- Pull latest code (if git repo)
- Install production dependencies
- Check configuration
- Create necessary directories
- Restart systemd services
- Verify health

### Systemd Services
- `navalivay-server.service` - Main API server
- `navalivay-bot.service` - Telegram bot

**Useful commands:**
```bash
# View logs
sudo journalctl -u navalivay-server -f
sudo journalctl -u navalivay-bot -f

# Restart services
sudo systemctl restart navalivay-server
sudo systemctl restart navalivay-bot

# Check status
sudo systemctl status navalivay-server
```

### PM2 (Alternative)
Can also be managed with PM2 using `server/ecosystem.config.cjs`:
```bash
pm2 start server/ecosystem.config.cjs
pm2 logs
pm2 restart navalivay-api
pm2 restart navalivay-bot
```

## Important Notes

### vite-plugin-vue-devtools Known Issue
**CRITICAL:** `vite-plugin-vue-devtools` is disabled in `frontend/vite.config.ts` due to a RouterView compatibility issue that causes: `"TypeError: Cannot set properties of null (setting '__vrv_devtools')"`. Do not re-enable without testing thoroughly.

### Windows Development
The project was developed on Windows but deploys to Linux. Be aware of:
- Line ending differences (CRLF vs LF)
- Path separator differences
- Shell script compatibility (use WSL or Git Bash for `.sh` scripts)

### Database Transactions
The server uses SQLite transactions for data integrity. When adding database operations that modify multiple tables, wrap them in `db.transaction()`.

### Image Handling
- Uploaded images are processed with Sharp (resizing, optimization)
- Images stored in `/uploads` directory
- Served statically with 7-day cache headers

### Admin Access
Admin credentials are stored in `server/data/admin.json` (bcrypt hashed). The system uses JWT tokens for authentication. Admin panel is at `/admin` route.

## Testing

- **Unit tests:** Frontend uses Vitest with happy-dom for Vue component testing
- Run tests before committing: `npm test`
- Always run linting: `npm run lint`

## Code Style

- Use Prettier for formatting (configured at root level)
- ESLint enforces Vue and TypeScript best practices
- Follow existing patterns in the codebase (especially component structure, store patterns, and route organization)
