import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "navalivay-loyalty-"));
const tempDbPath = path.join(tempDir, "test.db");

process.env.DATABASE_FILE = tempDbPath;
process.env.BOT_TOKEN = "";

const { initDb, db } = await import("../db.js");
const { publicRouter } = await import("../routes/public.js");
const { loyaltyRouter } = await import("../routes/loyalty.js");
const { awardLoyaltyForOrder } = await import("../loyalty.js");

initDb();

const app = express();
app.use(express.json());
app.use(publicRouter);
app.use(loyaltyRouter);

const server = await new Promise((resolve) => {
  const instance = app.listen(0, () => resolve(instance));
});

const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, options);
  const data = await response.json().catch(() => null);
  return { response, data };
}

function seedLoyaltyCatalog() {
  db.prepare(
    `
    INSERT OR IGNORE INTO categories (id, slug, name, [order], hide_empty, display_mode)
    VALUES
      ('c_liquids_salt', 'c-liquids-salt', 'Liquids', 0, 0, 'default'),
      ('c_disposables', 'c-disposables', 'Disposables', 1, 0, 'default'),
      ('c_pods', 'c-pods', 'Devices', 2, 0, 'default')
  `,
  ).run();

  db.prepare(
    `
    INSERT OR IGNORE INTO products (
      id, categoryId, groupId, title, priceRub, description, use_category_image,
      createdAt, cost_price, stock, min_stock, has_variants
    ) VALUES
      ('liquid-1', 'c_liquids_salt', NULL, 'Liquid Cherry', 15, '', 0, DATETIME('now'), 5, 50, 0, 0),
      ('disposable-1', 'c_disposables', NULL, 'Disposable Mint', 25, '', 0, DATETIME('now'), 10, 50, 0, 0)
  `,
  ).run();
}

function createCustomer({
  id,
  telegramId,
  telegramUsername,
  firstName = "Test",
  lastName = "User",
}) {
  db.prepare(
    `
    INSERT INTO customers (
      id, telegram_id, telegram_username, first_name, last_name, last_visit_at
    ) VALUES (?, ?, ?, ?, ?, DATETIME('now'))
  `,
  ).run(id, String(telegramId), telegramUsername, firstName, lastName);

  return id;
}

function getCustomerByTelegramId(telegramId) {
  return db
    .prepare("SELECT * FROM customers WHERE telegram_id = ?")
    .get(String(telegramId));
}

function getLoyaltyCategoryId(key) {
  return db.prepare("SELECT id FROM loyalty_categories WHERE key = ?").get(key).id;
}

function setBalance(customerId, categoryId, balance) {
  db.prepare(
    `
    INSERT INTO customer_loyalty_balances (customer_id, loyalty_category_id, balance, updated_at)
    VALUES (?, ?, ?, DATETIME('now'))
    ON CONFLICT(customer_id, loyalty_category_id) DO UPDATE SET
      balance = excluded.balance,
      updated_at = DATETIME('now')
  `,
  ).run(customerId, categoryId, balance);
}

function getBalance(customerId, categoryId) {
  return Number(
    db
      .prepare(
        `
        SELECT balance
        FROM customer_loyalty_balances
        WHERE customer_id = ? AND loyalty_category_id = ?
      `,
      )
      .get(customerId, categoryId)?.balance || 0,
  );
}

function getOrderItem(orderId) {
  return db
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid ASC")
    .get(orderId);
}

function getRedemptions(orderId) {
  return db
    .prepare("SELECT * FROM order_loyalty_redemptions WHERE order_id = ? ORDER BY rowid ASC")
    .all(orderId);
}

function getLedgerReasons(customerId) {
  return db
    .prepare(
      `
      SELECT reason
      FROM customer_loyalty_ledger
      WHERE customer_id = ?
      ORDER BY rowid ASC
    `,
    )
    .all(customerId)
    .map((row) => row.reason);
}

