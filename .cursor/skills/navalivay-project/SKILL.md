---
name: navalivay-project
description: Work with NAVALIVAY e-commerce project following project-specific patterns. Use when working on database migrations, API routes, Vue components, or any NAVALIVAY-specific code. Applies ES Modules patterns, SQLite conventions, Pinia store patterns, and project architecture rules.
---

# NAVALIVAY Project Assistant

This skill helps you work with the NAVALIVAY e-commerce Telegram Mini App project following its specific patterns and conventions.

## Critical Project Rules

### Backend: ES Modules Only
**ALWAYS use ES Modules, NEVER CommonJS:**
```javascript
// ✅ CORRECT
import express from 'express';
import { db } from '../db.js';

// ❌ WRONG - will cause ReferenceError
const express = require('express');
```

### Database Queries
Use SQLite with prepared statements:
```javascript
import { db } from '../db.js';

// Query
const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
const rows = db.prepare('SELECT * FROM products').all();

// Insert/Update
db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);

// Transaction
const tx = db.transaction(() => {
  // multiple operations
});
tx();
```

**Critical:** When writing INSERT, ensure number of `?` placeholders matches values in `.run()`.

### API Response Format
- Use `snake_case` in SQL, map to `camelCase` in frontend
- List APIs do NOT return base64 images (performance optimization)
- Images loaded separately via dedicated endpoints

### Frontend: Vue 3 + Pinia
- Use Pinia stores for state management
- Replace entire arrays for reactivity (don't mutate by index)
- Use `allProducts` for complete data, `products` for paginated

## Common Tasks

### Creating Database Migrations
1. Create file in `server/migrations/add_feature_name.js`
2. Use ES Modules: `import { db } from '../db.js'`
3. Export migration function
4. Register in `server/db.js`

Example:
```javascript
import { db } from '../db.js';

export function migrateFeatureName() {
  const exists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='new_table'
  `).get();
  
  if (!exists) {
    db.exec(`
      CREATE TABLE new_table (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);
  }
}
```

### Creating API Routes
1. Use ES Modules
2. Import router: `import express from 'express'; export const router = express.Router();`
3. Use `authMiddleware` for admin routes
4. Map snake_case to camelCase in responses

### Working with Product Variants
- Check `has_variants` flag
- For variant products, check `product_variants.stock`, NOT `products.stock`
- Cart stores `variantId` - pass to backend as `variant_id`

### Image Handling
- All images auto-converted to WebP (800x800px, quality 80%)
- Category/group images NOT in list responses
- Use separate endpoints: `/api/categories/:id/image`

## File Locations Quick Reference

| What | Where |
|------|-------|
| Order API | `server/routes/crm-operations.js` |
| Public API | `server/routes/public.js` |
| Admin API | `server/routes/admin.js` |
| CRM Products Search | `server/routes/crm-finance.js` |
| Database | `server/data/navalivay.db` |
| Cart Store | `frontend/src/stores/cart.ts` |
| CRM Store | `frontend/src/stores/crm.ts` |
| Catalog Store | `frontend/src/stores/catalog.ts` |

## Debugging

### Backend
- Add `console.log()` statements
- Restart server after changes
- Check `/tmp/server.log`

### Frontend
- Add `console.log()` statements
- Rebuild frontend: `npm run build-only`
- Check browser DevTools

### Database
```bash
cd server/data
sqlite3 navalivay.db
.tables
.schema orders
```

## Performance Notes
- Response size should be < 100 KB for list APIs
- Images loaded separately, not in list responses
- Use WebP format for all images
- Check response size in server logs if slow
