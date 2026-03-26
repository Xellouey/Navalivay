import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { telegramHeaders } from "./helpers/telegram-auth.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "navalivay-promo-lifecycle-"));
const tempDbPath = path.join(tempDir, "test.db");

process.env.DATABASE_FILE = tempDbPath;
process.env.BOT_TOKEN = "test-bot-token";
process.env.SESSION_SECRET = "promo-lifecycle-secret";
process.env.NODE_ENV = "test";

const { initDb, db } = await import("../db.js");
const { issueToken } = await import("../auth.js");
const { publicRouter } = await import("../routes/public.js");
const { crmOperationsRouter } = await import("../routes/crm-operations.js");
const { promoRouter } = await import("../routes/promo.js");

initDb();

const app = express();
app.use(express.json());
app.use(publicRouter);
app.use(crmOperationsRouter);
app.use(promoRouter);

const server = await new Promise((resolve) => {
  const instance = app.listen(0, () => resolve(instance));
});

const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;
const adminToken = issueToken("promo-admin");

function jsonHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    ...extra,
  };
}

function adminHeaders() {
  return jsonHeaders({
    Authorization: `Bearer ${adminToken}`,
  });
}

async function requestJson(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, options);
  const data = await response.json().catch(() => null);
  return { response, data };
}

function seedProduct({ productId = "product-1", stock = 20 } = {}) {
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

function seedPromo({
  promoId,
  code,
  discountValue = 3,
  maxUses = 1,
} = {}) {
  db.prepare(
    `
    INSERT INTO promo_codes (
      id, code, description, discount_type, discount_value, min_order_amount, max_uses, current_uses, active
    ) VALUES (?, ?, ?, 'fixed', ?, 0, ?, 0, 1)
  `,
  ).run(
    promoId,
    code,
    `${code} promo`,
    discountValue,
    maxUses,
  );
}

async function createOrder(identity, overrides = {}) {
  const payload = {
    telegram_id: identity.telegram_id,
    telegram_username: identity.telegram_username,
    first_name: identity.first_name || "Promo",
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

async function modifyOrder(orderId, identity, overrides = {}) {
  const payload = {
    telegram_id: identity.telegram_id,
    telegram_username: identity.telegram_username,
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
    ...overrides,
  };

  return requestJson(`/api/orders/${orderId}/modify-by-customer`, {
    method: "PUT",
    headers: telegramHeaders(identity),
    body: JSON.stringify(payload),
  });
}

function getOrder(orderId) {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
}

function getPromo(promoId) {
  return db.prepare("SELECT * FROM promo_codes WHERE id = ?").get(promoId);
}

function getPromoUsageForOrder(orderId) {
  return db
    .prepare("SELECT * FROM promo_usage WHERE order_id = ? ORDER BY rowid ASC")
    .all(orderId);
}

async function testPromoReservationCanBeReusedBySameOrder() {
  const promoId = "promo-reserved";
  const promoCode = "SAVE3A";
  seedPromo({ promoId, code: promoCode });

  const identity = {
    telegram_id: "promo-user-1",
    telegram_username: "promo_user_1",
  };

  const created = await createOrder(identity, { promo_code: promoCode });
  assert.equal(created.response.status, 200);
  const orderId = created.data.order_id;

  let usageRows = getPromoUsageForOrder(orderId);
  assert.equal(usageRows.length, 1);
  assert.equal(usageRows[0].status, "reserved");
  assert.equal(usageRows[0].used_at, null);
  assert.equal(getPromo(promoId).current_uses, 1);

  const blocked = await requestJson("/api/promo/validate", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ code: promoCode, order_amount: 15 }),
  });
  assert.equal(blocked.response.status, 200);
  assert.equal(blocked.data.valid, false);
  assert.equal(blocked.data.error, "max_uses_reached");

  const sameOrder = await requestJson("/api/promo/validate", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      code: promoCode,
      order_amount: 30,
      editing_order_id: orderId,
    }),
  });
  assert.equal(sameOrder.response.status, 200);
  assert.equal(sameOrder.data.valid, true);
  assert.equal(sameOrder.data.calculated_discount, 3);

  const modified = await modifyOrder(orderId, identity, { promo_code: promoCode });
  assert.equal(modified.response.status, 200);

  const updatedOrder = getOrder(orderId);
  assert.equal(updatedOrder.total_amount, 30);
  assert.equal(updatedOrder.discount_amount, 3);
  assert.equal(updatedOrder.final_amount, 27);

  usageRows = getPromoUsageForOrder(orderId);
  assert.equal(usageRows.length, 1);
  assert.equal(usageRows[0].status, "reserved");
  assert.equal(usageRows[0].used_at, null);
  assert.equal(getPromo(promoId).current_uses, 1);

  const cancelled = await requestJson(`/api/orders/${orderId}/cancel-by-customer`, {
    method: "POST",
    headers: telegramHeaders(identity),
    body: JSON.stringify(identity),
  });
  assert.equal(cancelled.response.status, 200);
  assert.equal(getPromoUsageForOrder(orderId).length, 0);
  assert.equal(getPromo(promoId).current_uses, 0);

  const secondIdentity = {
    telegram_id: "promo-user-2",
    telegram_username: "promo_user_2",
  };
  const recreated = await createOrder(secondIdentity, { promo_code: promoCode });
  assert.equal(recreated.response.status, 200);
}

