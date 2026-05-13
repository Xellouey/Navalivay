/**
 * Чистая логика подсчёта «сообщений с клиентом» для CRM-списка заказов.
 * Источники (по приоритету):
 *   1. exact_message_count из userbot_entities (фоновый getHistory)
 *   2. initial_message_count из userbot_entities (topMessage при prefetch)
 *   3. COUNT(bot_message_log) — только то, что попало в журнал с момента
 *      включения логирования.
 *
 * Результат: GREATEST из всех доступных, что даёт максимально точную
 * аппроксимацию общего числа сообщений в чате клиента.
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
 * Строит Map<telegram_id, exact_message_count> из userbot_entities.
 * exact_message_count приоритетнее initial_message_count — если он есть,
 * берём его; иначе initial_message_count, иначе undefined.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string[]} tgIds массив telegram_id
 * @returns {Map<string, number>}
 */
export function buildTopMessageCountMap(db, tgIds) {
  const map = new Map();
  if (!tgIds || tgIds.length === 0) return map;
  const placeholders = tgIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT telegram_id,
           COALESCE(exact_message_count, initial_message_count) AS msg_count
    FROM userbot_entities
    WHERE telegram_id IN (${placeholders})
      AND (exact_message_count IS NOT NULL OR initial_message_count IS NOT NULL)
  `).all(...tgIds.map(String));
  for (const row of rows) {
    map.set(String(row.telegram_id), Number(row.msg_count) || 0);
  }
  return map;
}

/**
 * @param {string|null|undefined} telegramId customer.telegram_id из заказа
 * @param {Map<string, number>} messagesCountByTgId из bot_message_log
 * @param {Map<string, number>} topMessageCountMap из userbot_entities (exact / initial)
 * @returns {number} GREATEST из всех доступных источников
 */
export function pickClientMessagesCount(telegramId, messagesCountByTgId, topMessageCountMap = new Map()) {
  if (telegramId === null || telegramId === undefined || telegramId === '') {
    return 0;
  }
  const key = String(telegramId);
  const loggedCount = messagesCountByTgId.get(key) ?? 0;
  const topMsg = topMessageCountMap.get(key) ?? 0;
  return Math.max(loggedCount, topMsg);
}
