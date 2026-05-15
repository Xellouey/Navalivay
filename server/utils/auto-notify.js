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
  logBotMessage,
} from './business-bot.js';
import { sendViaUserbot, isUserbotAvailable } from './userbot-client.js';
import { getActiveBlockForCustomerId } from './customer-blocks.js';
import { db } from '../db.js';

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
 * Есть ли у клиента entity в кэше юзербота (access_hash в userbot_entities).
 * Если нет — юзербот не знает этого человека, у них нет диалога, и сообщение
 * может быть воспринято как спам. Используется для пропуска cancelled-
 * уведомлений новым клиентам без диалога (защита от жалоб на спам).
 */
function hasUserbotAccess(telegramId) {
  if (!telegramId) return false;
  const row = db.prepare(
    'SELECT 1 FROM userbot_entities WHERE telegram_id = ? AND access_hash IS NOT NULL'
  ).get(String(telegramId));
  return !!row;
}

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

  // Шаг 2a: блокировка клиента — не пишем заблокированным. Pavel 11.05.2026
  // отметил: «отписало заблокированному клиенту что заказ отменен». Если
  // менеджер забанил клиента, дальнейшие авто-уведомления выглядят как
  // насмешка («твой заказ отменён» хотя ты в бане). Пропускаем тихо.
  const activeBlock = getActiveBlockForCustomerId(prepared.customerId);
  if (activeBlock) {
    safeLog({ outcome: 'skipped', reason: 'customer_blocked' });
    return { sent: false, skipped: true, reason: 'customer_blocked', event };
  }

  // Шаг 2b: верификация клиента — без этого Telegram Business не разрешит
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

  // Шаг 2c: не шлём «заказ отменён» клиенту, у которого нет диалога
  // с менеджером (нет access_hash в userbot_entities). Такой клиент
  // не знает магазин, сообщение для него — спам → жалоба → бан.
  // Костя 15.05.2026: «он может нажать кнопочку Пожаловаться как спам,
  // и нас могут заморозить. Уже было такое.»
  if (event === 'order_cancelled' && !hasUserbotAccess(prepared.customerTelegramId)) {
    safeLog({ outcome: 'skipped', reason: 'cancelled_no_userbot_access' });
    return { sent: false, skipped: true, reason: 'cancelled_no_userbot_access', event };
  }

  // Шаг 3: отправляем через userbot (MTProto от лица аккаунта менеджера).
  // У userbot нет 24-часового окна Telegram Business и сообщения приходят
  // клиенту в его обычный чат с менеджером — он не отличает их от ручных.
  // Userbot живёт отдельным PM2-процессом, ходит через локальный HTTP.
  //
  // Костя 10.05.2026: «бизнес-мод вырезаем». Раньше тут был fallback на
  // Business mode (Bot API через подключённого бота к личке менеджера),
  // но Костя его выключил в Telegram, и для каждого fail-а userbot мы
  // ловили `no_active_connection`. Userbot — единственный канал.
  if (!(await isUserbotAvailable())) {
    safeLog({ outcome: 'skipped', reason: 'userbot_unavailable' });
    return { sent: false, skipped: true, reason: 'userbot_unavailable', event };
  }

  const ubResult = await sendViaUserbot({
    chatId: prepared.chatId,
    text: prepared.text,
    orderId,
    // username — fallback для userbot: если sendMessage по userId упал
    // и prefetch диалогов тоже не помог (клиент за пределами 500+ топа),
    // userbot резолвит через @username при условии verified=true.
    username: prepared.customerUsername || null,
    // verified:true — попадает в userbot и разрешает resolveUsername.
    // Здесь мы только если isCustomerVerified прошёл (выше). Это защита
    // от «холодной рассылки» — userbot НЕ резолвит рандомные username,
    // только для клиентов магазина (есть заказ или /start с прайс-кодом).
    verified: true,
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
  // Не повторяем — иначе клиент получит дубль в чате (это видно
  // невооружённым глазом и роняет доверие к боту).
  if (ubResult.outcome === 'ambiguous') {
    console.warn(
      '[auto-notify] userbot send ambiguous (мог отправить, ответ потерян):',
      ubResult.error,
    );
    // safeLog с outcome=ambiguous, чтобы менеджер видел в журнале
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
  // outcome='rejected'|'unreachable' — userbot гарантированно не отправил.
  // Лог уже сделан userbot/index.js (если процесс жил достаточно, чтобы
  // записать failed). Возвращаем reason caller'у для тоста/плашки.
  console.warn(`[auto-notify] userbot ${ubResult.outcome}:`, ubResult.error);
  return {
    sent: false,
    reason: ubResult.error || 'send_failed',
    event,
    via: 'userbot',
  };
}
