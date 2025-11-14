import { db } from './db.js';

/**
 * Удаляет выданные заказы (статус 'delivered'), которые были выданы раньше сегодняшнего дня.
 * Запускается при старте сервера и каждый день в полночь.
 */
export function cleanupOldDeliveredOrders() {
  try {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    console.log(`[cleanup] Cleaning up delivered orders older than ${startOfToday.toISOString()}`);

    // Получаем заказы для удаления (для логирования)
    const ordersToDelete = db.prepare(`
      SELECT id, order_number, completed_at
      FROM orders
      WHERE status = 'delivered' AND completed_at < ?
    `).all(startOfToday.toISOString());

    if (ordersToDelete.length === 0) {
      console.log('[cleanup] No old delivered orders to delete');
      return { deleted: 0 };
    }

    console.log(`[cleanup] Found ${ordersToDelete.length} old delivered orders to delete`);

    // Удаляем в транзакции
    const tx = db.transaction(() => {
      for (const order of ordersToDelete) {
        console.log(`[cleanup] Deleting order #${order.order_number} (completed at: ${order.completed_at})`);

        // Удаляем позиции заказа
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(order.id);

        // Удаляем историю статусов заказа (если есть)
        try {
          db.prepare('DELETE FROM order_status_history WHERE order_id = ?').run(order.id);
        } catch (err) {
          // Таблица может не существовать в старых версиях
          console.warn(`[cleanup] Could not delete status history for order ${order.id}:`, err.message);
        }

        // Удаляем сам заказ
        db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
      }
    });

    tx();

    console.log(`[cleanup] Successfully deleted ${ordersToDelete.length} old delivered orders`);
    return { deleted: ordersToDelete.length };
  } catch (error) {
    console.error('[cleanup] Error cleaning up old delivered orders:', error);
    return { deleted: 0, error: error.message };
  }
}

/**
 * Планирует выполнение очистки каждый день в полночь (00:00 UTC)
 */
export function scheduleCleanup() {
  // Вычисляем время до следующей полуночи UTC
  function getMillisecondsUntilMidnight() {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    return midnight.getTime() - now.getTime();
  }

  // Запускаем первую очистку через время до полуночи
  const msUntilMidnight = getMillisecondsUntilMidnight();
  console.log(`[cleanup] Scheduled next cleanup in ${Math.round(msUntilMidnight / 1000 / 60)} minutes (at midnight UTC)`);

  setTimeout(() => {
    cleanupOldDeliveredOrders();

    // После первого запуска в полночь запускаем каждые 24 часа
    setInterval(() => {
      cleanupOldDeliveredOrders();
    }, 24 * 60 * 60 * 1000); // 24 часа
  }, msUntilMidnight);
}
