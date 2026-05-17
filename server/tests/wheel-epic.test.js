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

  // Q4: prize is unlimited (max_total = 0) and 2 customers are still
  // qualified after the winner is removed. Carry-over creates a new
  // active pool with those 2 members so the next time either of them
  // spins they get the prize guaranteed.
  const remainingPool = db
    .prepare(
      "SELECT * FROM wheel_epic_pools WHERE prize_id = 'p_epic_repeat' AND is_active = 1",
    )
    .get();
  assert.ok(remainingPool, "carry-over pool must be created when capacity remains");
  const carryList = JSON.parse(remainingPool.qualified_customers_json);
  assert.equal(carryList.length, 2);
  assert.ok(!carryList.includes("cust_repeat_1"), "winner must be removed from carry-over");
  assert.ok(carryList.includes("cust_repeat_2"));
  assert.ok(carryList.includes("cust_repeat_3"));
  // Carry-over pool_size matches the number of carried members so the
  // next spin from any of them releases the prize immediately.
  assert.equal(remainingPool.pool_size, 2);

  // Prize stays active because max_total = 0.
  const prize = db.prepare("SELECT * FROM wheel_prizes WHERE id = 'p_epic_repeat'").get();
  assert.equal(prize.is_active, 1);
}

// Q4: epic with max_total > 1 (e.g. 3) — after the first release, the
// remaining qualified customers carry over to a new active pool, do not
// have to re-cross the threshold, and the very next spin from any of
// them releases the prize.
async function testEpicMaxTotal3CarriesOverNonWinners() {
  clearWheelData();
  insertPrize({ id: "p_nothing", rarity_code: "nothing", title: "Ничего", weight: 100 });
  insertPrize({
    id: "p_epic_three",
    rarity_code: "mythic",
    title: "Эпический x3",
    weight: 0,
    max_total: 3,
    epic_pool_size: 5,
    epic_pool_threshold_byn: 200,
  });

  for (let i = 1; i <= 5; i += 1) {
    const cid = `cust_carry_${i}`;
    ensureCustomer(cid);
    makeDeliveredOrder(`order_carry_${i}`, cid, 250);
    registerCustomerProfitForEpicPools(cid);
  }

  const initialPool = db
    .prepare(
      "SELECT * FROM wheel_epic_pools WHERE prize_id = 'p_epic_three' AND is_active = 1",
    )
    .get();
  assert.ok(initialPool);
  assert.equal(JSON.parse(initialPool.qualified_customers_json).length, 5);

  // First spin: customer 1 wins.
  setBalance("cust_carry_1", 1);
  const first = spinWheelForCustomer({ customerId: "cust_carry_1" });
  assert.equal(first.isEpicRelease, true);
  assert.equal(first.prize.id, "p_epic_three");

  // Carry-over pool created with the remaining 4 customers.
  const carryPool = db
    .prepare(
      "SELECT * FROM wheel_epic_pools WHERE prize_id = 'p_epic_three' AND is_active = 1",
    )
    .get();
  assert.ok(carryPool);
  assert.notEqual(carryPool.id, initialPool.id);
  const carriedList = JSON.parse(carryPool.qualified_customers_json);
  assert.equal(carriedList.length, 4);
  assert.ok(!carriedList.includes("cust_carry_1"));
  assert.equal(carryPool.pool_size, 4);

  // Prize is still active (issued_count = 1 < max_total = 3).
  const prizeAfterFirst = db
    .prepare("SELECT * FROM wheel_prizes WHERE id = 'p_epic_three'")
    .get();
  assert.equal(prizeAfterFirst.is_active, 1);
  assert.equal(prizeAfterFirst.issued_count, 1);

  // Next spin from any carry-over member releases the prize guaranteed.
  setBalance("cust_carry_2", 1);
  const second = spinWheelForCustomer({ customerId: "cust_carry_2" });
  assert.equal(second.isEpicRelease, true);
  assert.equal(second.prize.id, "p_epic_three");

  // After second release: 3 customers carry over again.
  const thirdPool = db
    .prepare(
      "SELECT * FROM wheel_epic_pools WHERE prize_id = 'p_epic_three' AND is_active = 1",
    )
    .get();
  assert.ok(thirdPool);
  const thirdList = JSON.parse(thirdPool.qualified_customers_json);
  assert.equal(thirdList.length, 3);
  assert.equal(thirdPool.pool_size, 3);

  // Third spin → max_total reached → prize deactivated → no carry-over.
  setBalance("cust_carry_3", 1);
  const third = spinWheelForCustomer({ customerId: "cust_carry_3" });
  assert.equal(third.isEpicRelease, true);

  const finalPrize = db
    .prepare("SELECT * FROM wheel_prizes WHERE id = 'p_epic_three'")
    .get();
  assert.equal(finalPrize.is_active, 0, "prize must deactivate at max_total");
  assert.equal(finalPrize.issued_count, 3);

  const noNewPool = db
    .prepare(
      "SELECT * FROM wheel_epic_pools WHERE prize_id = 'p_epic_three' AND is_active = 1",
    )
    .get();
  assert.equal(noNewPool, undefined, "no carry-over pool when max_total reached");
}

// Q4: max_total = 1 must not carry over — single-issue prize is consumed.
async function testEpicMaxTotal1NoCarryOver() {
  clearWheelData();
  insertPrize({ id: "p_nothing", rarity_code: "nothing", title: "Ничего", weight: 100 });
  insertPrize({
    id: "p_epic_single",
    rarity_code: "legendary",
    title: "Single-issue legendary",
    weight: 0,
    max_total: 1,
    epic_pool_size: 3,
    epic_pool_threshold_byn: 200,
  });

  for (let i = 1; i <= 3; i += 1) {
    const cid = `cust_single_${i}`;
    ensureCustomer(cid);
    makeDeliveredOrder(`order_single_${i}`, cid, 250);
    registerCustomerProfitForEpicPools(cid);
  }

  setBalance("cust_single_1", 1);
  const result = spinWheelForCustomer({ customerId: "cust_single_1" });
  assert.equal(result.isEpicRelease, true);

  // Prize deactivated and no carry-over pool created — single-issue
  // prizes do not roll forward.
  const prize = db
    .prepare("SELECT * FROM wheel_prizes WHERE id = 'p_epic_single'")
    .get();
  assert.equal(prize.is_active, 0);

  const anyActive = db
    .prepare(
      "SELECT * FROM wheel_epic_pools WHERE prize_id = 'p_epic_single' AND is_active = 1",
    )
    .get();
  assert.equal(anyActive, undefined);
}

async function main() {
  await testEpicPoolReleasesToFirstSpinAfterThreshold();
  await testEpicPoolResetsWhenPrizeAllowsMultipleReleases();
  await testEpicMaxTotal3CarriesOverNonWinners();
  await testEpicMaxTotal1NoCarryOver();
  console.log("[wheel-epic] OK");
}

try {
  await main();
} finally {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
