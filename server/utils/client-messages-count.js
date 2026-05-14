/**
 * Чистая логика подсчёта «сообщений с клиентом» для CRM-списка заказов.
 * Считаем ТОЛЬКО по bot_message_log — реальные сообщения через нашу
 * систему (авто-уведомления, ручные отправки, входящие через бот).
 * Это гарантирует что счётчик показывает только верифицированных
 * клиентов (тех, кто прошёл через бот и получил прайс), а не любых
 * людей с которыми менеджер мог переписываться в Telegram.
 *
 * Константин 14.05.2026: «нет диалога — нет обслуживания. Мы должны
 * понимать, что это наш клиент, у него должен быть выдан прайс.»
 */

/**
 * @param {Array<{ chat_id: string|number, n: number }>} countRows результат SQL GROUP BY chat_id
 * @returns {Map<string, number>}
 */
export function buildChatMessageCountMap(countRows) {
  const map = new Map();
  for (const row of countRows || []) {
    map.set(String(row.chat_id), Number(row.n) || 0);
  }
  return map;
}

/**
 * @param {string|null|undefined} telegramId customer.telegram_id из заказа
 * @param {Map<string, number>} messagesCountByTgId из bot_message_log
 * @returns {number} количество сообщений из bot_message_log (0 если нет)
 */
export function pickClientMessagesCount(telegramId, messagesCountByTgId) {
  if (telegramId === null || telegramId === undefined || telegramId === '') {
    return 0;
  }
  const key = String(telegramId);
  return messagesCountByTgId.get(key) ?? 0;
}
