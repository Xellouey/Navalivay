import bcrypt from 'bcryptjs';

import { db } from '../db.js';

/**
 * Пароль владельца на раздел «Обзор».
 *
 * Хранится хешем в settings, а не строкой в коде фронтенда: собранный JS
 * открывается и читается кем угодно, так что зашитый там пароль защитой не был
 * бы. Значение по умолчанию задаётся здесь один раз, дальше его можно сменить,
 * не трогая код.
 */
const SETTING_KEY = 'dashboard_owner_password_hash';
const DEFAULT_PASSWORD = process.env.DASHBOARD_OWNER_PASSWORD || '0002';

export function migrateDashboardOwnerPassword() {
  const existing = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(SETTING_KEY);
  if (existing?.value) return;

  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
    SETTING_KEY,
    bcrypt.hashSync(DEFAULT_PASSWORD, 10),
  );
  console.log('[migration] Задан пароль владельца для раздела «Обзор»');
}
