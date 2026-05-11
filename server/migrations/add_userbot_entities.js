/**
 * Миграция: таблица access_hash клиентов для userbot.
 *
 * Контекст: GramJS держит entity-кэш только в памяти процесса. После
 * рестарта мы прогреваем кэш через iterDialogs, но Telegram отдаёт
 * не все диалоги (server-side cap для аккаунтов с большой базой
 * контактов: у Кости физически больше клиентов, чем 591 которые
 * возвращает iterDialogs). Костя 11.05.2026: «снёс диалог — не пишет ✓
 * Диане/Valeria — не пишет ✗ (а должно)».
 *
 * Решение: при каждом NewMessage event userbot ловит полную entity
 * клиента с актуальным access_hash и сохраняет (или обновляет) в
 * эту таблицу. При sendMessage, если entity не в кэше GramJS, поднимаем
 * access_hash отсюда и строим InputPeerUser напрямую — Telegram это
 * принимает без необходимости иметь активный диалог в getDialogs.
 *
 * Семантика:
 *   - есть запись здесь = клиент когда-то писал менеджеру → пишем смело
 *   - нет записи = «холодный» клиент → не пишем (защита от бана аккаунта)
 *
 * Идемпотентность: CREATE TABLE IF NOT EXISTS. Если запустить дважды
 * на инициализированной БД — no-op.
 */
import { db } from '../db.js';

export function migrateUserbotEntities() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS userbot_entities (
      telegram_id TEXT NOT NULL PRIMARY KEY,
      access_hash TEXT NOT NULL,
      username TEXT,
      first_name TEXT,
      first_seen_at TEXT NOT NULL DEFAULT (DATETIME('now')),
      last_seen_at TEXT NOT NULL DEFAULT (DATETIME('now')),
      source TEXT NOT NULL DEFAULT 'new_message'
    );
  `);

  // Индекс по username — может пригодиться для дебага, но не критично.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_userbot_entities_username
      ON userbot_entities(username);
  `);

  // Индекс по last_seen_at для будущей задачи «забыть клиентов которые не
  // писали > N дней» (если нужно будет освобождать место).
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_userbot_entities_last_seen
      ON userbot_entities(last_seen_at);
  `);
}
