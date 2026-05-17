import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "navalivay-wheel-balance-"));
const tempDbPath = path.join(tempDir, "test.db");

process.env.DATABASE_FILE = tempDbPath;
process.env.BOT_TOKEN = "test-bot-token";
process.env.NODE_ENV = "test";

const { initDb, db } = await import("../db.js");
const { accrueWheelSpinsForOrder, updateWheelSettings } = await import(
  "../wheel/wheel-service.js"
);

initDb();

function ensureCustomer(id) {
  db.prepare(
    `INSERT OR IGNORE INTO customers (id, telegram_id, telegram_username, first_name, last_name, last_visit_at)
     VALUES (?, ?, ?, 'Test', 'User', DATETIME('now'))`,
  ).run(id, id, `bal_${id}`);
}

function clearWheelData() {
  db.exec(`
    DELETE FROM wheel_spins;
    DELETE FROM wheel_epic_pools;
    DELETE FROM wheel_customer_balances;
    DELETE FROM orders;
  `);
}

function makeDelivered(orderId, customerId, finalAmount, isWholesale = false) {
  db.prepare(
    `INSERT INTO orders (
      id, order_number, customer_id, status, delivery_type,
      total_amount, final_amount, profit, completed_at, created_at,
      promo_code_text, is_wholesale
    ) VALUES (?, ?, ?, 'delivered', 'pickup', ?, ?, ?, DATETIME('now'), DATETIME('now'), NULL, ?)`,
  ).run(
    orderId,
    orderId,
    customerId,
    finalAmount,
    finalAmount,
    Math.round(finalAmount * 0.3),
    isWholesale ? 1 : 0,
  );
}

function getBalance(customerId) {
  return db
    .prepare("SELECT * FROM wheel_customer_balances WHERE customer_id = ?")
    .get(customerId);
}

async function testRetailEightyByn() {
  clearWheelData();
  const cid = "cust_retail_80";
  ensureCustomer(cid);
  makeDelivered("ord_80", cid, 80);
  const result = accrueWheelSpinsForOrder("ord_80");
  assert.equal(result.accrued, true);
  assert.equal(result.spins_added, 2);
  const balance = getBalance(cid);
  assert.equal(balance.spins_available, 2);
  assert.equal(Number(balance.accumulated_retail_byn), 0);
}

async function testRetailFiftyByn() {
  clearWheelData();
  const cid = "cust_retail_50";
  ensureCustomer(cid);
  makeDelivered("ord_50", cid, 50);
  const result = accrueWheelSpinsForOrder("ord_50");
  assert.equal(result.accrued, true);
  assert.equal(result.spins_added, 1);
  const balance = getBalance(cid);
  assert.equal(balance.spins_available, 1);
  assert.equal(Number(balance.accumulated_retail_byn), 10);
}

async function testRetailUnderThreshold() {
  clearWheelData();
  const cid = "cust_retail_39";
  ensureCustomer(cid);
  makeDelivered("ord_39", cid, 39);
  const result = accrueWheelSpinsForOrder("ord_39");
  assert.equal(result.accrued, true);
  assert.equal(result.spins_added, 0);
  const balance = getBalance(cid);
  assert.equal(balance.spins_available, 0);
  assert.equal(Number(balance.accumulated_retail_byn), 39);
}

async function testWholesaleAccrual() {
  clearWheelData();
  const cid = "cust_wholesale_250";
  ensureCustomer(cid);
  makeDelivered("ord_250", cid, 250, true);
  const result = accrueWheelSpinsForOrder("ord_250");
  assert.equal(result.accrued, true);
  assert.equal(result.spins_added, 1);
  const balance = getBalance(cid);
  assert.equal(balance.spins_available, 1);
  assert.equal(Number(balance.accumulated_wholesale_byn), 50);
  assert.equal(Number(balance.accumulated_retail_byn), 0);
}

async function testIdempotentAccrual() {
  clearWheelData();
  const cid = "cust_idempotent";
  ensureCustomer(cid);
  makeDelivered("ord_dup", cid, 60);
  accrueWheelSpinsForOrder("ord_dup");
  const second = accrueWheelSpinsForOrder("ord_dup");
  assert.equal(second.accrued, false);
  assert.equal(second.reason, "already_synced");
  const balance = getBalance(cid);
  assert.equal(balance.spins_available, 1);
  assert.equal(Number(balance.accumulated_retail_byn), 20);
}

async function testBeforeReleaseDoesNotAccrue() {
  clearWheelData();
  // Force start_collecting_at into the future.
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  updateWheelSettings({ start_collecting_at: future });

  const cid = "cust_before_release";
  ensureCustomer(cid);
  makeDelivered("ord_history", cid, 200);
  const result = accrueWheelSpinsForOrder("ord_history");
  assert.equal(result.accrued, false);
  assert.equal(result.reason, "before_release");

  // Reset for any later test.
  updateWheelSettings({ start_collecting_at: new Date(0).toISOString() });
}

async function main() {
  updateWheelSettings({
    spin_byn_retail: 40,
    spin_byn_wholesale: 200,
    pity_threshold: 3,
    default_promo_validity_days: 90,
    feed_size: 30,
    elite_rarities: ["epic", "mythic", "gold", "legendary"],
    start_collecting_at: new Date(0).toISOString(),
  });
  await testRetailEightyByn();
  await testRetailFiftyByn();
  await testRetailUnderThreshold();
  await testWholesaleAccrual();
  await testIdempotentAccrual();
  await testBeforeReleaseDoesNotAccrue();
  console.log("[wheel-balance] OK");
}

try {
  await main();
} finally {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
