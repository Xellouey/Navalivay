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

import { db } from '../db.js';
import {
  prepareStatusNotification,
  isCustomerVerified,
  getActiveBusinessConnection,
  logBotMessage,
} from './business-bot.js';
import { sendBusinessMessage } from './telegram-business-api.js';
import { sendViaUserbot, isUserbotAvailable } from './userbot-client.js';

/**
 * Telegram Business mode даёт боту писать в чат клиента, ТОЛЬКО если в
 * этом чате была активность (любая сторона написала) за последние 24
 * часа. Иначе sendMessage возвращает BUSINESS_PEER_USAGE_MISSING.
 *
 * Чтобы не дёргать Telegram впустую и сразу показывать менеджеру
 * человеческую причину, проверяем bot_message_log: было ли направление
 * 'in' от этого chat_id за последние 23 часа (берём с запасом до 24,
 * чтобы избежать гонки граничных секунд).
 *
 * Возвращает true, если активность есть; false если нет ИЛИ если в
 * нашей БД вообще нет входящих от этого чата (значит bot-процесс мог
 * пропустить апдейты — лучше попробовать всё равно, и Telegram скажет).
 */
const ACTIVITY_WINDOW_HOURS = 23;
function hasRecentInbound(chatId) {
  if (!chatId) return false;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM bot_message_log
        WHERE chat_id = ? AND direction = 'in'
          AND datetime(created_at) >= datetime('now', '-${ACTIVITY_WINDOW_HOURS} hours')`,
    )
    .get(String(chatId));
  return Number(row?.n || 0) > 0;
}

/**
 * Существует ли вообще хоть одна входящая запись от этого chat_id.
 * Если нет — возможно bot-процесс никогда не получал апдейтов от этого
 * клиента (например, прокси у бота не был настроен). Тогда не блочим
 * pre-check'ом, даём Telegram-у попробовать.
 */
function hasAnyInbound(chatId) {
  if (!chatId) return false;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM bot_message_log
        WHERE chat_id = ? AND direction = 'in'`,
    )
    .get(String(chatId));
  return Number(row?.n || 0) > 0;
}

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
 * @returns {Promise<{
 *   sent: boolean,
 *   reason?: string,
 *   event?: string,
 *   telegram_message_id?: number|null,
 *   skipped?: boolean,
 *   via?: 'userbot'|'business_mode'
 * }>}
 *   - sent=true:        ушло в Telegram (telegram_message_id может быть null,
 *                       если Telegram вернул ok=true без message_id — редко).
 *                       `via` указывает канал отправки.
 *   - sent=false +
 *     skipped=true:     не отправили намеренно (reason описывает причину).
 *   - sent=false +
 *     skipped не задан: попытка была, отправка не удалась. Особый случай:
 *                       reason='userbot_ambiguous' = userbot мог отправить,
 *                       но ответ потерян (timeout) — fallback не делаем
 *                       во избежание дубля. Менеджер должен глазами
 *                       проверить чат и при необходимости отправить через
 *                       /bot/send-custom повторно.
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
  // Сюда относится template_empty / template_not_found / order_not_found —
  // в этом случае у нас нет chatId/customerId, полноценную запись в журнал
  // не сложить. Не логируем (рамка не появится, но это и крайне редкий
  // case настройки — обычно шаблоны на месте).
  const prepared = prepareStatusNotification({ orderId, event });
  if (!prepared.ok) {
    return { sent: false, skipped: true, reason: prepared.reason, event };
  }

  // baseLog общий для обоих каналов (userbot и business mode) и для
  // skipped-кейсов после prepared — чтобы в журнале admin'а видна была
  // единая запись с outcome=sent/failed/skipped. Объявляем ДО первого
  // skipped-return, иначе TDZ — safeLog ссылается на baseLog по замыканию.
  const baseLog = {
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

  function safeLog(extra = {}, businessConnectionId = null) {
    try {
      logBotMessage({
        ...baseLog,
        businessConnectionId,
        meta: { order_id: orderId, auto: true, ...extra },
      });
    } catch (logErr) {
      console.error('[auto-notify] logBotMessage failed:', logErr);
    }
  }

  // Шаг 2: верификация клиента — без этого Telegram Business не разрешит
  // боту писать в чат (нет инициированного диалога). Это и было ограничение,
  // про которое Костя написал: «всё равно человек пишет нам первый, чтобы
  // получить прайс — это и есть инициация».
  if (!isCustomerVerified(prepared.customerTelegramId)) {
    // Дима 10.05.2026: «при любых ошибках должна быть рамка». Логируем
    // skipped, чтобы плашка «не удалось отправить» переживала рефреш
    // админки (без записи в bot_message_log GET /orders ничего не находит
    // и UI остаётся чистым после перезагрузки).
    safeLog({ outcome: 'skipped', reason: 'customer_not_verified' });
    return { sent: false, skipped: true, reason: 'customer_not_verified', event };
  }

  // Шаг 3: пробуем сначала через userbot (MTProto от лица аккаунта менеджера).
  // У userbot нет 24-часового окна Telegram Business и сообщения приходят
  // клиенту в его обычный чат с менеджером — он не отличает их от ручных.
  // Userbot живёт отдельным PM2-процессом, ходит через локальный HTTP.
  //
  // Логика fallback: если userbot недоступен (HTTP timeout, /health = false)
  // или конкретная отправка упала — пробуем Business mode (старый путь),
  // чтобы хотя бы для активных в 24ч клиентов сообщение всё равно ушло.

  // Шаг 3.1: пробуем userbot
  if (await isUserbotAvailable()) {
    const ubResult = await sendViaUserbot({
      chatId: prepared.chatId,
      text: prepared.text,
      orderId,
      // auto:true — попадает в meta лога userbot. По этому флагу
      // GET /api/admin/crm/orders подтягивает последний auto-notify
      // для плашки «не удалось отправить» (без флага запись путалась бы
      // с manual /bot/send-custom).
      auto: true,
    });
    if (ubResult.ok) {
      // userbot.js сам логирует в bot_message_log с meta.source='userbot',
      // так что здесь не дублируем. Но возвращаем единый формат caller'у.
      return {
        sent: true,
        event,
        telegram_message_id: ubResult.telegram_message_id ?? null,
        via: 'userbot',
      };
    }
    // ambiguous = userbot мог отправить (HTTP timeout, потерянный ответ).
    // Если сделать fallback на business mode, рискуем продублировать
    // сообщение клиенту в чате — это видно невооружённым глазом и роняет
    // доверие к боту. Лучше вернуть «неизвестно» и логировать предупреждение.
    if (ubResult.outcome === 'ambiguous') {
      console.warn(
        '[auto-notify] userbot send ambiguous (mб отправил, ответ потерян), без fallback:',
        ubResult.error,
      );
      // safeLog заведём с outcome=ambiguous, чтобы менеджер видел в журнале
      // и мог проверить чат вручную. Сам userbot уже не успел залогировать
      // (ответ оборвался) — пишем сами для аудита.
      safeLog({ outcome: 'ambiguous', via: 'userbot', error: ubResult.error });
      return {
        sent: false,
        reason: 'userbot_ambiguous',
        event,
        via: 'userbot',
      };
    }
    // outcome='rejected'|'unreachable' — userbot гарантированно не отправил,
    // fallback безопасен. Лог уже сделан userbot/index.js (если он жил
    // достаточно, чтобы записать) или там его нет (unreachable) — без проблем.
    console.warn(
      `[auto-notify] userbot ${ubResult.outcome}, fallback to business mode:`,
      ubResult.error,
    );
  }

  // Шаг 3.2: fallback на Business mode менеджера (Bot API).
  const active = getActiveBusinessConnection();
  if (!active) {
    // Userbot не сработал и Business mode не настроен — по сути «не отправили».
    // Логируем skipped, чтобы рамка уцелела через рефреш админки.
    safeLog({ outcome: 'skipped', reason: 'no_active_connection' });
    return { sent: false, skipped: true, reason: 'no_active_connection', event };
  }

  // 24-часовое окно проверяется только для Business mode — у userbot его нет.
  if (hasAnyInbound(prepared.chatId) && !hasRecentInbound(prepared.chatId)) {
    safeLog({ outcome: 'skipped', reason: 'client_inactive_over_24h' }, active.id);
    return { sent: false, skipped: true, reason: 'client_inactive_over_24h', event };
  }

  const sendResult = await sendBusinessMessage({
    businessConnectionId: active.id,
    chatId: prepared.chatId,
    text: prepared.text,
  });

  if (sendResult.ok) {
    safeLog({ outcome: 'sent', via: 'business_mode' }, active.id);
    return {
      sent: true,
      event,
      telegram_message_id: sendResult.telegramMessageId ?? null,
      via: 'business_mode',
    };
  }

  safeLog({ outcome: 'failed', error: sendResult.error, via: 'business_mode' }, active.id);
  return { sent: false, reason: sendResult.error || 'send_failed', event };
}
