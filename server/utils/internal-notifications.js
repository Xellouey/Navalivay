const TELEGRAM_TEXT_LIMIT = 4000;
const PAYLOAD_JSON_LIMIT = 32 * 1024;
const UNIQUE_KEY_LIMIT = 240;
const EVENT_TYPE_LIMIT = 80;
const MINSK_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Minsk',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function requireDatabase(database) {
  if (!database?.prepare) {
    throw new TypeError('database_required');
  }
  return database;
}

export function toSqliteUtc(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError('invalid_date');
  }
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function normalizeRequiredText(value, code, maxLength) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(code);
  if (normalized.length > maxLength) throw new TypeError(`${code}_too_long`);
  return normalized;
}

export function normalizeTelegramId(value) {
  const normalized = String(value ?? '').trim();
  if (!/^-?[1-9]\d{0,19}$/.test(normalized)) {
    throw new TypeError('invalid_recipient_telegram_id');
  }
  return normalized;
}

export function normalizeTelegramUsername(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const normalized = String(value).trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{5,32}$/.test(normalized)) {
    throw new TypeError('invalid_recipient_username');
  }
  return normalized;
}

function cleanLine(value, fallback = '') {
  const result = String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return result || fallback;
}

function formatMinskDateTime(value, fallback = 'не указан') {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  return MINSK_DATE_TIME_FORMATTER.format(date).replace(',', '');
}

function documentNumber(payload) {
  return cleanLine(
    payload.document_number
      ?? payload.documentNumber
      ?? payload.number
      ?? payload.document_id
      ?? payload.documentId,
    'без номера',
  );
}

function employeeName(payload) {
  return cleanLine(
    payload.employee_name
      ?? payload.employeeName
      ?? payload.actor_name
      ?? payload.actorName,
    'не указан',
  );
}

/**
 * Текст всегда строится и сохраняется при постановке в очередь. Это снимок
 * события: последующее переименование сотрудника или документа его не меняет.
 */
