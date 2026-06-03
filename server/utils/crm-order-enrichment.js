/**
 * Обогащение строк заказов связями (items, notify, returning, blocked).
 * Вынесено из crm-operations.js для board-sync и batch-fetch.
 */

export function describeAutoNotifyReason(reason, error) {
  if (!reason && !error) return null;
  const key = String(reason || '').trim();
  switch (key) {
    case 'order_not_found':
      return 'Заказ не найден.';
    case 'customer_has_no_telegram_id':
      return 'У клиента не привязан Telegram.';
    case 'template_inactive_or_missing':
      return 'Шаблон сообщения выключен в настройках бота.';
    case 'template_empty':
      return 'Шаблон пустой. Заполните текст в настройках бота.';
    case 'customer_blocked':
      return 'Клиент заблокирован, уведомления ему не уходят.';
    case 'customer_not_verified':
      return 'Клиент ещё не подтвердил Telegram. Пусть нажмёт /start в боте.';
    case 'userbot_ambiguous':
      return 'Telegram не ответил вовремя. Проверьте чат с клиентом перед повторной отправкой.';
    case 'no_active_connection':
      return 'Бот не подключён к Telegram. Проверьте подключение в настройках.';
    case 'client_inactive_over_24h':
      return 'Клиент молчит больше 24 часов. Telegram запрещает писать первым, подождите ответа.';
    case 'entity_not_found_no_dialog':
      return 'Клиент не найден в Telegram. Возможно username изменён или аккаунт удалён. Напишите клиенту первыми вручную — если диалог появится, следующие уведомления уйдут автоматически.';
    default:
      return error || reason || null;
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {Array<Record<string, unknown>>} orders
 */
export function enrichOrdersWithRelations(db, orders) {
  if (!orders?.length) return [];

  const orderIds = orders.map((order) => order.id);
  const placeholders = orderIds.map(() => '?').join(',');

  const itemsRows = db
    .prepare(
      `
        SELECT oi.*, p.description as product_description
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id IN (${placeholders})
      `,
    )
    .all(...orderIds);

  const itemsByOrder = itemsRows.reduce((acc, item) => {
    const list = acc.get(item.order_id) || [];
    list.push(item);
    acc.set(item.order_id, list);
    return acc;
  }, new Map());

  const notifyRows = db
    .prepare(
      `SELECT json_extract(meta, '$.order_id') AS order_id, meta, id
         FROM bot_message_log
        WHERE direction = 'out'
          AND json_extract(meta, '$.order_id') IN (${placeholders})
        ORDER BY id DESC`,
    )
    .all(...orderIds);

  const notifyByOrder = new Map();
  for (const row of notifyRows) {
    if (notifyByOrder.has(row.order_id)) continue;
    let parsed = {};
    try {
      parsed = JSON.parse(row.meta || '{}');
    } catch {
      /* noop */
    }
    notifyByOrder.set(row.order_id, {
      status: parsed.outcome === 'sent' ? 'sent' : 'failed',
      error: describeAutoNotifyReason(parsed.reason, parsed.error),
      via: parsed.via || parsed.source || null,
      via_attempt: parsed.via_attempt || null,
      warn:
        parsed.via_attempt === 2 && parsed.outcome === 'sent'
          ? 'Отправлено, но могло не дойти. У клиента, вероятно, включена приватность Telegram «Кто может писать: только контакты».'
          : null,
    });
  }

  const customerIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))];
  const returningMap = new Map();
  if (customerIds.length > 0) {
    const cidPlaceholders = customerIds.map(() => '?').join(',');
    const oidPlaceholders = orderIds.map(() => '?').join(',');
    const returningRows = db
      .prepare(
        `SELECT customer_id, COUNT(*) as prior
         FROM orders
         WHERE customer_id IN (${cidPlaceholders})
           AND status IN ('delivered', 'completed')
           AND id NOT IN (${oidPlaceholders})
         GROUP BY customer_id`,
      )
      .all(...customerIds, ...orderIds);
    for (const row of returningRows) {
      returningMap.set(row.customer_id, row.prior > 0);
    }
  }

  const blockedMap = new Map();
  if (customerIds.length > 0) {
    const cidPlaceholders2 = customerIds.map(() => '?').join(',');
    const blockedRows = db
      .prepare(
        `
          SELECT customer_id, 1 as blocked
          FROM customer_blocks
          WHERE customer_id IN (${cidPlaceholders2})
            AND active = 1
            AND (block_until IS NULL OR block_until > DATETIME('now'))
          GROUP BY customer_id
        `,
      )
      .all(...customerIds);
    for (const row of blockedRows) {
      blockedMap.set(row.customer_id, true);
    }
  }

  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) || [],
    auto_notification: notifyByOrder.get(order.id) || null,
    is_returning_customer: returningMap.get(order.customer_id) || false,
    is_blocked: blockedMap.get(order.customer_id) || false,
    has_userbot_access: order.has_userbot_access === 1,
  }));
}

const ORDER_SELECT_SQL = `
  SELECT
    o.*,
    COALESCE(o.telegram_username, c.telegram_username) as telegram_username,
    c.first_name || ' ' || COALESCE(c.last_name, '') as customer_name,
    c.telegram_id as customer_telegram_id,
    COALESCE(pc.has_gift, 0) as promo_has_gift,
    pc.manager_description as promo_manager_description,
    pc.customer_description as promo_customer_description,
    CASE WHEN ue.access_hash IS NOT NULL THEN 1 ELSE 0 END as has_userbot_access
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN promo_codes pc ON pc.id = o.promo_code_id
  LEFT JOIN userbot_entities ue ON ue.telegram_id = c.telegram_id
`;

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string[]} orderIds
 */
export function fetchOrderRowsByIds(db, orderIds) {
  if (!orderIds?.length) return [];
  const placeholders = orderIds.map(() => '?').join(',');
  return db
    .prepare(`${ORDER_SELECT_SQL} WHERE o.id IN (${placeholders})`)
    .all(...orderIds);
}
