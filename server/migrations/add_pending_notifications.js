import { db } from '../db.js';

/**
 * Очередь отложенных авто-уведомлений при временной недоступности userbot.
 * Worker в auto-notify-retry.js обрабатывает записи с экспоненциальным backoff.
 */
export function migratePendingNotifications() {
  const tableExists = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'pending_notifications' LIMIT 1",
    )
    .get();
  if (tableExists) {
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      template_event TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT 'userbot_unavailable',
      attempt INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 15,
      next_retry_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
      updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
      status TEXT NOT NULL DEFAULT 'pending',
      UNIQUE(order_id, template_event)
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pending_notifications_due
      ON pending_notifications(status, next_retry_at);
  `);
  console.log('[migration] Created pending_notifications table');
}