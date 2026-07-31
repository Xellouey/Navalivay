import crypto from 'node:crypto';

import { getTimeZoneDateParts } from './business-time.js';

/**
 * Отдельный замок на раздел «Обзор».
 *
 * С 10:00 до 16:00 по Минску туда нельзя войти по обычному ключу CRM: в это
 * время в магазине идут проверки, а менеджеры забывают закрывать панель, и
 * сводка по выручке остаётся на экране. В это окно раздел открывается только
 * по отдельному паролю, который есть у владельца.
 *
 * Остальные разделы и общий ключ CRM не затронуты.
 */
export const DASHBOARD_LOCK_FROM_HOUR = 10;
export const DASHBOARD_LOCK_TO_HOUR = 16;

/**
 * Пароль владельца. Меняется только правкой этой строки и перезапуском сервера:
 * из настроек CRM его не достать и не подменить. Файл серверный, в браузер он
 * не попадает, поэтому строка тут безопасна. В собранный фронтенд её класть
 * нельзя ни при каких условиях.
 */
const OWNER_PASSWORD = '0002';
const TOKEN_TTL_MS = 30 * 60_000;

/** Токены живут в памяти: перезапуск сервера закрывает раздел, и это правильно. */
const activeTokens = new Map();

export function isDashboardLocked(now = new Date()) {
  const { hour } = getTimeZoneDateParts(now);
  return hour >= DASHBOARD_LOCK_FROM_HOUR && hour < DASHBOARD_LOCK_TO_HOUR;
}

/** Сравнение за постоянное время: длина пароля короткая, подбор по таймингу дешёв. */
export function verifyDashboardOwnerPassword(password) {
  const given = Buffer.from(String(password ?? ''));
  const expected = Buffer.from(OWNER_PASSWORD);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(given, expected);
}

function purgeExpired(now) {
  for (const [token, entry] of activeTokens) {
    if (entry.expiresAt <= now) activeTokens.delete(token);
  }
}

/**
 * Пропуск в раздел. Истекает и по времени, и на границе окна: доступ, выданный
 * до десяти утра, в десять перестаёт работать, иначе забытая вкладка так и
 * останется открытой.
 */
export function issueDashboardToken(now = new Date()) {
  const nowMs = now.getTime();
  purgeExpired(nowMs);
  const token = crypto.randomBytes(32).toString('base64url');
  activeTokens.set(token, {
    expiresAt: nowMs + TOKEN_TTL_MS,
    lockedAtIssue: isDashboardLocked(now),
  });
  return { token, expiresInMs: TOKEN_TTL_MS };
}

export function isDashboardTokenValid(token, now = new Date()) {
  const nowMs = now.getTime();
  purgeExpired(nowMs);
  const entry = activeTokens.get(String(token || ''));
  if (!entry) return false;
  if (entry.expiresAt <= nowMs) {
    activeTokens.delete(String(token));
    return false;
  }
  // Пропуск, выданный вне окна, внутри окна не действует.
  if (isDashboardLocked(now) && !entry.lockedAtIssue) {
    activeTokens.delete(String(token));
    return false;
  }
  return true;
}

export function revokeAllDashboardTokens() {
  activeTokens.clear();
}