async function createPublicOrder(identity, overrides = {}) {
  const payload = {
    telegram_id: identity.telegram_id,
    telegram_username: identity.telegram_username,
    first_name: identity.first_name || "Test",
    last_name: identity.last_name || "User",
    delivery_type: "pickup",
    items: [
      {
        product_id: "liquid-1",
        variant_id: null,
        quantity: 1,
        price_per_unit: 15,
        product_title: "Liquid Cherry",
        variant_name: null,
      },
    ],
    ...overrides,
  };

  return requestJson("/api/orders", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
}

async function testPreviewReserveAndAward() {
  const customerId = createCustomer({
    id: "cust-loyalty-1",
    telegramId: "2001",
    telegramUsername: "loyalty_user",
  });
  const liquidsCategoryId = getLoyaltyCategoryId("liquids");
  setBalance(customerId, liquidsCategoryId, 10);

  const preview = await requestJson("/api/loyalty/checkout-preview", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      telegram_id: "2001",
      telegram_username: "loyalty_user",
      items: [
        {
          product_id: "liquid-1",
          quantity: 2,
          price_per_unit: 15,
          product_title: "Liquid Cherry",
          loyalty_units_applied: 1,
        },
      ],
    }),
  });

  assert.equal(preview.response.status, 200);
  assert.equal(preview.data.categories.length, 1);
  assert.equal(preview.data.categories[0].current_balance, 10);
  assert.equal(preview.data.categories[0].current_available_bonus_count, 1);
  assert.equal(preview.data.categories[0].projected_balance, 1);
  assert.equal(preview.data.total_loyalty_discount, 10);

  const created = await createPublicOrder(
    {
      telegram_id: "2001",
      telegram_username: "loyalty_user",
    },
    {
      items: [
        {
          product_id: "liquid-1",
          variant_id: null,
          quantity: 2,
          price_per_unit: 15,
          product_title: "Liquid Cherry",
          loyalty_units_applied: 1,
        },
      ],
    },
  );

  assert.equal(created.response.status, 200);
  const orderId = created.data.order_id;
  const orderItem = getOrderItem(orderId);
  const redemptions = getRedemptions(orderId);

  assert.equal(getBalance(customerId, liquidsCategoryId), 0);
  assert.equal(Number(orderItem.loyalty_units_applied || 0), 1);
  assert.equal(Number(orderItem.loyalty_discount_amount || 0), 10);
  assert.equal(redemptions.length, 1);
  assert.equal(Number(redemptions[0].stamps_spent || 0), 10);

  db.prepare("UPDATE orders SET status = 'delivered', completed_at = DATETIME('now') WHERE id = ?").run(
    orderId,
  );

  const firstAward = awardLoyaltyForOrder(orderId);
  const secondAward = awardLoyaltyForOrder(orderId);

  assert.equal(firstAward.awarded, true);
  assert.equal(secondAward.reason, "already_awarded");
  assert.equal(getBalance(customerId, liquidsCategoryId), 1);
  assert.deepEqual(getLedgerReasons(customerId), [
    "reserved_for_order",
    "earned_from_order",
  ]);
}

async function testCancelReturnsReservedBalance() {
  const customerId = createCustomer({
    id: "cust-loyalty-2",
    telegramId: "2002",
    telegramUsername: "loyalty_cancel",
  });
  const liquidsCategoryId = getLoyaltyCategoryId("liquids");
  setBalance(customerId, liquidsCategoryId, 20);

  const created = await createPublicOrder(
    {
      telegram_id: "2002",
      telegram_username: "loyalty_cancel",
    },
    {
      items: [
        {
          product_id: "liquid-1",
          variant_id: null,
          quantity: 2,
          price_per_unit: 15,
          product_title: "Liquid Cherry",
          loyalty_units_applied: 2,
        },
      ],
    },
  );

  assert.equal(created.response.status, 200);
  const orderId = created.data.order_id;
  assert.equal(getBalance(customerId, liquidsCategoryId), 0);

  const cancelled = await requestJson(`/api/orders/${orderId}/cancel-by-customer`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      telegram_id: "2002",
      telegram_username: "loyalty_cancel",
    }),
  });

  assert.equal(cancelled.response.status, 200);
  assert.equal(getBalance(customerId, liquidsCategoryId), 20);
  assert.equal(getRedemptions(orderId).length, 0);

  const orderItem = getOrderItem(orderId);
  assert.equal(Number(orderItem.loyalty_units_applied || 0), 0);
  assert.equal(Number(orderItem.loyalty_discount_amount || 0), 0);
}

async function testAwardSkipsDiscountedItems() {
  const customerId = createCustomer({
    id: "cust-loyalty-3",
    telegramId: "2003",
    telegramUsername: "loyalty_manual_discount",
  });
  const liquidsCategoryId = getLoyaltyCategoryId("liquids");

  const created = await createPublicOrder(
    {
      telegram_id: "2003",
      telegram_username: "loyalty_manual_discount",
    },
    {
      items: [
        {
          product_id: "liquid-1",
          variant_id: null,
          quantity: 1,
          price_per_unit: 15,
          product_title: "Liquid Cherry",
          discount_amount: 2,
        },
      ],
    },
  );

  assert.equal(created.response.status, 200);
  const orderId = created.data.order_id;

  db.prepare(
    `
    UPDATE order_items
    SET manual_discount_amount = 2,
        discount_amount = 2,
        total_price = MAX((price_per_unit * quantity) - 2, 0)
    WHERE order_id = ?
  `,
  ).run(orderId);

  db.prepare("UPDATE orders SET status = 'delivered', completed_at = DATETIME('now') WHERE id = ?").run(
    orderId,
  );
  const award = awardLoyaltyForOrder(orderId);

  assert.equal(award.reason, "nothing_to_award");
  assert.equal(getBalance(customerId, liquidsCategoryId), 0);
}

async function testUsernameResetClearsBalance() {
  const customerId = createCustomer({
    id: "cust-loyalty-4",
    telegramId: "2004",
    telegramUsername: "before_reset",
  });
  const liquidsCategoryId = getLoyaltyCategoryId("liquids");
  setBalance(customerId, liquidsCategoryId, 12);

  const snapshot = await requestJson(
    "/api/loyalty/me?telegram_id=2004&telegram_username=after_reset",
  );

  assert.equal(snapshot.response.status, 200);
  const liquids = snapshot.data.categories.find((category) => category.key === "liquids");
  assert.equal(liquids.balance, 0);
  assert.ok(getLedgerReasons(customerId).includes("username_reset"));
}

async function main() {
  seedLoyaltyCatalog();

  await testPreviewReserveAndAward();
  await testCancelReturnsReservedBalance();
  await testAwardSkipsDiscountedItems();
  await testUsernameResetClearsBalance();

  console.log("[loyalty-smoke] OK");
}

try {
  await main();
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
