import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "navalivay-wheel-epic-"));
const tempDbPath = path.join(tempDir, "test.db");

process.env.DATABASE_FILE = tempDbPath;
process.env.BOT_TOKEN = "test-bot-token";
process.env.NODE_ENV = "test";

const { initDb, db } = await import("../db.js");
const {
  spinWheelForCustomer,
  registerCustomerProfitForEpicPools,
} = await import("../wheel/wheel-service.js");

initDb();

function ensureCustomer(id) {
  db.prepare(
    `INSERT OR IGNORE INTO customers (id, telegram_id, telegram_username, first_name, last_name, last_visit_at)
     VALUES (?, ?, ?, 'Test', 'User', DATETIME('now'))`,
  ).run(id, id, `epic_${id}`);
}

function setBalance(customerId, spins) {
  db.prepare(
    `INSERT INTO wheel_customer_balances (
      customer_id, spins_available, accumulated_retail_byn,
      accumulated_wholesale_byn, consecutive_nothing, last_updated_at
    ) VALUES (?, ?, 0, 0, 0, DATETIME('now'))
    ON CONFLICT(customer_id) DO UPDATE SET
      spins_available = excluded.spins_available`,
  ).run(customerId, spins);
}

function clearWheelData() {
  db.exec(`
    DELETE FROM wheel_spins;
    DELETE FROM wheel_epic_pools;
    DELETE FROM wheel_prizes;
    DELETE FROM wheel_customer_balances;
    DELETE FROM orders;
  `);
}

function insertPrize(prize) {
  db.prepare(
    `INSERT INTO wheel_prizes (
      id, rarity_code, title, description, weight, max_total, issued_count,
      is_for_retail, is_for_wholesale, promo_validity_days, epic_pool_size,
      epic_pool_threshold_byn, is_active, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, 0, 90, ?, ?, 1, ?)`,
  ).run(
    prize.id,
    prize.rarity_code,
    prize.title,
    null,
    prize.weight,
    prize.max_total ?? 0,
    prize.epic_pool_size ?? 5,
    prize.epic_pool_threshold_byn ?? 300,
    prize.sort_order ?? 0,
  );
}

function makeDeliveredOrder(orderId, customerId, profit, finalAmount = 600) {
  db.prepare(
    `INSERT INTO orders (
      id, order_number, customer_id, status, delivery_type,
      total_amount, final_amount, profit, completed_at, created_at,
      promo_code_text, is_wholesale
    ) VALUES (?, ?, ?, 'delivered', 'pickup', ?, ?, ?, DATETIME('now'), DATETIME('now'), NULL, 0)`,
  ).run(orderId, orderId, customerId, finalAmount, finalAmount, profit);
}

async function testEpicPoolReleasesToFirstSpinAfterThreshold() {
  clearWheelData();
  insertPrize({ id: "p_nothing", rarity_code: "nothing", title: "Ничего", weight: 100 });
  insertPrize({
    id: "p_epic",
    rarity_code: "legendary",
    title: "Легендарный приз",
    weight: 0,
    max_total: 1,
    epic_pool_size: 5,
    epic_pool_threshold_byn: 300,
  });

  // 5 customers cross profit threshold.
  for (let i = 1; i <= 5; i += 1) {
    const cid = `cust_epic_${i}`;
    ensureCustomer(cid);
    makeDeliveredOrder(`order_epic_${i}`, cid, 350);
    registerCustomerProfitForEpicPools(cid);
  }

  // Add a 6th customer who is not qualified (profit below threshold).
  ensureCustomer("cust_epic_low");
  makeDeliveredOrder("order_epic_low", "cust_epic_low", 100);
  registerCustomerProfitForEpicPools("cust_epic_low");

  const pool = db
    .prepare("SELECT * FROM wheel_epic_pools WHERE prize_id = 'p_epic' AND is_active = 1")
    .get();
  assert.ok(pool, "epic pool must exist");
  const qualified = JSON.parse(pool.qualified_customers_json);
  assert.equal(qualified.length, 5);
  assert.ok(!qualified.includes("cust_epic_low"));

  // First customer to spin gets the epic prize.
  setBalance("cust_epic_1", 1);
  const result = spinWheelForCustomer({ customerId: "cust_epic_1" });
  assert.equal(result.prize.rarity_code, "legendary");
  assert.equal(result.isEpicRelease, true);

  const refreshed = db
    .prepare("SELECT * FROM wheel_epic_pools WHERE id = ?")
    .get(pool.id);
  assert.equal(refreshed.is_active, 0);
  assert.equal(refreshed.released_to_customer_id, "cust_epic_1");

  // Prize with max_total = 1 should be deactivated.
  const prize = db.prepare("SELECT * FROM wheel_prizes WHERE id = 'p_epic'").get();
  assert.equal(prize.is_active, 0);
}

async function testEpicPoolResetsWhenPrizeAllowsMultipleReleases() {
  clearWheelData();
  insertPrize({ id: "p_nothing", rarity_code: "nothing", title: "Ничего", weight: 100 });
  insertPrize({
    id: "p_epic_repeat",
    rarity_code: "epic",
    title: "Эпический повторяющийся",
    weight: 0,
    max_total: 0, // unlimited
    epic_pool_size: 3,
    epic_pool_threshold_byn: 200,
  });

  for (let i = 1; i <= 3; i += 1) {
    const cid = `cust_repeat_${i}`;
    ensureCustomer(cid);
    makeDeliveredOrder(`order_repeat_${i}`, cid, 250);
    registerCustomerProfitForEpicPools(cid);
  }

  setBalance("cust_repeat_1", 1);
  const first = spinWheelForCustomer({ customerId: "cust_repeat_1" });
  assert.equal(first.isEpicRelease, true);

  const remainingPool = db
    .prepare(
      "SELECT * FROM wheel_epic_pools WHERE prize_id = 'p_epic_repeat' AND is_active = 1",
    )
    .get();
  // After the release the prize is unlimited so spinning should not yet have a
  // new active pool. registerCustomerProfitForEpicPools recreates one when
  // somebody qualifies again.
  if (remainingPool) {
    const list = JSON.parse(remainingPool.qualified_customers_json);
    assert.equal(list.length, 0);
  }

  // Prize stays active because max_total = 0.
  const prize = db.prepare("SELECT * FROM wheel_prizes WHERE id = 'p_epic_repeat'").get();
  assert.equal(prize.is_active, 1);
}

async function main() {
  await testEpicPoolReleasesToFirstSpinAfterThreshold();
  await testEpicPoolResetsWhenPrizeAllowsMultipleReleases();
  console.log("[wheel-epic] OK");
}

try {
  await main();
} finally {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
