/**
 * Bridge от api-процесса к userbot-процессу через локальный HTTP.
 *
 * Зачем отдельный процесс: GramJS держит постоянное MTProto-соединение,
 * перезапуск api при каждом деплое его рвал бы. Userbot живёт в своём
 * PM2-процессе `navalivay-userbot`, рестартится отдельно.
 *
 * Контракт:
 *   - sendViaUserbot({ chatId, text, orderId? }) → { ok, telegram_message_id?, error? }
 *   - isUserbotAvailable() → быстро (без таймаута) проверяет /health
 *
 * Caller (auto-notify.js) сначала пытается через userbot, при неуспехе
 * фоллбэкается на Business mode (sendBusinessMessage из telegram-business-api).
 */

const USERBOT_BASE = `http://127.0.0.1:${process.env.USERBOT_HTTP_PORT || 8083}`;
const SHARED_SECRET = (process.env.USERBOT_SECRET || '').trim();
const HEALTH_TIMEOUT_MS = 1500;
const SEND_TIMEOUT_MS = 20_000;

/**
 * Кэш health-status на 30 секунд: при шторме исходящих не дёргать /health
 * перед каждой отправкой. Если userbot фоллнул — кэш «не доступен» на 30с
 * и api-процесс пойдёт сразу на Business mode fallback, не теряя
 * время на тщетные запросы.
 */
let healthCache = null; // { value: boolean, expiresAt: number }
const HEALTH_CACHE_OK_MS = 30_000;
const HEALTH_CACHE_FAIL_MS = 10_000;

export async function isUserbotAvailable() {
  if (healthCache && Date.now() < healthCache.expiresAt) {
    return healthCache.value;
  }
  let ok = false;
  try {
    const r = await fetch(`${USERBOT_BASE}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (r.ok) {
      const data = await r.json().catch(() => ({}));
      ok = Boolean(data?.ok && data?.connected);
    }
  } catch {
    ok = false;
  }
  healthCache = {
    value: ok,
    expiresAt: Date.now() + (ok ? HEALTH_CACHE_OK_MS : HEALTH_CACHE_FAIL_MS),
  };
  return ok;
}

/**
 * Отправить сообщение через userbot. Бросает только при сетевых сбоях
 * локального HTTP — иначе всегда возвращает объект с ok/error.
 */
export async function sendViaUserbot({ chatId, text, orderId = null } = {}) {
  if (!chatId || !text) {
    return { ok: false, error: 'invalid_payload' };
  }
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (SHARED_SECRET) headers['X-Userbot-Secret'] = SHARED_SECRET;
    const r = await fetch(`${USERBOT_BASE}/send-message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ chat_id: String(chatId), text: String(text), order_id: orderId }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.ok) {
      // Сбрасываем health-кэш — раз userbot вернул не-ok, в следующий раз
      // лучше перепроверить, может уже мёртвый.
      healthCache = null;
      return { ok: false, error: data?.error || `http_${r.status}` };
    }
    return { ok: true, telegram_message_id: data.telegram_message_id ?? null };
  } catch (err) {
    healthCache = null;
    const errorText = err instanceof Error ? err.message : String(err);
    return { ok: false, error: errorText };
  }
}
