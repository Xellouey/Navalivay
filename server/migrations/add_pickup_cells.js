import { db } from '../db.js';

export function migratePickupCells() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_pickup_cell_assignments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      cell_number INTEGER NOT NULL CHECK (cell_number BETWEEN 1 AND 100),
      assigned_at TEXT NOT NULL DEFAULT (DATETIME('now')),
      released_at TEXT,
      release_reason TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_pickup_cells_one_active_cell
      ON order_pickup_cell_assignments(cell_number)
      WHERE released_at IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_pickup_cells_one_active_order
      ON order_pickup_cell_assignments(order_id)
      WHERE released_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_pickup_cells_order_history
      ON order_pickup_cell_assignments(order_id, assigned_at DESC);
  `);

  db.prepare(
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('pickup_cell_capacity', '50')`,
  ).run();
}
