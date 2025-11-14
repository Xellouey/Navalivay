import Database from './server/node_modules/better-sqlite3/lib/index.js';

const db = new Database('./server/data/navalivay.db');

console.log('=== Создание тестовых delivered заказов ===\n');

// Получаем заказы в статусе new или in_progress
const orders = db.prepare(`
  SELECT id, order_number, status, final_amount, profit, created_at
  FROM orders
  WHERE status IN ('new', 'in_progress')
  LIMIT 5
`).all();

console.log(`Найдено заказов для преобразования: ${orders.length}\n`);

if (orders.length > 0) {
  const tx = db.transaction(() => {
    for (const order of orders) {
      // Устанавливаем completed_at - разные даты для разных месяцев
      let completedAt;
      const orderIndex = orders.indexOf(order);
      
      if (orderIndex === 0) {
        // Октябрь 2024
        completedAt = '2024-10-15T14:30:00.000Z';
      } else if (orderIndex === 1) {
        // Ноябрь 2024
        completedAt = '2024-11-20T10:15:00.000Z';
      } else if (orderIndex === 2) {
        // Декабрь 2024
        completedAt = '2024-12-05T16:45:00.000Z';
      } else {
        // Текущий месяц
        completedAt = new Date().toISOString();
      }
      
      db.prepare(`
        UPDATE orders 
        SET status = 'delivered', completed_at = ?
        WHERE id = ?
      `).run(completedAt, order.id);
      
      console.log(`✓ Заказ #${order.order_number}: ${order.status} → delivered (${completedAt})`);
      console.log(`  Сумма: ${order.final_amount}₽, Прибыль: ${order.profit}₽\n`);
    }
  });
  
  tx();
  
  console.log('Готово! Заказы переведены в статус delivered.');
} else {
  console.log('Нет заказов для преобразования.');
}

db.close();