async function testPromoSwitchAndRemovalOnSameOrder() {
  const firstPromoId = "promo-switch-a";
  const firstPromoCode = "SAVE3D";
  const secondPromoId = "promo-switch-b";
  const secondPromoCode = "SAVE5D";

  seedPromo({ promoId: firstPromoId, code: firstPromoCode, discountValue: 3 });
  seedPromo({ promoId: secondPromoId, code: secondPromoCode, discountValue: 5 });

  const identity = {
    telegram_id: "promo-user-5",
    telegram_username: "promo_user_5",
  };

  const created = await createOrder(identity, { promo_code: firstPromoCode });
  assert.equal(created.response.status, 200);
  const orderId = created.data.order_id;

  let order = getOrder(orderId);
  assert.equal(order.promo_code_id, firstPromoId);
  assert.equal(order.promo_code_text, firstPromoCode);
  assert.equal(getPromo(firstPromoId).current_uses, 1);
  assert.equal(getPromo(secondPromoId).current_uses, 0);

  const switched = await modifyOrder(orderId, identity, {
    promo_code: secondPromoCode,
  });
  assert.equal(switched.response.status, 200);

  order = getOrder(orderId);
  assert.equal(order.promo_code_id, secondPromoId);
  assert.equal(order.promo_code_text, secondPromoCode);

  let usageRows = getPromoUsageForOrder(orderId);
  assert.equal(usageRows.length, 1);
  assert.equal(usageRows[0].promo_code_id, secondPromoId);
  assert.equal(usageRows[0].status, "reserved");
  assert.equal(getPromo(firstPromoId).current_uses, 0);
  assert.equal(getPromo(secondPromoId).current_uses, 1);

  const anotherIdentity = {
    telegram_id: "promo-user-6",
    telegram_username: "promo_user_6",
  };
  const reusedOriginalPromo = await createOrder(anotherIdentity, {
    promo_code: firstPromoCode,
  });
  assert.equal(reusedOriginalPromo.response.status, 200);

  const cleared = await modifyOrder(orderId, identity, { promo_code: null });
  assert.equal(cleared.response.status, 200);

  order = getOrder(orderId);
  assert.equal(order.promo_code_id, null);
  assert.equal(order.promo_code_text, null);

  usageRows = getPromoUsageForOrder(orderId);
  assert.equal(usageRows.length, 0);
  assert.equal(getPromo(secondPromoId).current_uses, 0);

  const thirdIdentity = {
    telegram_id: "promo-user-7",
    telegram_username: "promo_user_7",
  };
  const reusedSwitchedPromo = await createOrder(thirdIdentity, {
    promo_code: secondPromoCode,
  });
  assert.equal(reusedSwitchedPromo.response.status, 200);
}