export function buildInternalNotificationText(eventType, payload = {}) {
  if (payload?.text !== undefined && payload?.text !== null) {
    return normalizeRequiredText(payload.text, 'notification_text_required', TELEGRAM_TEXT_LIMIT);
  }

  const type = String(eventType || '').trim();
  const number = documentNumber(payload);
  const employee = employeeName(payload);
  const from = cleanLine(
    payload.from_location ?? payload.fromLocation ?? payload.from,
    'не указано',
  );
  const to = cleanLine(
    payload.to_location ?? payload.toLocation ?? payload.to,
    'не указано',
  );

  let text;
  switch (type) {
    case 'procurement.created':
    case 'procurement_created':
      text = `Создан документ закупки #${number}\nСотрудник: ${employee}`;
      break;
    case 'procurement.accepted':
    case 'procurement_received':
      text = `Принята закупка #${number}\nСотрудник: ${employee}`;
      break;
    case 'transfer.created':
    case 'transfer_created':
      text = [
        `Создана заявка на перемещение #${number}`,
        `Откуда: ${from}`,
        `Куда: ${to}`,
        `Сотрудник: ${employee}`,
      ].join('\n');
      break;
    case 'transfer.accepted':
    case 'transfer_completed':
      text = [
        `Перемещение #${number} принято`,
        `Куда: ${to}`,
        `Сотрудник: ${employee}`,
      ].join('\n');
      break;
    case 'task.created':
    case 'task_created': {
      const title = cleanLine(payload.title, 'Без названия');
      const deadline = formatMinskDateTime(payload.deadline);
      text = `Новая задача #${number}\n${title}\nСрок: ${deadline}`;
      break;
    }
    case 'task.submitted':
    case 'task_review_requested': {
      const title = cleanLine(payload.title, 'Без названия');
      text = `Задача #${number} отправлена на проверку\n${title}\nСотрудник: ${employee}`;
      break;
    }
    case 'salary.reminder':
    case 'salary_assignment_reminder': {
      const period = cleanLine(payload.period_label ?? payload.period, 'текущий месяц');
      text = `Напоминание: внесите ожидаемые зарплаты за ${period}.`;
      break;
    }
    default:
      throw new TypeError('notification_text_required');
  }

  if (text.length > TELEGRAM_TEXT_LIMIT) {
    throw new TypeError('notification_text_required_too_long');
  }
  return text;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

function parsePayload(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function sameQueuedMessage(existing, expected) {
  return (
    String(existing.event_type) === expected.eventType
    && String(existing.recipient_telegram_id) === expected.recipientTelegramId
    && stableJson(parsePayload(existing.payload_json)) === expected.payloadJson
  );
}

/**
 * Добавляет уведомление в текущую транзакцию вызывающего кода.
 *
 * Функция намеренно не открывает свою транзакцию: если вызывающий код уже
 * выполняется в `db.transaction(...)`, документ, событие и outbox фиксируются
 * или откатываются вместе.
 */
export function enqueueInternalNotification(database, {
  uniqueKey,
  eventType,
  recipientTelegramId,
  recipientUsername = null,
  payload = {},
  now = new Date(),
} = {}) {
  const db = requireDatabase(database);
  const normalizedUniqueKey = normalizeRequiredText(
    uniqueKey,
    'notification_unique_key_required',
    UNIQUE_KEY_LIMIT,
  );
  const normalizedEventType = normalizeRequiredText(
    eventType,
    'notification_event_type_required',
    EVENT_TYPE_LIMIT,
  );
  const normalizedTelegramId = normalizeTelegramId(recipientTelegramId);
  const normalizedUsername = normalizeTelegramUsername(recipientUsername);
  const sourcePayload = parsePayload(payload);
  const normalizedPayload = {
    ...sourcePayload,
    text: buildInternalNotificationText(normalizedEventType, sourcePayload),
  };
  const payloadJson = stableJson(normalizedPayload);
  if (Buffer.byteLength(payloadJson, 'utf8') > PAYLOAD_JSON_LIMIT) {
    throw new TypeError('notification_payload_too_large');
  }
  const nowSql = toSqliteUtc(now);

  const insert = db.prepare(`
    INSERT INTO internal_notification_outbox (
      unique_key, event_type, recipient_telegram_id, recipient_username,
      payload_json, status, attempts, next_attempt_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)
    ON CONFLICT(unique_key) DO NOTHING
  `).run(
    normalizedUniqueKey,
    normalizedEventType,
    normalizedTelegramId,
    normalizedUsername,
    payloadJson,
    nowSql,
    nowSql,
    nowSql,
  );

  const row = db.prepare(`
    SELECT *
    FROM internal_notification_outbox
    WHERE unique_key = ?
  `).get(normalizedUniqueKey);

  if (!row) throw new Error('notification_enqueue_failed');
  const expected = {
    eventType: normalizedEventType,
    recipientTelegramId: normalizedTelegramId,
    payloadJson,
  };
  if (!sameQueuedMessage(row, expected)) {
    const error = new Error('notification_idempotency_conflict');
    error.code = 'notification_idempotency_conflict';
    throw error;
  }

  return {
    enqueued: insert.changes === 1,
    duplicate: insert.changes === 0,
    notification: row,
  };
}

export function getInternalNotificationByUniqueKey(database, uniqueKey) {
  return requireDatabase(database).prepare(`
    SELECT *
    FROM internal_notification_outbox
    WHERE unique_key = ?
  `).get(String(uniqueKey));
}

export function listInternalNotificationRecipients(database, eventGroup) {
  const normalizedGroup = normalizeRequiredText(
    eventGroup,
    'notification_event_group_required',
    EVENT_TYPE_LIMIT,
  );
  return requireDatabase(database).prepare(`
    SELECT
      recipient.telegram_id,
      recipient.telegram_username,
      recipient.display_name
    FROM internal_notification_recipients AS recipient
    INNER JOIN internal_notification_settings AS setting
      ON setting.event_group = recipient.event_group
    WHERE recipient.event_group = ?
      AND recipient.active = 1
      AND recipient.confirmed_at IS NOT NULL
      AND setting.enabled = 1
    ORDER BY recipient.id ASC
  `).all(normalizedGroup);
}

/**
 * Ставит одно бизнес-событие всем подтверждённым получателям группы.
 * Ключ каждой доставки включает числовой Telegram ID, поэтому повтор вызова
 * безопасен и при нескольких получателях.
 */
export function enqueueInternalNotificationForGroup(database, {
  eventGroup,
  uniqueKey,
  eventType,
  payload = {},
  now = new Date(),
} = {}) {
  const db = requireDatabase(database);
  const normalizedUniqueKey = normalizeRequiredText(
    uniqueKey,
    'notification_unique_key_required',
    UNIQUE_KEY_LIMIT - 32,
  );
  const recipients = listInternalNotificationRecipients(db, eventGroup);
  const notifications = recipients.map((recipient) => (
    enqueueInternalNotification(db, {
      uniqueKey: `${normalizedUniqueKey}:recipient:${recipient.telegram_id}`,
      eventType,
      recipientTelegramId: recipient.telegram_id,
      recipientUsername: recipient.telegram_username,
      payload,
      now,
    })
  ));
  return {
    recipients: recipients.length,
    enqueued: notifications.filter((item) => item.enqueued).length,
    duplicates: notifications.filter((item) => item.duplicate).length,
    notifications: notifications.map((item) => item.notification),
  };
}

/**
 * Только явное ручное действие после проверки, что сообщение не дошло.
 * Автоматически записи `unknown` никогда не возвращаются в очередь.
 */
export function resumeUnknownInternalNotification(database, id, {
  reason = 'manual_retry_confirmed',
  now = new Date(),
} = {}) {
  const nowSql = toSqliteUtc(now);
  const result = requireDatabase(database).prepare(`
    UPDATE internal_notification_outbox
    SET status = 'retry',
        next_attempt_at = ?,
        locked_at = NULL,
        last_error = ?,
        updated_at = ?
    WHERE id = ? AND status = 'unknown'
  `).run(nowSql, cleanLine(reason, 'manual_retry_confirmed').slice(0, 300), nowSql, id);
  return result.changes === 1;
}
