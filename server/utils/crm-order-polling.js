export function buildCrmOrderPollSummary({ db, newLimit = 100, actionLimit = 200 } = {}) {
  const newOrderRows = db.prepare(`
    SELECT id
    FROM orders
    WHERE archived = 0
      AND status = 'new'
    ORDER BY created_at DESC
    LIMIT ?
  `).all(newLimit);

  const actionRequiredRows = db.prepare(`
    SELECT id
    FROM orders
    WHERE archived = 0
      AND needs_manager_action = 1
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ?
  `).all(actionLimit);

  const latestRow = db.prepare(`
    SELECT MAX(COALESCE(updated_at, created_at)) AS latest_order_activity_at
    FROM orders
    WHERE archived = 0
  `).get();

  return {
    newOrderIds: newOrderRows.map((row) => row.id),
    actionRequiredIds: actionRequiredRows.map((row) => row.id),
    latestOrderActivityAt: latestRow?.latest_order_activity_at || null,
  };
}
