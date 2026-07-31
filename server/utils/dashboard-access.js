import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';

import { db } from '../db.js';
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
const SETTING_KEY = 'dashboard_owner_password_hash';
const TOKEN_TTL_MS = 30 * 60_000;

/** Токены живут в памяти: перезапуск сервера закрывает раздел, и это правильно. */
const activeTokens = new Map();

export function isDashboardLocked(now = new Date()) {
  const { hour } = getTimeZoneDateParts(now);
  return hour >= DASHBOARD_LOCK_FROM_HOUR && hour < DASHBOARD_LOCK_TO_HOUR;
}

export function getDashboardOwnerHash() {
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(SETTING_KEY);
  return row?.value || null;
}

export function setDashboardOwnerPassword(password) {
  const normalized = String(password ?? '').trim();
  if (normalized.length < 4) throw new TypeError('dashboard_password_too_short');
  const hash = bcrypt.hashSync(normalized, 10);
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(SETTING_KEY, hash);
  return true;
}

export async function verifyDashboardOwnerPassword(password) {
  const hash = getDashboardOwnerHash();
  if (!hash) return false;
  return bcrypt.compare(String(password ?? ''), hash);
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
