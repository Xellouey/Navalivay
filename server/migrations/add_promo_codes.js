import { db } from '../db.js';

export function migratePromoCodes() {
  try {
    // Create promo_codes table
    db.exec(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE COLLATE NOCASE,
        description TEXT,
        discount_type TEXT NOT NULL DEFAULT 'fixed',
        discount_value REAL NOT NULL,
        min_order_amount REAL DEFAULT 0,
        max_uses INTEGER DEFAULT 1,
        current_uses INTEGER DEFAULT 0,
        valid_from TEXT,
        valid_until TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (DATETIME('now'))
      )
    `);

    // Create promo_usage table
    db.exec(`
      CREATE TABLE IF NOT EXISTS promo_usage (
        id TEXT PRIMARY KEY,
        promo_code_id TEXT NOT NULL REFERENCES promo_codes(id),
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        customer_id TEXT REFERENCES customers(id),
        discount_applied REAL NOT NULL,
        used_at TEXT DEFAULT (DATETIME('now'))
      )
    `);

    // Indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_promo_usage_order ON promo_usage(order_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_promo_usage_promo ON promo_usage(promo_code_id)`);

    // Add promo fields to orders
    const columns = db.prepare(`PRAGMA table_info(orders)`).all();
    const columnNames = columns.map((col) => col.name);

    if (!columnNames.includes('promo_code_id')) {
      console.log('[migration] Adding promo_code_id column to orders table');
      db.exec(`ALTER TABLE orders ADD COLUMN promo_code_id TEXT`);
    }

    if (!columnNames.includes('promo_code_text')) {
      console.log('[migration] Adding promo_code_text column to orders table');
      db.exec(`ALTER TABLE orders ADD COLUMN promo_code_text TEXT`);
    }

    console.log('[migration] Promo codes migration completed successfully');
  } catch (error) {
    console.error('[migration] Promo codes migration failed:', error);
    if (!String(error.message).includes('duplicate column name') && !String(error.message).includes('already exists')) {
      throw error;
    }
  }
}
