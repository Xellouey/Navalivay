import { initDb, db } from '../db.js';

initDb();

const searches = ['PODONKI PODGON', 'Xros 0.4', 'ICEBERG 150', 'Xros 5 Mini', 'ананас', 'хуйня'];

for (const s of searches) {
  const groups = db
    .prepare(
      `SELECT cg.id, cg.name, c.name AS cat
       FROM category_groups cg
       JOIN categories c ON c.id = cg.categoryId
       WHERE cg.name LIKE ?
       LIMIT 5`,
    )
    .all(`%${s}%`);
  const products = db
    .prepare(
      `SELECT p.id, p.title, cg.name AS grp, c.name AS cat
       FROM products p
       JOIN category_groups cg ON cg.id = p.groupId
       JOIN categories c ON c.id = cg.categoryId
       WHERE p.title LIKE ? OR cg.name LIKE ?
       LIMIT 10`,
    )
    .all(`%${s}%`, `%${s}%`);
  console.log('---', s);
  console.log('groups:', JSON.stringify(groups, null, 0));
  console.log('products:', JSON.stringify(products, null, 0));
}

const cust = db
  .prepare(
    `SELECT id, telegram_id, telegram_username, first_name
     FROM customers
     WHERE LOWER(telegram_username) = 'rk0ff' OR telegram_id = '2035055116'`,
  )
  .get();
console.log('customer:', JSON.stringify(cust));