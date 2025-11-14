import { db } from './db.js';

/**
 * Архивирует выданные заказы (статус 'delivered'), которые были выданы раньше сегодняшнего дня.
 * Запускается при старте сервера и каждый день в полночь.
 * Заказы не удаляются, а помечаются как archived=1 для сохранения исторических данных.
 */
export function archiveOldDeliveredOrders() {
  try {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    console.log(`[archive] Archiving delivered orders older than ${startOfToday.toISOString()}`);

    // Получаем заказы для архивации (статусы 'delivered' и 'completed')
    const ordersToArchive = db.prepare(`
      SELECT id, order_number, status, completed_at
      FROM orders
      WHERE (status = 'delivered' OR status = 'completed')
        AND archived = 0
        AND (completed_at IS NULL OR completed_at < ?)
    `).all(startOfToday.toISOString());

    if (ordersToArchive.length === 0) {
      console.log('[archive] No old delivered orders to archive');
      return { archived: 0 };
    }

    console.log(`[archive] Found ${ordersToArchive.length} old delivered orders to archive`);

    // Архивируем в транзакции
    const tx = db.transaction(() => {
      for (const order of ordersToArchive) {
        console.log(`[archive] Archiving order #${order.order_number} (completed at: ${order.completed_at})`);
        db.prepare('UPDATE orders SET archived = 1 WHERE id = ?').run(order.id);
      }
    });

    tx();

    console.log(`[archive] Successfully archived ${ordersToArchive.length} old delivered orders`);
    return { archived: ordersToArchive.length };
  } catch (error) {
    console.error('[archive] Error archiving old delivered orders:', error);
    return { archived: 0, error: error.message };
  }
}

/**
 * Планирует выполнение архивации каждый день в полночь (00:00 UTC)
 */
export function scheduleArchiving() {
  // Вычисляем время до следующей полуночи UTC
  function getMillisecondsUntilMidnight() {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    return midnight.getTime() - now.getTime();
  }

  // Запускаем первую архивацию через время до полуночи
  const msUntilMidnight = getMillisecondsUntilMidnight();
  console.log(`[archive] Scheduled next archiving in ${Math.round(msUntilMidnight / 1000 / 60)} minutes (at midnight UTC)`);

  setTimeout(() => {
    archiveOldDeliveredOrders();

    // После первого запуска в полночь запускаем каждые 24 часа
    setInterval(() => {
      archiveOldDeliveredOrders();
    }, 24 * 60 * 60 * 1000); // 24 часа
  }, msUntilMidnight);
}
