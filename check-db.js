import Database from './server/node_modules/better-sqlite3/lib/index.js';

const db = new Database('./server/data/navalivay.db');

console.log('=== Структура БД ===\n');

const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' 
  ORDER BY name
`).all();
console.log('Таблицы в БД:', tables.map(t => t.name).join(', '));

if (tables.some(t => t.name === 'orders')) {
  console.log('\n=== Проверка заказов ===\n');
  
  const total = db.prepare('SELECT COUNT(*) as count FROM orders').get();
  console.log('Всего заказов:', total.count);
  
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM orders 
    GROUP BY status
  `).all();
  console.log('\nПо статусам:');
  byStatus.forEach(row => console.log(`  ${row.status}: ${row.count}`));
  
  const completed = db.prepare(`
    SELECT COUNT(*) as count 
    FROM orders 
    WHERE status IN ('completed', 'delivered')
  `).get();
  console.log('\nЗавершенных/выданных:', completed.count);
  
  if (completed.count > 0) {
    const sample = db.prepare(`
      SELECT id, order_number, status, final_amount, profit, created_at
      FROM orders 
      WHERE status IN ('completed', 'delivered')
      LIMIT 3
    `).all();
    console.log('\nПример заказов:');
    sample.forEach(order => {
      console.log(`  #${order.order_number} - ${order.status} - ${order.final_amount}₽ (прибыль: ${order.profit}₽) - ${order.created_at}`);
    });
  }
  
  const years = db.prepare(`
    SELECT DISTINCT CAST(strftime('%Y', created_at) AS INTEGER) AS year
    FROM orders
    WHERE status IN ('completed', 'delivered')
    ORDER BY year ASC
  `).all();
  console.log('\nГоды с заказами:', years.map(r => r.year).join(', '));
} else {
  console.log('\n⚠️  Таблица orders не найдена!');
}

db.close();
