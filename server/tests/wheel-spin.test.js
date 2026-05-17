import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "navalivay-wheel-spin-"));
const tempDbPath = path.join(tempDir, "test.db");

process.env.DATABASE_FILE = tempDbPath;
process.env.BOT_TOKEN = "test-bot-token";
process.env.NODE_ENV = "test";

const { initDb, db } = await import("../db.js");
const {
  spinWheelForCustomer,
  getWheelSettings,
  updateWheelSettings,
} = await import("../wheel/wheel-service.js");

initDb();

function makeRng(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function ensureCustomer(id, telegramId = id) {
  db.prepare(
    `INSERT OR IGNORE INTO customers (id, telegram_id, telegram_username, first_name, last_name, last_visit_at)
     VALUES (?, ?, ?, 'Test', 'User', DATETIME('now'))`,
  ).run(id, telegramId, `wheel_${id}`);
}

function setBalance(customerId, spins, consecutiveNothing = 0) {
  db.prepare(
    `INSERT INTO wheel_customer_balances (
      customer_id, spins_available, accumulated_retail_byn,
      accumulated_wholesale_byn, consecutive_nothing, last_updated_at
    ) VALUES (?, ?, 0, 0, ?, DATETIME('now'))
    ON CONFLICT(customer_id) DO UPDATE SET
      spins_available = excluded.spins_available,
      consecutive_nothing = excluded.consecutive_nothing`,
  ).run(customerId, spins, consecutiveNothing);
}

function clearWheelData() {
  db.exec(`
    DELETE FROM wheel_spins;
    DELETE FROM wheel_epic_pools;
    DELETE FROM wheel_prizes;
    DELETE FROM wheel_customer_balances;
  `);
}

function insertPrize(prize) {
  db.prepare(
    `INSERT INTO wheel_prizes (
      id, rarity_code, title, description, weight, max_total, issued_count,
      is_for_retail, is_for_wholesale, promo_validity_days, epic_pool_size,
      epic_pool_threshold_byn, is_active, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 90, 5, 300, 1, ?)`,
  ).run(
    prize.id,
    prize.rarity_code,
    prize.title,
    prize.description || null,
    prize.weight,
    prize.max_total ?? 0,
    prize.is_for_retail ?? 1,
    prize.is_for_wholesale ?? 0,
    prize.sort_order ?? 0,
  );
}

function seedBasicPool() {
  clearWheelData();
  insertPrize({ id: "p_nothing", rarity_code: "nothing", title: "Ничего", weight: 60, sort_order: 0 });
  insertPrize({ id: "p_common", rarity_code: "common", title: "Обычный", weight: 25, sort_order: 1 });
  insertPrize({ id: "p_rare", rarity_code: "rare", title: "Редкий", weight: 10, sort_order: 2 });
  insertPrize({ id: "p_valuable", rarity_code: "valuable", title: "Ценный", weight: 4, sort_order: 3 });
  insertPrize({ id: "p_legendary", rarity_code: "legendary", title: "Легендарный", weight: 1, sort_order: 4 });
}

async function testWeightedDistribution() {
  seedBasicPool();
  // Disable pity for pure distribution measurement.
  updateWheelSettings({ pity_threshold: 999999 });
  const customerId = "cust-spin-stat";
  ensureCustomer(customerId);
  setBalance(customerId, 10000);

  const rng = makeRng(42);
  const counts = {};
  for (let i = 0; i < 10000; i += 1) {
    const result = spinWheelForCustomer({ customerId, rng });
    counts[result.prize.rarity_code] = (counts[result.prize.rarity_code] || 0) + 1;
  }

  // Restore default pity for subsequent tests.
  updateWheelSettings({ pity_threshold: 3 });

  // Total weight = 100. Allow up to 5% absolute variance.
  const expectedShares = {
    nothing: 0.6,
    common: 0.25,
    rare: 0.1,
    valuable: 0.04,
    legendary: 0.01,
  };
  for (const [code, expected] of Object.entries(expectedShares)) {
    const actual = (counts[code] || 0) / 10000;
    assert.ok(
      Math.abs(actual - expected) < 0.05,
      `rarity ${code} share ${actual.toFixed(3)} too far from expected ${expected}`,
    );
  }
}

async function testPityTriggersAfterThresholdNothings() {
  seedBasicPool();
  // Pump nothing to dominate
  db.prepare("UPDATE wheel_prizes SET weight = 0 WHERE id != 'p_nothing'").run();

  const customerId = "cust-spin-pity";
  ensureCustomer(customerId);
  setBalance(customerId, 5);

  const rng = makeRng(1);
  const settings = getWheelSettings();
  // Spin pity_threshold times: all nothing.
  for (let i = 0; i < settings.pity_threshold; i += 1) {
    const result = spinWheelForCustomer({ customerId, rng });
    assert.equal(result.prize.rarity_code, "nothing");
  }

  // Re-enable common so pity has something to pick.
  db.prepare("UPDATE wheel_prizes SET weight = 1 WHERE id = 'p_common'").run();

  const result = spinWheelForCustomer({ customerId, rng });
  assert.equal(result.isPityRelease, true);
  assert.notEqual(result.prize.rarity_code, "nothing");
}

async function testMaxTotalExhaustionStopsPrize() {
  seedBasicPool();
  // Cap legendary at 1.
  db.prepare("UPDATE wheel_prizes SET max_total = 1, weight = 100 WHERE id = 'p_legendary'").run();
  db.prepare("UPDATE wheel_prizes SET weight = 0 WHERE id != 'p_legendary'").run();

  const customerId = "cust-spin-cap";
  ensureCustomer(customerId);
  setBalance(customerId, 3);

  const rng = makeRng(7);
  const first = spinWheelForCustomer({ customerId, rng });
  assert.equal(first.prize.rarity_code, "legendary");

  const issued = db.prepare("SELECT issued_count FROM wheel_prizes WHERE id = 'p_legendary'").get();
  assert.equal(issued.issued_count, 1);

  // Re-enable common as fallback so engine has any non-zero option.
  db.prepare("UPDATE wheel_prizes SET weight = 1 WHERE id = 'p_common'").run();

  const second = spinWheelForCustomer({ customerId, rng });
  assert.notEqual(second.prize.rarity_code, "legendary");
}

async function testNotEnoughSpins() {
  seedBasicPool();
  const customerId = "cust-spin-zero";
  ensureCustomer(customerId);
  setBalance(customerId, 0);
  assert.throws(() => spinWheelForCustomer({ customerId }), {
    code: "not_enough_spins",
  });
}

async function main() {
  // Make sure default settings reflect base test assumptions.
  updateWheelSettings({
    spin_byn_retail: 40,
    spin_byn_wholesale: 200,
    pity_threshold: 3,
    default_promo_validity_days: 90,
    feed_size: 30,
    elite_rarities: ["epic", "mythic", "gold", "legendary"],
  });

  await testWeightedDistribution();
  await testPityTriggersAfterThresholdNothings();
  await testMaxTotalExhaustionStopsPrize();
  await testNotEnoughSpins();

  console.log("[wheel-spin] OK");
}

try {
  await main();
} finally {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
