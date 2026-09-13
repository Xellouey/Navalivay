/**
 * Счета и кассы: удаление счёта.
 *
 * Главное, что здесь проверяется: счёт с транзакциями удаляется, а сами
 * транзакции остаются. Раньше ручка отвечала 409 has_transactions и советовала
 * «сначала удалите все транзакции», хотя транзакции заказов и продаж через
 * кассу удалить нельзя вовсе — счёт залипал в CRM навсегда.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'navalivay-cash-accounts-'));
process.env.DATABASE_FILE = path.join(tempDir, 'test.db');
process.env.BOT_TOKEN = '';

const { initDb, db } = await import('../db.js');
const { issueToken } = await import('../auth.js');
const { crmFinanceRouter } = await import('../routes/crm-finance.js');

initDb();

const app = express();
app.use(express.json());
app.use(crmFinanceRouter);

const server = await new Promise((resolve) => {
  const instance = app.listen(0, () => resolve(instance));
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const authToken = issueToken('test-admin');

function authHeaders() {
  return { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' };
}

async function requestJson(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, { headers: authHeaders(), ...options });
  const data = await response.json().catch(() => null);
  return { response, data };
}

async function createAccount(name, extra = {}) {
  const { response, data } = await requestJson('/api/admin/crm/cash-accounts', {
    method: 'POST',
    body: JSON.stringify({ name, ...extra }),
  });
  assert.equal(response.status, 200, `не создался счёт ${name}`);
  return data;
}

function accountRow(id) {
  return db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(id);
}

function countTransactions(accountId) {
  return db
    .prepare('SELECT COUNT(*) AS n FROM cash_transactions WHERE account_id = ?')
    .get(accountId).n;
}

let orderSeq = 0;
function insertPaidOrder({ accountId = null, transactionId = null } = {}) {
  orderSeq += 1;
  const orderId = `ord_test_${orderSeq}`;
  db.prepare(
    'INSERT INTO orders (id, order_number, payment_account_id) VALUES (?, ?, ?)',
  ).run(orderId, 9000 + orderSeq, accountId);
  if (transactionId) {
    db.prepare(
      `INSERT INTO cash_transactions (id, account_id, type, amount, description, order_id)
       VALUES (?, ?, 'income', 45, 'Оплата заказа (наличные)', ?)`,
    ).run(transactionId, accountId, orderId);
  }
  return orderId;
}

// Счёт, на котором висит транзакция заказа, обязан удаляться: такую транзакцию
// не убрать ни ручкой (409 linked_order), ни из интерфейса.
async function testDeleteAccountWithOrderTransaction() {
  const account = await createAccount('Акциз');
  insertPaidOrder({ accountId: account.id, transactionId: 'trans_excise_1' });
  assert.equal(countTransactions(account.id), 1);

  const { response } = await requestJson(`/api/admin/crm/cash-accounts/${account.id}`, {
    method: 'DELETE',
  });
  assert.equal(response.status, 200, 'счёт с транзакцией не удалился');

  const list = await requestJson('/api/admin/crm/cash-accounts');
  assert.ok(
    !list.data.some((item) => item.id === account.id),
    'удалённый счёт всё ещё в списке',
  );

  assert.equal(countTransactions(account.id), 1, 'транзакции счёта пропали вместе со счётом');

  // Обещание в окне подтверждения: «транзакции останутся в журнале».
  const journal = await requestJson('/api/admin/crm/cash-transactions');
  const kept = journal.data.find((item) => item.id === 'trans_excise_1');
  assert.ok(kept, 'транзакция скрытого счёта пропала из журнала');
  assert.equal(kept.account_name, 'Акциз', 'у транзакции потерялось название счёта');
  assert.equal(accountRow(account.id).active, 0, 'счёт не помечен скрытым');

  return account.id;
}

// Жёсткое DELETE такого счёта падало бы на внешнем ключе orders.payment_account_id
// (NO ACTION) и отдавало 500 без внятной причины.
async function testDeleteAccountReferencedByOrder() {
  const account = await createAccount('Зевс');
  insertPaidOrder({ accountId: account.id });

  const { response, data } = await requestJson(
    `/api/admin/crm/cash-accounts/${account.id}`,
    { method: 'DELETE' },
  );
  assert.equal(response.status, 200, `счёт из оплаченного заказа не удалился: ${JSON.stringify(data)}`);
  assert.equal(accountRow(account.id).active, 0);
}

// Касса по умолчанию должна остаться ровно одна и живая: приёмка закупки ищет
// счёт именно по is_default и молча не списывает деньги, если не нашла.
async function testDefaultFlagMovesToLivingAccount() {
  const account = await createAccount('Основная', { is_default: true });
  assert.equal(accountRow(account.id).is_default, 1);

  const { response } = await requestJson(`/api/admin/crm/cash-accounts/${account.id}`, {
    method: 'DELETE',
  });
  assert.equal(response.status, 200);

  assert.equal(accountRow(account.id).is_default, 0, 'у скрытого счёта остался флаг «по умолчанию»');

  const defaults = db
    .prepare('SELECT id FROM cash_accounts WHERE is_default = 1 AND active = 1')
    .all();
  assert.equal(defaults.length, 1, `касс по умолчанию должно быть ровно 1, а их ${defaults.length}`);
  assert.notEqual(defaults[0].id, account.id);
}

// Новые деньги на скрытый счёт не проводятся: иначе они уедут туда, где их
// никто не увидит.
async function testHiddenAccountRejectsNewTransaction(hiddenId) {
  const { response, data } = await requestJson('/api/admin/crm/cash-transactions', {
    method: 'POST',
    body: JSON.stringify({ account_id: hiddenId, type: 'income', amount: 10 }),
  });
  assert.equal(response.status, 404);
  assert.equal(data.error, 'account_not_found');
}

async function testRepeatedDeleteIsOk(hiddenId) {
  const { response } = await requestJson(`/api/admin/crm/cash-accounts/${hiddenId}`, {
    method: 'DELETE',
  });
  assert.equal(response.status, 200, 'повторное удаление должно быть безобидным');
}

async function testLastActiveAccountIsProtected() {
  const active = db.prepare('SELECT id FROM cash_accounts WHERE active = 1').all();
  assert.ok(active.length >= 1);
  const survivor = active[0].id;
  for (const row of active.slice(1)) {
    db.prepare('UPDATE cash_accounts SET active = 0 WHERE id = ?').run(row.id);
  }

  const { response, data } = await requestJson(`/api/admin/crm/cash-accounts/${survivor}`, {
    method: 'DELETE',
  });
  assert.equal(response.status, 409);
  assert.equal(data.error, 'last_account');
  assert.equal(accountRow(survivor).active, 1, 'последний счёт всё-таки скрыли');
}

async function testUnknownAccount() {
  const { response, data } = await requestJson('/api/admin/crm/cash-accounts/acc_missing', {
    method: 'DELETE',
  });
  assert.equal(response.status, 404);
  assert.equal(data.error, 'not_found');
}

try {
  const hiddenId = await testDeleteAccountWithOrderTransaction();
  await testDeleteAccountReferencedByOrder();
  await testDefaultFlagMovesToLivingAccount();
  await testHiddenAccountRejectsNewTransaction(hiddenId);
  await testRepeatedDeleteIsOk(hiddenId);
  await testUnknownAccount();
  await testLastActiveAccountIsProtected();
  console.log('cash-accounts tests passed');
} finally {
  server.close();
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
