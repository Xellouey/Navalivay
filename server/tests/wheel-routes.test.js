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
const { createPrize, updatePrize } = await import("../wheel/wheel-service.js");
const { validatePromoCode } = await import("../promo-code-service.js");

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

// C1-CR regression: when CRM creates a prize that points at a normal
// promo template, the template row gets is_wheel_template=1 — and once
// it does, validatePromoCode must refuse to apply it at checkout. Before
// the fix, the flag was never set, so the public template code was a
// working discount.
async function testWheelTemplateRejectedAtCheckout() {
  const promoId = "promo_template_rej";
  db.prepare(
    `INSERT OR IGNORE INTO promo_codes (
      id, code, description, discount_type, discount_value, min_order_amount,
      max_uses, current_uses, valid_from, valid_until, active, has_gift,
      is_wheel_template, created_at
    ) VALUES (?, ?, NULL, 'fixed', 5, 0, 0, 0, NULL, NULL, 1, 0, 0, DATETIME('now'))`,
  ).run(promoId, "WHEELTPL-REJ");

  // Sanity: before being linked to a prize, the code is a regular
  // discount and validatePromoCode accepts it.
  const before = validatePromoCode("WHEELTPL-REJ", 100);
  assert.equal(before.valid, true, "untagged promo should be valid before becoming a wheel template");

  const prize = createPrize({
    rarity_code: "common",
    title: "5 BYN скидка",
    weight: 1,
    is_for_retail: true,
    is_for_wholesale: false,
    promo_template_id: promoId,
  });
  assert.ok(prize?.id, "prize creation should succeed");

  const flagRow = db
    .prepare("SELECT is_wheel_template FROM promo_codes WHERE id = ?")
    .get(promoId);
  assert.equal(
    Number(flagRow?.is_wheel_template),
    1,
    "createPrize must set is_wheel_template=1 on the linked promo_codes row",
  );

  const after = validatePromoCode("WHEELTPL-REJ", 100);
  assert.equal(after.valid, false, "wheel template code must NOT be valid at checkout");
  assert.equal(
    after.error,
    "wheel_template_not_applicable",
    "validatePromoCode should report wheel_template_not_applicable",
  );
}

// C1-CR regression: when CRM repoints a prize at a different template,
// the previous template row should drop is_wheel_template back to 0 IF
// no other prize still references it; the new template row must be
// flagged. The transition happens atomically inside one transaction.
async function testWheelTemplateFlagClearedWhenPrizeChangesTemplate() {
  const oldId = "promo_template_old";
  const newId = "promo_template_new";
  db.prepare(
    `INSERT OR IGNORE INTO promo_codes (
      id, code, description, discount_type, discount_value, min_order_amount,
      max_uses, current_uses, valid_from, valid_until, active, has_gift,
      is_wheel_template, created_at
    ) VALUES (?, ?, NULL, 'fixed', 5, 0, 0, 0, NULL, NULL, 1, 0, 0, DATETIME('now'))`,
  ).run(oldId, "WHEELTPL-OLD");
  db.prepare(
    `INSERT OR IGNORE INTO promo_codes (
      id, code, description, discount_type, discount_value, min_order_amount,
      max_uses, current_uses, valid_from, valid_until, active, has_gift,
      is_wheel_template, created_at
    ) VALUES (?, ?, NULL, 'fixed', 7, 0, 0, 0, NULL, NULL, 1, 0, 0, DATETIME('now'))`,
  ).run(newId, "WHEELTPL-NEW");

  const prize = createPrize({
    rarity_code: "common",
    title: "Migration prize",
    weight: 1,
    is_for_retail: true,
    promo_template_id: oldId,
  });
  assert.equal(
    Number(
      db.prepare("SELECT is_wheel_template FROM promo_codes WHERE id = ?").get(oldId)
        ?.is_wheel_template,
    ),
    1,
  );

  updatePrize(prize.id, { promo_template_id: newId });

  assert.equal(
    Number(
      db.prepare("SELECT is_wheel_template FROM promo_codes WHERE id = ?").get(oldId)
        ?.is_wheel_template,
    ),
    0,
    "old template should be unflagged after the prize switched",
  );
  assert.equal(
    Number(
      db.prepare("SELECT is_wheel_template FROM promo_codes WHERE id = ?").get(newId)
        ?.is_wheel_template,
    ),
    1,
    "new template should be flagged",
  );
}

// C3-CR regression: a partial PATCH that disables `is_for_retail` on a
// prize whose existing pool is also disabled-for-wholesale must surface
// `at_least_one_pool_required`, not silently leave the row unreachable.
async function testPartialUpdateRejectsBothPoolsDisabled() {
  const prize = createPrize({
    rarity_code: "common",
    title: "Pool prize",
    weight: 1,
    is_for_retail: true,
    is_for_wholesale: false,
  });
  const { response, data } = await requestJson(
    `/api/admin/crm/wheel/prizes/${prize.id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token-not-needed-here",
      },
      body: JSON.stringify({ is_for_retail: false }),
    },
  );
  // We don't have an admin auth helper in this test harness — endpoints
  // that require auth return 401. Instead exercise the validator
  // directly so the assertion stays focused on validation logic.
  if (response.status === 401) {
    const { validatePrizePayload } = await import("../wheel/wheel-service.js");
    const existing = db
      .prepare("SELECT * FROM wheel_prizes WHERE id = ?")
      .get(prize.id);
    const result = validatePrizePayload(
      { is_for_retail: false },
      { isUpdate: true, existing },
    );
    assert.ok(
      result.errors.includes("at_least_one_pool_required"),
      "partial update that empties both pools must fail validation",
    );
  } else {
    assert.equal(response.status, 400, `expected 400 got ${response.status}: ${JSON.stringify(data)}`);
    assert.ok(
      Array.isArray(data?.details) && data.details.includes("at_least_one_pool_required"),
      "partial update that empties both pools must fail validation",
    );
  }
}

async function main() {
  await testWheelStateWorksWithRealLiveFeed();
  await testForgedWholesaleHeadersDoNotUnlockWholesalePool();
  await testValidatedWholesaleHeadersUnlockWholesalePool();
  await testWheelTemplateRejectedAtCheckout();
  await testWheelTemplateFlagClearedWhenPrizeChangesTemplate();
  await testPartialUpdateRejectsBothPoolsDisabled();
  console.log("[wheel-routes] OK");
}

try {
  await main();
} finally {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
