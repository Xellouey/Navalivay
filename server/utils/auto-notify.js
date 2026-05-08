/**
 * Автоматическая отправка статусных уведомлений клиенту при смене статуса
 * заказа. Раньше менеджер должен был вручную нажать кнопку «Отправить
 * клиенту» в OrderBotNotifier — Костя на это жаловался (8.05.2026):
 * «нужно нажали собрано → ему отослалось». Теперь триггер — сам PATCH
 * статуса заказа.
 *
 * Контракт: вернуть { sent, reason?, telegram_message_id?, event?, skipped? }
 * вместо throw — caller (PATCH /orders/:id) не должен падать, если
 * уведомление не ушло. Фронт по этому полю показывает плашку.
 *
 * Условия (любое нарушение даёт sent=false с осмысленной причиной):
 *   1. Это не reactivate (восстановление из cancelled).
 *   2. previousStatus !== newStatus (статус действительно сменился).
 *   3. У newStatus есть mapping в STATUS_TO_EVENT.
 *   4. Шаблон события активен (is_active = 1) и не пустой (template_empty).
 *   5. У клиента привязан telegram_id и он верифицирован (был хоть один
 *      заказ, ИЛИ прошёл /start с кодом из прайса).
 *   6. Есть активный business_connection (менеджер подключил бота в
 *      Telegram → Деловой режим).
 *   7. Telegram Bot API ответил ok=true (BOT_TOKEN живой, чат существует
 *      и т.п.). Это последняя стадия — sendResult.error всплывает в reason.
 *
 * Условия 1-6 → skipped=true (намеренно не отправили). Условие 7 → skipped
 * не выставляется (попытка была), reason содержит описание ошибки Telegram.
 */

import {
  prepareStatusNotification,
  isCustomerVerified,
  getActiveBusinessConnection,
  logBotMessage,
} from './business-bot.js';
import { sendBusinessMessage } from './telegram-business-api.js';

/**
 * Маппинг статусов заказа на event-ключи в bot_status_templates.
 *
 * - new          → не шлём (заказ только создан, само сообщение «новый» не делаем)
 * - in_progress  → order_assembled («собран»)
 * - completed    → order_issued («выдан»)
 * - delivered    → order_issued (тот же шаблон, разница только бухгалтерская)
 * - cancelled    → order_cancelled
 *
 * При reactivate (cancelled → previous_status) caller должен передавать
 * флаг `reactivate=true` — мы пропускаем, чтобы клиент не получил «ваш
 * заказ собран снова», что звучит абсурдно.
 */
export const STATUS_TO_EVENT = Object.freeze({
  in_progress: 'order_assembled',
  completed: 'order_issued',
  delivered: 'order_issued',
  cancelled: 'order_cancelled',
});

/**
 * @param {object} args
 * @param {string} args.orderId
 * @param {string} args.newStatus  — новый статус заказа после PATCH
 * @param {string|null} [args.previousStatus] — что было до смены
 * @param {boolean} [args.reactivate=false] — это восстановление из cancelled?
 * @returns {Promise<{sent: boolean, reason?: string, event?: string, telegram_message_id?: number|null, skipped?: boolean}>}
 *   - sent=true:        ушло в Telegram (telegram_message_id может быть null,
 *                       если Telegram вернул ok=true без message_id — редко)
 *   - sent=false +
 *     skipped=true:     не отправили намеренно (reason описывает причину)
 *   - sent=false +
 *     skipped не задан: попытка была, Telegram отказал (reason — описание)
 */
export async function autoNotifyForStatusChange({
  orderId,
  newStatus,
  previousStatus = null,
  reactivate = false,
} = {}) {
  // Восстановление из cancelled — это техническая операция, клиент не должен
  // получить «ваш заказ собран» как реакцию на исправление ошибки менеджера.
  if (reactivate) {
    return { sent: false, skipped: true, reason: 'reactivation_skipped' };
  }

  // Если статус не изменился — нечего отправлять.
  if (previousStatus && previousStatus === newStatus) {
    return { sent: false, skipped: true, reason: 'status_unchanged' };
  }

  const event = STATUS_TO_EVENT[newStatus];
  if (!event) {
    return { sent: false, skipped: true, reason: 'no_event_for_status' };
  }

  // Шаг 1: подготовить текст по шаблону. Тут же вычитываются order/customer.
  const prepared = prepareStatusNotification({ orderId, event });
  if (!prepared.ok) {
    return { sent: false, skipped: true, reason: prepared.reason, event };
  }

  // Шаг 2: верификация клиента — без этого Telegram Business не разрешит
  // боту писать в чат (нет инициированного диалога). Это и было ограничение,
  // про которое Костя написал: «всё равно человек пишет нам первый, чтобы
  // получить прайс — это и есть инициация».
  if (!isCustomerVerified(prepared.customerTelegramId)) {
    return { sent: false, skipped: true, reason: 'customer_not_verified', event };
  }

  // Шаг 3: активный business_connection. Если менеджер не подключил бота
  // в Telegram → Деловой режим, отправлять некуда.
  const active = getActiveBusinessConnection();
  if (!active) {
    return { sent: false, skipped: true, reason: 'no_active_connection', event };
  }

  // Шаг 4: реальная отправка через Telegram Bot API (см. fix от 8.05.2026
  // про PM2 multi-process — API процесс шлёт напрямую, не через bot-процесс).
  const sendResult = await sendBusinessMessage({
    businessConnectionId: active.id,
    chatId: prepared.chatId,
    text: prepared.text,
  });

  // Шаг 5: лог в bot_message_log — чтобы и автомат, и старая ручная кнопка
  // в едином журнале. order_id кладём в meta для фильтрации в timeline.
  //
  // logBotMessage кидает на SQLITE_BUSY и т.п. Мы НЕ хотим, чтобы сбой
  // журналирования инвертировал результат отправки: если в Telegram уже
  // ушло, sent должен остаться true. Иначе фронт покажет «не ушло», а
  // клиент получил сообщение — менеджер будет слать ещё раз.
  const baseLog = {
    businessConnectionId: active.id,
    chatId: prepared.chatId,
    customerId: prepared.customerId,
    customerTelegramId: prepared.customerTelegramId,
    direction: 'out',
    messageType: 'status',
    templateKind: 'status',
    templateId: prepared.templateId,
    templateEvent: event,
    text: prepared.text,
  };

  function safeLog(meta) {
    try {
      logBotMessage({ ...baseLog, meta });
    } catch (logErr) {
      console.error('[auto-notify] logBotMessage failed:', logErr);
    }
  }

  if (sendResult.ok) {
    safeLog({ order_id: orderId, auto: true, outcome: 'sent' });
    return {
      sent: true,
      event,
      telegram_message_id: sendResult.telegramMessageId ?? null,
    };
  }

  safeLog({ order_id: orderId, auto: true, outcome: 'failed', error: sendResult.error });
  return { sent: false, reason: sendResult.error || 'send_failed', event };
}
