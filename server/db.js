import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import slugify from 'slugify';
import { migrateHideEmpty } from './migrations/add_hide_empty_to_categories.js';
import { migrateTitleToBanners } from './migrations/add_title_to_banners.js';
import { migrateOpenInNewTabToBanners } from './migrations/add_open_in_new_tab_to_banners.js';
import { migrateSettingsTable } from './migrations/add_settings_table.js';
import { ensureProfitPasswordSetting } from './migrations/add_profit_password_setting.js';
import { fixCategorySlug } from './migrations/fix_category_slug.js';
import { removeManagerNameSetting } from './migrations/remove_manager_name_setting.js';
import { migrateCategoryGroupsAndCrossSells } from './migrations/add_category_groups_and_cross_sells.js';
import { migrateCategoryCoverImage } from './migrations/add_cover_image_to_categories.js';
import { migrateCategoryDisplayMode } from './migrations/add_display_mode_to_categories.js';
import { migrateCrmTables } from './migrations/add_crm_tables.js';
import { migrateOrderPaymentFields } from './migrations/add_payment_fields_to_orders.js';
import { migrateCategoryGroupHierarchy } from './migrations/add_parent_to_category_groups.js';
import { migrateOrderStatusHistory } from './migrations/add_order_status_history.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = process.env.DATABASE_FILE || path.resolve(__dirname, './data/navalivay.db');

// Ensure data dir exists
const dataDir = path.dirname(DB_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(DB_FILE);

export function initDb() {
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE,
      name TEXT NOT NULL,
      [order] INTEGER NOT NULL DEFAULT 0,
      cover_image TEXT,
      hide_empty INTEGER NOT NULL DEFAULT 0,
      display_mode TEXT NOT NULL DEFAULT 'default'
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      categoryId TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      groupId TEXT REFERENCES category_groups(id) ON DELETE SET NULL,
      title TEXT,
      priceRub INTEGER NOT NULL,
      description TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_images (
      productId TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (productId, position)
    );

    CREATE TABLE IF NOT EXISTS product_links (
      productId TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      label TEXT,
      url TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (productId, position)
    );

    CREATE TABLE IF NOT EXISTS category_groups (
      id TEXT PRIMARY KEY,
      categoryId TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      cover_image TEXT,
      [order] INTEGER NOT NULL DEFAULT 0,
      hide_empty INTEGER NOT NULL DEFAULT 0,
      parent_group_id TEXT REFERENCES category_groups(id) ON DELETE SET NULL,
      createdAt TEXT NOT NULL DEFAULT (DATETIME('now')),
      updatedAt TEXT NOT NULL DEFAULT (DATETIME('now')),
      UNIQUE(categoryId, slug)
    );

    CREATE TABLE IF NOT EXISTS category_cross_sells (
      id TEXT PRIMARY KEY,
      categoryId TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      productId TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      [order] INTEGER NOT NULL DEFAULT 0,
      UNIQUE(categoryId, productId)
    );

    CREATE TABLE IF NOT EXISTS banners (
      id TEXT PRIMARY KEY,
      image TEXT NOT NULL,
      href TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      [order] INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Выполняем миграции
  migrateHideEmpty();
  migrateTitleToBanners();
  migrateOpenInNewTabToBanners();
  migrateSettingsTable();
  ensureProfitPasswordSetting();
  fixCategorySlug();
  removeManagerNameSetting();
  migrateCategoryCoverImage();
  migrateCategoryDisplayMode();
  migrateCategoryGroupsAndCrossSells();
  migrateCategoryGroupHierarchy();
  migrateCrmTables();
  migrateOrderPaymentFields();
  migrateOrderStatusHistory();

  seedIfEmpty();
}

function seedIfEmpty() {
  const countCat = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
  const countProd = db.prepare('SELECT COUNT(*) as c FROM products').get().c;

  if (countCat === 0) {
    const categoriesPath = path.resolve(__dirname, './seed/categories.json');
    if (fs.existsSync(categoriesPath)) {
      const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
      const stmt = db.prepare('INSERT INTO categories (id, slug, name, [order]) VALUES (?, ?, ?, ?)');
      const tx = db.transaction((rows) => {
        for (const r of rows) {
          const slug = r.slug || slugify(r.name, { lower: true, strict: true, locale: 'ru' });
          stmt.run(r.id, slug, r.name, r.order ?? 0);
        }
      });
      tx(categories);
      console.log(`[navalivay:db] Seeded categories: ${categories.length}`);
    }
  }

  if (countProd === 0) {
    const productsPath = path.resolve(__dirname, './seed/products.json');
    if (fs.existsSync(productsPath)) {
      const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
      const stmtProd = db.prepare('INSERT INTO products (id, categoryId, title, priceRub, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
      const stmtImg = db.prepare('INSERT INTO product_images (productId, url, position) VALUES (?, ?, ?)');
      const tx = db.transaction((rows) => {
        for (const p of rows) {
          const createdAt = new Date().toISOString();
          stmtProd.run(p.id, p.categoryId, p.title || null, p.priceRub, p.description || null, createdAt);
          if (Array.isArray(p.images)) {
            p.images.forEach((url, idx) => stmtImg.run(p.id, url, idx));
          }
        }
      });
      tx(products);
      console.log(`[navalivay:db] Seeded products: ${products.length}`);
    }
  }

  // Seed banners
  const countBanners = db.prepare('SELECT COUNT(*) as c FROM banners').get().c;
  if (countBanners === 0) {
    const bannersPath = path.resolve(__dirname, './seed/banners.json');
    if (fs.existsSync(bannersPath)) {
      const banners = JSON.parse(fs.readFileSync(bannersPath, 'utf8'));
      const stmt = db.prepare('INSERT INTO banners (id, image, href, active, [order]) VALUES (?, ?, ?, ?, ?)');
      const tx = db.transaction((rows) => {
        for (const b of rows) {
          stmt.run(b.id, b.image, b.href || null, b.active ? 1 : 0, b.order || 0);
        }
      });
      tx(banners);
      console.log(`[navalivay:db] Seeded banners: ${banners.length}`);
    }
  }
}