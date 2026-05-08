/**
 * Прямые вызовы Telegram Bot API для Business mode.
 *
 * На проде у нас два PM2-процесса: `navalivay-api` (Express endpoints)
 * и `navalivay-bot` (Telegraf long-polling). У них отдельная память,
 * поэтому API-процесс НЕ может позвать функцию из bot-процесса через
 * globalThis или import. Раньше я регистрировал sender как globalThis —
 * локально работало (один процесс), а в проде API всегда видел undefined.
 *
 * Решение: для исходящих сообщений (notify-status, send-price) API
 * стучится в Telegram Bot API напрямую через fetch с тем же BOT_TOKEN.
 * bot-процесс остаётся только для входящих событий (long-polling
 * `business_connection`, `business_message`).
 *
 * BOT_TOKEN читается один раз при импорте — он не меняется в рантайме
 * (env у обоих процессов — один и тот же systemd/PM2 envFile).
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const REQUEST_TIMEOUT_MS = 10_000;

function getBotToken() {
  return (process.env.BOT_TOKEN || '').trim();
}

/**
 * Скрывает BOT_TOKEN, если он попал в текст ошибки (например, Node может
 * включать request URL в err.message/err.cause). Без этого токен мог бы
 * утечь в stdout/PM2 logs/HTTP response через `detail` поле.
 */
function redactToken(text) {
  const token = getBotToken();
  if (!token) return text;
  return String(text).split(token).join('[BOT_TOKEN]');
}

/**
 * Отправляет сообщение от имени владельца Business-аккаунта.
 *
 * @param {object} args
 * @param {string} args.businessConnectionId — id из business_connection update
 * @param {string|number} args.chatId — id чата с клиентом
 * @param {string} args.text — текст сообщения
 * @returns {Promise<{ok: boolean, telegramMessageId?: number, error?: string}>}
 *
 * Раньше в bot.js был хелпер sendBusinessNotification, экспортированный
 * через globalThis — этот модуль его заменил. Логирование (logBotMessage)
 * теперь делает caller (routes/crm.js: sendNotificationViaBot), потому
 * что у него больше контекста: customer_id, template_id и т.д.
 */
export async function sendBusinessMessage({ businessConnectionId, chatId, text } = {}) {
  if (!businessConnectionId || !chatId || !text) {
    return { ok: false, error: 'invalid_payload' };
  }
  const token = getBotToken();
  if (!token) {
    return { ok: false, error: 'bot_token_missing' };
  }
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text: String(text),
        business_connection_id: String(businessConnectionId),
      }),
      // Без таймаута fetch может зависнуть при сетевой деградации Telegram —
      // тогда HTTP-handler /notify-status будет держать соединение клиента.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) {
      const description = redactToken(data?.description || `http_${response.status}`);
      console.error('[telegram-business-api] sendMessage failed:', description);
      return { ok: false, error: description };
    }
    const telegramMessageId = data.result?.message_id ?? null;
    if (telegramMessageId === null) {
      // Защита: Telegram теоретически не возвращает ok=true без message_id,
      // но если такое случится — увидим в логах вместо тихой записи null
      // в bot_message_log.
      console.warn('[telegram-business-api] sendMessage ok=true without message_id');
    }
    return { ok: true, telegramMessageId };
  } catch (err) {
    const rawText = err instanceof Error ? err.message : String(err);
    const errorText = redactToken(rawText);
    console.error('[telegram-business-api] fetch error:', errorText);
    return { ok: false, error: errorText };
  }
}

/**
 * Проверка валидности BOT_TOKEN через getMe. Используется в /bot/status,
 * чтобы UI отличал «токен не задан» от «токен задан, но сломан / Telegram
 * вернул 401».
 *
 * Кэшируется в памяти. Раздельные TTL:
 *   - success: 60с — health-check на каждый рендер админки был бы перебором.
 *   - failure: 10с — если Telegram временно отвечает 5xx или сеть моргнула,
 *     не залипаем на минуту с ложным «токен битый», но и не штормим API
 *     (без кэша network-flap превратится в десятки запросов в секунду).
 */
let getMeCache = null; // { value, expiresAt }
const GET_ME_TTL_OK_MS = 60_000;
const GET_ME_TTL_FAIL_MS = 10_000;

export async function checkBotTokenLive() {
  const token = getBotToken();
  if (!token) return { ok: false, reason: 'token_missing' };
  if (getMeCache && Date.now() < getMeCache.expiresAt) {
    return getMeCache.value;
  }
  let result;
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getMe`, {
      method: 'GET',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));
    result =
      response.ok && data?.ok
        ? {
            ok: true,
            username: data.result?.username,
            can_connect_to_business: data.result?.can_connect_to_business ?? false,
          }
        : {
            ok: false,
            reason: redactToken(data?.description || `http_${response.status}`),
          };
  } catch (err) {
    const rawText = err instanceof Error ? err.message : String(err);
    result = { ok: false, reason: redactToken(rawText) };
  }
  // Кэшируем оба исхода, но с разным TTL — иначе network-storm на падающем
  // канале ляжет на Telegram API.
  const ttl = result.ok ? GET_ME_TTL_OK_MS : GET_ME_TTL_FAIL_MS;
  getMeCache = { value: result, expiresAt: Date.now() + ttl };
  return result;
}
