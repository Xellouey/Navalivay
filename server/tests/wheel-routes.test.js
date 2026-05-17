import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

import { telegramHeaders } from "./helpers/telegram-auth.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "navalivay-wheel-routes-"));
const tempDbPath = path.join(tempDir, "test.db");

process.env.DATABASE_FILE = tempDbPath;
process.env.BOT_TOKEN = "test-bot-token";
process.env.NODE_ENV = "test";
process.env.ALLOW_INSECURE_TELEGRAM_AUTH = "0";

const { initDb, db } = await import("../db.js");
const { wheelRouter } = await import("../routes/wheel.js");

initDb();

const app = express();
app.use(express.json());
app.use(wheelRouter);

const server = await new Promise((resolve) => {
  const instance = app.listen(0, () => resolve(instance));
});
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

async function requestJson(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, options);
  const data = await response.json().catch(() => null);
  return { response, data };
}

function ensureCustomer(id, telegramId, username) {
  db.prepare(
    `INSERT OR IGNORE INTO customers (
      id, telegram_id, telegram_username, first_name, last_name, last_visit_at, photo_url
    ) VALUES (?, ?, ?, 'Test', 'User', DATETIME('now'), 'https://t.me/i/userpic/test.png')`,
  ).run(id, String(telegramId), username);
}

function insertPrize(prizeId, rarityCode, isForRetail, isForWholesale) {
  db.prepare(
    `INSERT OR IGNORE INTO wheel_prizes (
      id, rarity_code, title, description, weight, max_total, issued_count,
      is_for_retail, is_for_wholesale, promo_validity_days, epic_pool_size,
      epic_pool_threshold_byn, is_active, sort_order, created_at
    ) VALUES (?, ?, ?, NULL, 1, 0, 0, ?, ?, 90, 5, 300, 1, 0, DATETIME('now'))`,
  ).run(prizeId, rarityCode, `Prize ${rarityCode}`, isForRetail, isForWholesale);
}

function insertSpin(spinId, customerId, prizeId, rarityCode) {
  db.prepare(
    `INSERT INTO wheel_spins (
      id, customer_id, prize_id, rarity_code, is_wholesale,
      seed_for_animation, spun_at
    ) VALUES (?, ?, ?, ?, 0, 1, DATETIME('now'))`,
  ).run(spinId, customerId, prizeId, rarityCode);
}

// B1 regression: /api/wheel/state was 500'ing whenever the live feed
// query had to materialize even a single row, because the SQL referenced
// a non-existent c.customer_photo column. The first time this is hit on
// a customer-facing screen is the first time anyone wins anything.
async function testWheelStateWorksWithRealLiveFeed() {
  ensureCustomer("cust_state_1", "777111", "wheel_state_1");
  insertPrize("p_common_state", "common", 1, 0);
  insertSpin("spin_state_1", "cust_state_1", "p_common_state", "common");

  const { response, data } = await requestJson("/api/wheel/state", {
    method: "GET",
    headers: telegramHeaders({ telegram_id: "777111", telegram_username: "wheel_state_1" }),
  });
  assert.equal(response.status, 200, `expected 200 from /api/wheel/state, got ${response.status}: ${JSON.stringify(data)}`);
  assert.ok(Array.isArray(data?.feed), "feed should be present");
  assert.ok(data.feed.length >= 1, "feed should contain the seeded spin");
  const seeded = data.feed.find((row) => row.id === "spin_state_1");
  assert.ok(seeded, "seeded spin should appear in feed");
  // photo_url passes through as `photo` in the response.
  assert.equal(
    seeded.photo,
    "https://t.me/i/userpic/test.png",
    "feed.photo must come from customers.photo_url, not the (nonexistent) customer_photo column",
  );
}

// B4 regression: any retail client could send arbitrary
// X-Wholesale-Code / X-Wholesale-Secret and tip the wheel into the
// wholesale prize pool. After the fix, the request is treated as
// retail unless the headers match a real wholesale_tiers row.
async function testForgedWholesaleHeadersDoNotUnlockWholesalePool() {
  ensureCustomer("cust_wh_b4", "777222", "wheel_wh_b4");
  insertPrize("p_retail_only", "common", 1, 0);
  insertPrize("p_wholesale_only", "rare", 0, 1);

  const { response, data } = await requestJson("/api/wheel/state", {
    method: "GET",
    headers: telegramHeaders(
      { telegram_id: "777222", telegram_username: "wheel_wh_b4" },
      {
        "x-wholesale-code": "fake-code",
        "x-wholesale-secret": "fake-secret",
      },
    ),
  });
  assert.equal(response.status, 200);
  assert.equal(
    data.is_wholesale,
    false,
    "forged wholesale headers must NOT flip the request into wholesale mode",
  );
  const ids = (data.prizes || []).map((p) => p.id);
  assert.ok(ids.includes("p_retail_only"), "retail prize must be visible");
  assert.ok(
    !ids.includes("p_wholesale_only"),
    "wholesale prize must NOT be visible to a retail client with forged headers",
  );
}

// B4 happy-path: a real wholesale client (creds match wholesale_tiers)
// must still see wholesale prizes.
async function testValidatedWholesaleHeadersUnlockWholesalePool() {
  const tier = db
    .prepare(
      "SELECT code, secret_key FROM wholesale_tiers WHERE is_active = 1 ORDER BY sort_order LIMIT 1",
    )
    .get();
  if (!tier) {
    console.warn("[wheel-routes] no active wholesale tier seeded — skipping happy path");
    return;
  }

  ensureCustomer("cust_wh_real", "777333", "wheel_wh_real");
  insertPrize("p_wholesale_real", "rare", 0, 1);

  const { response, data } = await requestJson("/api/wheel/state", {
    method: "GET",
    headers: telegramHeaders(
      { telegram_id: "777333", telegram_username: "wheel_wh_real" },
      {
        "x-wholesale-code": tier.code,
        "x-wholesale-secret": tier.secret_key,
      },
    ),
  });
  assert.equal(response.status, 200);
  assert.equal(
    data.is_wholesale,
    true,
    "validated wholesale credentials must flip the request into wholesale mode",
  );
  const ids = (data.prizes || []).map((p) => p.id);
  assert.ok(
    ids.includes("p_wholesale_real"),
    "wholesale prize must be visible to a validated wholesale request",
  );
}

async function main() {
  await testWheelStateWorksWithRealLiveFeed();
  await testForgedWholesaleHeadersDoNotUnlockWholesalePool();
  await testValidatedWholesaleHeadersUnlockWholesalePool();
  console.log("[wheel-routes] OK");
}

try {
  await main();
} finally {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
