import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

import { telegramHeaders } from "./helpers/telegram-auth.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "navalivay-wholesale-"));
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

async function requestJson(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, options);
  const data = await response.json().catch(() => null);
  return { response, data };
}

function getWholesaleTier(code) {
  return db
    .prepare(
      `
      SELECT id, code, secret_key, min_order_amount
      FROM wholesale_tiers
      WHERE code = ?
      LIMIT 1
    `,
    )
    .get(code);
}

function seedWholesaleProduct() {
  db.prepare(
    `
    INSERT OR IGNORE INTO categories (id, slug, name, [order], hide_empty, display_mode)
    VALUES ('cat-wholesale', 'cat-wholesale', 'Wholesale test', 0, 0, 'default')
  `,
  ).run();

  db.prepare(
    `
    INSERT OR IGNORE INTO category_groups (
      id, categoryId, slug, name, [order], hide_empty, createdAt, updatedAt
    ) VALUES (
      'group-wholesale', 'cat-wholesale', 'group-wholesale', 'Wholesale group', 0, 0, DATETIME('now'), DATETIME('now')
    )
  `,
  ).run();

  db.prepare(
    `
    INSERT OR REPLACE INTO products (
      id, categoryId, groupId, title, priceRub, description, use_category_image,
      createdAt, cost_price, stock, min_stock, has_variants
    ) VALUES (?, 'cat-wholesale', 'group-wholesale', 'Wholesale liquid', 15, '', 0, DATETIME('now'), 5, 100, 0, 0)
  `,
  ).run("product-wholesale");
}

function seedHiddenWholesaleProduct() {
  db.prepare(
    `
    INSERT OR IGNORE INTO category_groups (
      id, categoryId, slug, name, [order], hide_empty, createdAt, updatedAt
    ) VALUES (
      'group-wholesale-hidden', 'cat-wholesale', 'group-wholesale-hidden', 'Hidden wholesale group', 1, 0, DATETIME('now'), DATETIME('now')
    )
  `,
  ).run();

  db.prepare(
    `
    INSERT OR REPLACE INTO products (
      id, categoryId, groupId, title, priceRub, description, use_category_image,
      createdAt, cost_price, stock, min_stock, has_variants
    ) VALUES (?, 'cat-wholesale', 'group-wholesale-hidden', 'Retail only liquid', 25, '', 0, DATETIME('now'), 8, 100, 0, 0)
  `,
  ).run("product-wholesale-hidden");
}

function setWholesalePrice(tierId, price) {
  db.prepare(
    `
    INSERT OR REPLACE INTO category_group_wholesale_prices (
      group_id, tier_id, price_byn, created_at, updated_at
    ) VALUES ('group-wholesale', ?, ?, DATETIME('now'), DATETIME('now'))
  `,
  ).run(tierId, price);
}

function getOrderById(orderId) {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
}

function getOrderItems(orderId) {
  return db
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid ASC")
    .all(orderId);
}

function wholesaleHeaders(code, secret, identity) {
  return {
    ...telegramHeaders(identity),
    "x-wholesale-code": code,
    "x-wholesale-secret": secret,
  };
}

async function createWholesaleOrder(identity, tier, quantity) {
  return requestJson("/api/orders", {
    method: "POST",
    headers: wholesaleHeaders(tier.code, tier.secret_key, identity),
    body: JSON.stringify({
      ...identity,
      delivery_type: "pickup",
      items: [
        {
          product_id: "product-wholesale",
          variant_id: null,
          quantity,
          price_per_unit: 9.5,
          product_title: "Wholesale liquid",
          variant_name: null,
        },
      ],
    }),
  });
}

async function testWholesaleLinkValidation() {
  const tier = getWholesaleTier("500");
  assert.ok(tier);

  const incomplete = await requestJson(`/api/wholesale/context?wholesale_code=${tier.code}`);
  assert.equal(incomplete.response.status, 400);
  assert.equal(incomplete.data.error, "invalid_wholesale_link");

  const invalid = await requestJson(
    `/api/wholesale/context?wholesale_code=${tier.code}&wholesale_secret=wrong-secret`,
  );
  assert.equal(invalid.response.status, 403);
  assert.equal(invalid.data.error, "invalid_wholesale_link");
}

