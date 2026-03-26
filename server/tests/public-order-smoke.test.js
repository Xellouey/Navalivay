import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { buildTelegramInitData, telegramHeaders } from "./helpers/telegram-auth.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "navalivay-public-order-"));
const tempDbPath = path.join(tempDir, "test.db");

process.env.DATABASE_FILE = tempDbPath;
process.env.BOT_TOKEN = "test-bot-token";
process.env.NODE_ENV = "test";

const { initDb, db } = await import("../db.js");
const { publicRouter } = await import("../routes/public.js");

initDb();

const app = express();
app.use(express.json());
app.use(publicRouter);

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

function seedProduct({ productId = "product-1", stock = 10 } = {}) {
  db.prepare(
    `
    INSERT OR IGNORE INTO categories (id, slug, name, [order], hide_empty, display_mode)
    VALUES ('cat-test', 'cat-test', 'Test category', 0, 0, 'default')
  `,
  ).run();

  db.prepare(
    `
    INSERT OR IGNORE INTO products (
      id, categoryId, groupId, title, priceRub, description, use_category_image,
      createdAt, cost_price, stock, min_stock, has_variants
    ) VALUES (?, 'cat-test', NULL, 'Liquid Cherry', 15, '', 0, DATETIME('now'), 5, ?, 0, 0)
  `,
  ).run(productId, stock);
}

async function createOrder(identity, overrides = {}) {
  const payload = {
    telegram_id: identity.telegram_id,
    telegram_username: identity.telegram_username,
    first_name: identity.first_name || "Test",
    last_name: identity.last_name || "User",
    delivery_type: "pickup",
    items: [
      {
        product_id: "product-1",
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
    headers: telegramHeaders(identity),
    body: JSON.stringify(payload),
  });
}

function getOrderById(orderId) {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
}

function getCustomerById(customerId) {
  return db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
}

function getOrderItems(orderId) {
  return db
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid ASC")
    .all(orderId);
}

function getProductStock() {
  return db.prepare("SELECT stock FROM products WHERE id = 'product-1'").get().stock;
}

function markOrderInProgress(orderId) {
  db.prepare(
    `
    UPDATE orders
    SET status = 'in_progress',
        stock_deducted = 1,
        updated_at = DATETIME('now')
    WHERE id = ?
  `,
  ).run(orderId);
}

async function testCreateAndDuplicateGuard() {
  const identity = {
    telegram_id: "1001",
    telegram_username: "customer_guard",
  };

  const first = await createOrder(identity);
  assert.equal(first.response.status, 200);
  assert.equal(first.data.success, true);

  const order = getOrderById(first.data.order_id);
  assert.equal(order.status, "new");
  assert.equal(order.stock_deducted, 0);
  assert.equal(getProductStock(), 10);

  const second = await createOrder(identity);
  assert.equal(second.response.status, 409);
  assert.equal(second.data.error, "active_order_exists");
}

async function testModifyNewOrder() {
  const identity = {
    telegram_id: "1002",
    telegram_username: "customer_modify_new",
  };

  const created = await createOrder(identity);
  const orderId = created.data.order_id;

  const updated = await requestJson(`/api/orders/${orderId}/modify-by-customer`, {
    method: "PUT",
    headers: telegramHeaders(identity),
    body: JSON.stringify({
      ...identity,
      delivery_type: "pickup",
      items: [
        {
          product_id: "product-1",
          variant_id: null,
          quantity: 2,
          price_per_unit: 15,
          product_title: "Liquid Cherry",
          variant_name: null,
        },
      ],
    }),
  });

  assert.equal(updated.response.status, 200);

  const order = getOrderById(orderId);
  const items = getOrderItems(orderId);

  assert.equal(order.status, "new");
  assert.equal(order.needs_manager_action, 1);
  assert.equal(order.manager_action_type, "modified");
  assert.equal(items[0].quantity, 2);
}

async function testModifyInProgressOrderRestoresStock() {
  const identity = {
    telegram_id: "1003",
    telegram_username: "customer_modify_progress",
  };

  const created = await createOrder(identity);
  const orderId = created.data.order_id;

  markOrderInProgress(orderId);
  db.prepare("UPDATE products SET stock = stock - 1 WHERE id = 'product-1'").run();

  const updated = await requestJson(`/api/orders/${orderId}/modify-by-customer`, {
    method: "PUT",
    headers: telegramHeaders(identity),
    body: JSON.stringify({
      ...identity,
      delivery_type: "pickup",
      items: [
        {
          product_id: "product-1",
          variant_id: null,
          quantity: 2,
          price_per_unit: 15,
          product_title: "Liquid Cherry",
          variant_name: null,
        },
      ],
    }),
  });

  assert.equal(updated.response.status, 200);

  const order = getOrderById(orderId);
  const items = getOrderItems(orderId);

  assert.equal(order.status, "new");
  assert.equal(order.needs_manager_action, 1);
  assert.equal(order.manager_action_type, "modified");
  assert.equal(order.stock_deducted, 0);
  assert.equal(items[0].quantity, 2);
  assert.equal(getProductStock(), 10);
}

async function testCancelNewOrder() {
  const identity = {
    telegram_id: "1004",
    telegram_username: "customer_cancel_new",
  };

  const created = await createOrder(identity);
  const orderId = created.data.order_id;

  const cancelled = await requestJson(`/api/orders/${orderId}/cancel-by-customer`, {
    method: "POST",
    headers: telegramHeaders(identity),
    body: JSON.stringify(identity),
  });

  assert.equal(cancelled.response.status, 200);

  const order = getOrderById(orderId);
  assert.equal(order.status, "cancelled");
  assert.equal(order.needs_manager_action, 0);
}

async function testCancelInProgressOrder() {
  const identity = {
    telegram_id: "1005",
    telegram_username: "customer_cancel_progress",
  };

  const created = await createOrder(identity);
  const orderId = created.data.order_id;

  markOrderInProgress(orderId);
  db.prepare("UPDATE products SET stock = stock - 1 WHERE id = 'product-1'").run();

  const cancelled = await requestJson(`/api/orders/${orderId}/cancel-by-customer`, {
    method: "POST",
    headers: telegramHeaders(identity),
    body: JSON.stringify(identity),
  });

  assert.equal(cancelled.response.status, 200);

  const order = getOrderById(orderId);
  assert.equal(order.status, "cancelled");
  assert.equal(order.needs_manager_action, 1);
  assert.equal(order.manager_action_type, "cancelled_by_customer");
  assert.equal(order.stock_deducted, 0);
  assert.equal(getProductStock(), 10);
}

async function testClientPriceIsIgnored() {
  const identity = {
    telegram_id: "1006",
    telegram_username: "customer_price_guard",
  };

  const created = await createOrder(identity, {
    items: [
      {
        product_id: "product-1",
        variant_id: null,
        quantity: 2,
        price_per_unit: 1,
        product_title: "Liquid Cherry",
        variant_name: null,
      },
    ],
  });

  assert.equal(created.response.status, 200);
  const order = getOrderById(created.data.order_id);
  const items = getOrderItems(created.data.order_id);

  assert.equal(Number(order.total_amount || 0), 30);
  assert.equal(Number(items[0].price_per_unit || 0), 15);
}

async function testMissingTelegramAuthIsRejected() {
  const created = await requestJson("/api/orders", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      telegram_id: "1007",
      telegram_username: "customer_without_auth",
      delivery_type: "pickup",
      items: [
        {
          product_id: "product-1",
          variant_id: null,
          quantity: 1,
          price_per_unit: 15,
          product_title: "Liquid Cherry",
          variant_name: null,
        },
      ],
    }),
  });

  assert.equal(created.response.status, 401);
  assert.equal(created.data.error, "telegram_auth_required");
}

