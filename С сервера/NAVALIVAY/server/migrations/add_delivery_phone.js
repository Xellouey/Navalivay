import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../data/navalivay.db');
const db = new Database(dbPath);

console.log('[migration] Adding delivery_phone to orders table...');

try {
  // Проверяем, есть ли уже колонка
  const tableInfo = db.prepare("PRAGMA table_info(orders)").all();
  const hasDeliveryPhone = tableInfo.some(col => col.name === 'delivery_phone');

  if (!hasDeliveryPhone) {
    db.exec(`
      ALTER TABLE orders ADD COLUMN delivery_phone TEXT;
    `);
    console.log('[migration] ✓ Added delivery_phone column to orders table');
  } else {
    console.log('[migration] ✓ delivery_phone column already exists');
  }

  console.log('[migration] Migration completed successfully');
} catch (error) {
  console.error('[migration] Error:', error);
  process.exit(1);
}

db.close();