async function testPromoConsumedAndReturnedToReservedByAdmin() {
  const promoId = "promo-admin-status";
  const promoCode = "SAVE3B";
  seedPromo({ promoId, code: promoCode });

  const identity = {
    telegram_id: "promo-user-3",
    telegram_username: "promo_user_3",
  };
  const created = await createOrder(identity, { promo_code: promoCode });
  assert.equal(created.response.status, 200);
  const orderId = created.data.order_id;

  const delivered = await requestJson(`/api/admin/crm/orders/${orderId}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({ status: "delivered" }),
  });
  assert.equal(delivered.response.status, 200);

  let usageRows = getPromoUsageForOrder(orderId);
  assert.equal(usageRows.length, 1);
  assert.equal(usageRows[0].status, "consumed");
  assert.ok(usageRows[0].used_at);
  assert.equal(getPromo(promoId).current_uses, 1);

  const usage = await requestJson(`/api/admin/crm/promo-codes/${promoId}/usage`, {
    method: "GET",
    headers: adminHeaders(),
  });
  assert.equal(usage.response.status, 200);
  assert.equal(Array.isArray(usage.data), true);
  assert.equal(usage.data.length, 1);
  assert.equal(usage.data[0].status, "consumed");

  const reopened = await requestJson(`/api/admin/crm/orders/${orderId}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({ status: "new" }),
  });
  assert.equal(reopened.response.status, 200);

  usageRows = getPromoUsageForOrder(orderId);
  assert.equal(usageRows.length, 1);
  assert.equal(usageRows[0].status, "reserved");
  assert.equal(usageRows[0].used_at, null);
  assert.equal(getPromo(promoId).current_uses, 1);
}

async function testIssueAndPaymentRollbackSyncPromoUsage() {
  const promoId = "promo-payment";
  const promoCode = "SAVE3C";
  seedPromo({ promoId, code: promoCode });

  const identity = {
    telegram_id: "promo-user-4",
    telegram_username: "promo_user_4",
  };
  const created = await createOrder(identity, { promo_code: promoCode });
  assert.equal(created.response.status, 200);
  const orderId = created.data.order_id;

  const inProgress = await requestJson(`/api/admin/crm/orders/${orderId}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({ status: "in_progress" }),
  });
  assert.equal(inProgress.response.status, 200);

  const issued = await requestJson(`/api/admin/crm/orders/${orderId}/issue`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      payment_type: "cash",
      payment_account_id: "acc_default",
      amount: 12,
    }),
  });
  assert.equal(issued.response.status, 200);

  let usageRows = getPromoUsageForOrder(orderId);
  assert.equal(usageRows.length, 1);
  assert.equal(usageRows[0].status, "consumed");
  assert.ok(usageRows[0].used_at);

  const paymentRemoved = await requestJson(
    `/api/admin/crm/orders/${orderId}/payment`,
    {
      method: "DELETE",
      headers: adminHeaders(),
    },
  );
  assert.equal(paymentRemoved.response.status, 200);

  usageRows = getPromoUsageForOrder(orderId);
  assert.equal(usageRows.length, 1);
  assert.equal(usageRows[0].status, "reserved");
  assert.equal(usageRows[0].used_at, null);
  assert.equal(getPromo(promoId).current_uses, 1);
}

async function main() {
  seedProduct();

  await testPromoReservationCanBeReusedBySameOrder();
  await testPromoSwitchAndRemovalOnSameOrder();
  await testPromoConsumedAndReturnedToReservedByAdmin();
  await testIssueAndPaymentRollbackSyncPromoUsage();

  console.log("[promo-lifecycle-smoke] OK");
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