async function testInvalidTelegramSignatureIsRejected() {
  const identity = {
    telegram_id: "1008",
    telegram_username: "customer_bad_signature",
  };

  const created = await requestJson("/api/orders", {
    method: "POST",
    headers: {
      ...jsonHeaders(),
      "X-Telegram-Init-Data": buildTelegramInitData(identity, "wrong-test-bot-token"),
    },
    body: JSON.stringify({
      ...identity,
      delivery_type: "pickup",
      items: [
        {
          product_id: "product-1",
          variant_id: null,
          quantity: 1,
          price_per_unit: 15,
          product_title: "Liquid Cherry",
          variant_name: null,
        },
      ],
    }),
  });

  assert.equal(created.response.status, 401);
  assert.equal(created.data.error, "telegram_auth_invalid");
}

async function testBodyIdentitySpoofIsIgnored() {
  const identity = {
    telegram_id: "1009",
    telegram_username: "customer_header_identity",
  };

  const created = await createOrder(identity, {
    telegram_id: "9999",
    telegram_username: "spoofed_body_identity",
  });

  assert.equal(created.response.status, 200);

  const order = getOrderById(created.data.order_id);
  const customer = getCustomerById(order.customer_id);
  assert.equal(customer.telegram_id, "1009");
  assert.equal(customer.telegram_username, "customer_header_identity");
  assert.equal(order.telegram_username, "customer_header_identity");
}

async function testForeignOrderAccessIsRejected() {
  const owner = {
    telegram_id: "1010",
    telegram_username: "customer_owner",
  };
  const attacker = {
    telegram_id: "1011",
    telegram_username: "customer_attacker",
  };

  const created = await createOrder(owner);
  assert.equal(created.response.status, 200);
  const orderId = created.data.order_id;

  const activeForAttacker = await requestJson(`/api/orders/my-active?telegram_id=${owner.telegram_id}`, {
    headers: telegramHeaders(attacker),
  });
  assert.equal(activeForAttacker.response.status, 200);
  assert.equal(activeForAttacker.data.found, false);

  const modifyAttempt = await requestJson(`/api/orders/${orderId}/modify-by-customer`, {
    method: "PUT",
    headers: telegramHeaders(attacker),
    body: JSON.stringify({
      telegram_id: owner.telegram_id,
      telegram_username: owner.telegram_username,
      delivery_type: "pickup",
      items: [
        {
          product_id: "product-1",
          variant_id: null,
          quantity: 2,
          price_per_unit: 15,
          product_title: "Liquid Cherry",
          variant_name: null,
        },
      ],
    }),
  });
  assert.equal(modifyAttempt.response.status, 404);
  assert.equal(modifyAttempt.data.error, "not_found");

  const cancelAttempt = await requestJson(`/api/orders/${orderId}/cancel-by-customer`, {
    method: "POST",
    headers: telegramHeaders(attacker),
    body: JSON.stringify({
      telegram_id: owner.telegram_id,
      telegram_username: owner.telegram_username,
    }),
  });
  assert.equal(cancelAttempt.response.status, 404);
  assert.equal(cancelAttempt.data.error, "not_found");
}

async function main() {
  seedProduct();

  await testCreateAndDuplicateGuard();
  await testModifyNewOrder();
  await testModifyInProgressOrderRestoresStock();
  await testCancelNewOrder();
  await testCancelInProgressOrder();
  await testClientPriceIsIgnored();
  await testMissingTelegramAuthIsRejected();
  await testInvalidTelegramSignatureIsRejected();
  await testBodyIdentitySpoofIsIgnored();
  await testForeignOrderAccessIsRejected();

  console.log("[public-order-smoke] OK");
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
