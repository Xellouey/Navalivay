/**
 * Чистая логика подсчёта «сообщений с клиентом» для CRM-списка заказов.
 * Источник истины в БД: `bot_message_log` (in + out), см. crm-operations.js.
 *
 * Важно для гипотезы «счётчик маленький»: это НЕ полная история Telegram,
 * только то, что попало в журнал с момента включения логирования
 * (userbot NewMessage + исходящие через userbot / business-bot).
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
 * @param {Map<string, number>} messagesCountByTgId
 */
export function pickClientMessagesCount(telegramId, messagesCountByTgId) {
  if (telegramId === null || telegramId === undefined || telegramId === '') {
    return 0;
  }
  return messagesCountByTgId.get(String(telegramId)) ?? 0;
}
