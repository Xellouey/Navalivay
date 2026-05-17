import { db } from "../db.js";

function tableExists(table) {
  return Boolean(
    db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
      )
      .get(table),
  );
}

const DEFAULT_RARITIES = [
  {
    code: "nothing",
    label: "Ничего",
    bg_color: "#9AA0A6",
    text_color: "#FFFFFF",
    sort_order: 0,
    is_elite: 0,
  },
  {
    code: "common",
    label: "Обычный",
    bg_color: "#C8CDD3",
    text_color: "#1F2933",
    sort_order: 10,
    is_elite: 0,
  },
  {
    code: "rare",
    label: "Редкий",
    bg_color: "#3D5AFE",
    text_color: "#FFFFFF",
    sort_order: 20,
    is_elite: 0,
  },
  {
    code: "valuable",
    label: "Ценный",
    bg_color: "#9C27B0",
    text_color: "#FFFFFF",
    sort_order: 30,
    is_elite: 0,
  },
  {
    code: "epic",
    label: "Эпический",
    bg_color: "#FF6E40",
    text_color: "#FFFFFF",
    sort_order: 40,
    is_elite: 1,
  },
  {
    code: "mythic",
    label: "Мифический",
    bg_color: "#E91E63",
    text_color: "#FFFFFF",
    sort_order: 50,
    is_elite: 1,
  },
  {
    code: "gold",
    label: "Золотой",
    bg_color: "#F2B30A",
    text_color: "#1F2933",
    sort_order: 60,
    is_elite: 1,
  },
  {
    code: "legendary",
    label: "Легендарный",
    bg_color: "#FF1744",
    text_color: "#FFFFFF",
    sort_order: 70,
    is_elite: 1,
  },
];

const DEFAULT_SETTINGS = {
  spin_byn_retail: "40",
  spin_byn_wholesale: "200",
  pity_threshold: "3",
  default_promo_validity_days: "90",
  feed_size: "30",
  elite_rarities_json: JSON.stringify([
    "epic",
    "mythic",
    "gold",
    "legendary",
  ]),
};

export function migrateWheelPrizes() {
  try {
    if (!tableExists("wheel_rarities")) {
      db.exec(`
        CREATE TABLE wheel_rarities (
          code TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          bg_color TEXT NOT NULL,
          text_color TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_elite INTEGER NOT NULL DEFAULT 0
        );
      `);
    }

    if (!tableExists("wheel_prizes")) {
      db.exec(`
        CREATE TABLE wheel_prizes (
          id TEXT PRIMARY KEY,
          rarity_code TEXT NOT NULL REFERENCES wheel_rarities(code),
          title TEXT NOT NULL,
          description TEXT,
          image_url TEXT,
          weight REAL NOT NULL DEFAULT 1,
          max_total INTEGER NOT NULL DEFAULT 0,
          issued_count INTEGER NOT NULL DEFAULT 0,
          is_for_retail INTEGER NOT NULL DEFAULT 1,
          is_for_wholesale INTEGER NOT NULL DEFAULT 0,
          promo_template_id TEXT REFERENCES promo_codes(id) ON DELETE SET NULL,
          promo_validity_days INTEGER NOT NULL DEFAULT 90,
          epic_pool_size INTEGER NOT NULL DEFAULT 5,
          epic_pool_threshold_byn REAL NOT NULL DEFAULT 300,
          is_active INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
        );
        CREATE INDEX idx_wheel_prizes_rarity ON wheel_prizes(rarity_code);
        CREATE INDEX idx_wheel_prizes_active ON wheel_prizes(is_active);
      `);
    }

    if (!tableExists("wheel_customer_balances")) {
      db.exec(`
        CREATE TABLE wheel_customer_balances (
          customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
          spins_available INTEGER NOT NULL DEFAULT 0,
          accumulated_retail_byn REAL NOT NULL DEFAULT 0,
          accumulated_wholesale_byn REAL NOT NULL DEFAULT 0,
          consecutive_nothing INTEGER NOT NULL DEFAULT 0,
          last_synced_order_id TEXT,
          last_updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
        );
      `);
    }

    if (!tableExists("wheel_spins")) {
      db.exec(`
        CREATE TABLE wheel_spins (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          prize_id TEXT NOT NULL REFERENCES wheel_prizes(id),
          rarity_code TEXT NOT NULL,
          is_wholesale INTEGER NOT NULL DEFAULT 0,
          generated_promo_code_id TEXT REFERENCES promo_codes(id) ON DELETE SET NULL,
          generated_promo_code TEXT,
          promo_valid_until TEXT,
          is_epic_release INTEGER NOT NULL DEFAULT 0,
          is_pity_release INTEGER NOT NULL DEFAULT 0,
          seed_for_animation INTEGER NOT NULL,
          spun_at TEXT NOT NULL DEFAULT (DATETIME('now')),
          prize_used_at TEXT
        );
        CREATE INDEX idx_wheel_spins_customer ON wheel_spins(customer_id, spun_at DESC);
        CREATE INDEX idx_wheel_spins_promo ON wheel_spins(generated_promo_code_id);
        CREATE INDEX idx_wheel_spins_feed ON wheel_spins(spun_at DESC, rarity_code);
      `);
    }

    if (!tableExists("wheel_epic_pools")) {
      db.exec(`
        CREATE TABLE wheel_epic_pools (
          id TEXT PRIMARY KEY,
          prize_id TEXT NOT NULL REFERENCES wheel_prizes(id) ON DELETE CASCADE,
          pool_size INTEGER NOT NULL,
          threshold_byn REAL NOT NULL,
          qualified_customers_json TEXT NOT NULL DEFAULT '[]',
          is_active INTEGER NOT NULL DEFAULT 1,
          released_to_customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
          opened_at TEXT NOT NULL DEFAULT (DATETIME('now')),
          closed_at TEXT
        );
        CREATE INDEX idx_wheel_epic_pools_prize ON wheel_epic_pools(prize_id, is_active);
      `);
    }

    if (!tableExists("wheel_settings")) {
      db.exec(`
        CREATE TABLE wheel_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
        );
      `);
    }
  } catch (error) {
    console.error("[migration] Failed to create wheel tables:", error);
    throw error;
  }
}

export function seedDefaultWheelData() {
  try {
    const insertRarity = db.prepare(`
      INSERT OR IGNORE INTO wheel_rarities (code, label, bg_color, text_color, sort_order, is_elite)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const rarity of DEFAULT_RARITIES) {
      insertRarity.run(
        rarity.code,
        rarity.label,
        rarity.bg_color,
        rarity.text_color,
        rarity.sort_order,
        rarity.is_elite,
      );
    }

    const insertSetting = db.prepare(`
      INSERT OR IGNORE INTO wheel_settings (key, value, updated_at)
      VALUES (?, ?, DATETIME('now'))
    `);

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      insertSetting.run(key, value);
    }

    const startCollectingExists = db
      .prepare("SELECT value FROM wheel_settings WHERE key = 'start_collecting_at'")
      .get();
    if (!startCollectingExists) {
      db.prepare(
        `INSERT INTO wheel_settings (key, value, updated_at)
         VALUES ('start_collecting_at', ?, DATETIME('now'))`,
      ).run(new Date().toISOString());
    }
  } catch (error) {
    console.error("[migration] Failed to seed wheel defaults:", error);
    throw error;
  }
}