async function testWholesaleContextAndCatalog() {
  seedWholesaleProduct();
  seedHiddenWholesaleProduct();
  const tier = getWholesaleTier("500");
  assert.ok(tier);
  setWholesalePrice(tier.id, 9.5);

  const context = await requestJson(
    `/api/wholesale/context?wholesale_code=${tier.code}&wholesale_secret=${tier.secret_key}`,
  );
  assert.equal(context.response.status, 200);
  assert.equal(context.data.is_wholesale, true);
  assert.equal(context.data.wholesale_code, "500");
  assert.equal(context.data.wholesale_min_amount, 500);

  const categories = await requestJson("/api/categories", {
    headers: {
      "x-wholesale-code": tier.code,
      "x-wholesale-secret": tier.secret_key,
    },
  });
  assert.equal(categories.response.status, 200);
  assert.equal(categories.data.length, 1);
  assert.equal(categories.data[0].groups.length, 1);
  assert.equal(categories.data[0].groups[0].id, "group-wholesale");

  const products = await requestJson("/api/products?category=cat-wholesale", {
    headers: {
      "x-wholesale-code": tier.code,
      "x-wholesale-secret": tier.secret_key,
    },
  });

  assert.equal(products.response.status, 200);
  assert.equal(products.data.products.length, 1);
  assert.equal(products.data.products[0].priceRub, 9.5);
  assert.equal(products.data.products[0].isWholesale, true);

  const hiddenProduct = await requestJson("/api/product/product-wholesale-hidden", {
    headers: {
      "x-wholesale-code": tier.code,
      "x-wholesale-secret": tier.secret_key,
    },
  });
  assert.equal(hiddenProduct.response.status, 404);
}

async function testWholesaleOrderMinimumAndCreate() {
  const tier = getWholesaleTier("500");
  const identity = {
    telegram_id: "5001",
    telegram_username: "wholesale_customer",
  };

  const belowMinimum = await createWholesaleOrder(identity, tier, 10);

  assert.equal(belowMinimum.response.status, 400);
  assert.equal(belowMinimum.data.error, "wholesale_min_not_met");

  const created = await createWholesaleOrder(identity, tier, 60);

  assert.equal(created.response.status, 200);
  assert.equal(created.data.success, true);

  const order = getOrderById(created.data.order_id);
  const items = getOrderItems(created.data.order_id);

  assert.equal(order.is_wholesale, 1);
  assert.equal(order.wholesale_tier_id, tier.id);
  assert.equal(order.wholesale_min_amount, 500);
  assert.equal(order.total_amount, 570);
  assert.equal(order.final_amount, 570);
  assert.equal(items.length, 1);
  assert.equal(items[0].price_per_unit, 9.5);
}

async function testModifyWholesaleOrder() {
  const tier = getWholesaleTier("500");
  const identity = {
    telegram_id: "5002",
    telegram_username: "wholesale_customer_edit",
  };

  const created = await createWholesaleOrder(identity, tier, 60);
  assert.equal(created.response.status, 200);

  const orderId = created.data.order_id;

  const belowMinimum = await requestJson(`/api/orders/${orderId}/modify-by-customer`, {
    method: "PUT",
    headers: telegramHeaders(identity),
    body: JSON.stringify({
      ...identity,
      delivery_type: "pickup",
      items: [
        {
          product_id: "product-wholesale",
          variant_id: null,
          quantity: 20,
          price_per_unit: 9.5,
          product_title: "Wholesale liquid",
          variant_name: null,
        },
      ],
    }),
  });
  assert.equal(belowMinimum.response.status, 400);
  assert.equal(belowMinimum.data.error, "wholesale_min_not_met");

  const updated = await requestJson(`/api/orders/${orderId}/modify-by-customer`, {
    method: "PUT",
    headers: telegramHeaders(identity),
    body: JSON.stringify({
      ...identity,
      delivery_type: "pickup",
      items: [
        {
          product_id: "product-wholesale",
          variant_id: null,
          quantity: 70,
          price_per_unit: 9.5,
          product_title: "Wholesale liquid",
          variant_name: null,
        },
      ],
    }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.data.success, true);

  const order = getOrderById(orderId);
  const items = getOrderItems(orderId);
  assert.equal(order.is_wholesale, 1);
  assert.equal(order.total_amount, 665);
  assert.equal(order.final_amount, 665);
  assert.equal(order.needs_manager_action, 1);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 70);
  assert.equal(items[0].price_per_unit, 9.5);
}

async function main() {
  try {
    await testWholesaleLinkValidation();
    await testWholesaleContextAndCatalog();
    await testWholesaleOrderMinimumAndCreate();
    await testModifyWholesaleOrder();
    console.log("[wholesale-smoke] OK");
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
}

await main();
