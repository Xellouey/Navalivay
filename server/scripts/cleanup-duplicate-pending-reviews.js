/**
 * Удаляет дубли pending-отзывов:
 * 1) несколько записей на одну линейку (customer_id, order_id, group_id);
 * 2) одинаковый текст+оценка на разные линейки одного заказа (оставляем самый ранний).
 *
 * Usage:
 *   node server/scripts/cleanup-duplicate-pending-reviews.js
 *   node server/scripts/cleanup-duplicate-pending-reviews.js --dry-run
 */
import { initDb, db } from '../db.js';
import { normalizeReviewBodyForDedup } from '../utils/product-reviews.js';

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

initDb();

const dryRun = hasFlag('dry-run');
const toDelete = new Set();

const sameLineGroups = db.prepare(`
  SELECT customer_id, order_id, group_id, COUNT(*) AS cnt
  FROM product_reviews
  WHERE status = 'pending'
  GROUP BY customer_id, order_id, group_id
  HAVING cnt > 1
`).all();

if (sameLineGroups.length) {
  console.log(`[cleanup-duplicate-pending-reviews] Групп с дублями на одной линейке: ${sameLineGroups.length}`);
}

for (const group of sameLineGroups) {
  const rows = db.prepare(`
    SELECT pr.id, pr.created_at, o.order_number, cg.name AS group_name, c.telegram_username
    FROM product_reviews pr
    JOIN orders o ON o.id = pr.order_id
    JOIN category_groups cg ON cg.id = pr.group_id
    LEFT JOIN customers c ON c.id = pr.customer_id
    WHERE pr.customer_id = ? AND pr.order_id = ? AND pr.group_id = ? AND pr.status = 'pending'
    ORDER BY pr.created_at ASC, pr.rowid ASC
  `).all(group.customer_id, group.order_id, group.group_id);

  const keep = rows[0];
  console.log(`  keep same-line: ${keep.id} (@${keep.telegram_username || '?'} заказ #${keep.order_number} ${keep.group_name})`);
  for (const row of rows.slice(1)) {
    console.log(`  delete same-line: ${row.id} (${row.created_at})`);
    toDelete.add(row.id);
  }
}

const pendingRows = db.prepare(`
  SELECT pr.id, pr.customer_id, pr.order_id, pr.group_id, pr.rating, pr.body_text,
         pr.created_at, o.order_number, g.name AS group_name, c.telegram_username
  FROM product_reviews pr
  JOIN orders o ON o.id = pr.order_id
  LEFT JOIN category_groups g ON g.id = pr.group_id
  LEFT JOIN customers c ON c.id = pr.customer_id
  WHERE pr.status = 'pending'
  ORDER BY pr.created_at ASC, pr.rowid ASC
`).all();

const keptByOrderSignature = new Map();

for (const row of pendingRows) {
  const signature = [
    row.customer_id,
    row.order_id,
    row.rating,
    normalizeReviewBodyForDedup(row.body_text),
  ].join('\u0001');

  const kept = keptByOrderSignature.get(signature);
  if (!kept) {
    keptByOrderSignature.set(signature, row);
    continue;
  }

  console.log(
    `  delete same-order text: ${row.id} (@${row.telegram_username || '?'} заказ #${row.order_number} ${row.group_name})`,
  );
  console.log(
    `    keep: ${kept.id} (${kept.group_name})`,
  );
  toDelete.add(row.id);
}

if (!toDelete.size) {
  console.log('[cleanup-duplicate-pending-reviews] Дублей pending нет.');
  process.exit(0);
}

if (dryRun) {
  console.log(`\n[dry-run] Будет удалено: ${toDelete.size}`);
  process.exit(0);
}

const tx = db.transaction((ids) => {
  const del = db.prepare('DELETE FROM product_reviews WHERE id = ?');
  for (const id of ids) del.run(id);
});

tx([...toDelete]);
console.log(`\n[cleanup-duplicate-pending-reviews] Удалено дублей: ${toDelete.size}`);