import { db } from "../db.js";
import { randomUUID } from "node:crypto";
import { getUtcDateForTimeZoneLocalTime, toSqliteUtcString } from "../utils/business-time.js";

const SPIN_ID_PREFIX = "ws";
const PROMO_ID_PREFIX = "wpp";
const POOL_ID_PREFIX = "wep";
const PROMO_CODE_PREFIX = "WHEEL";

const DEFAULT_SETTINGS = {
  spin_byn_retail: 40,
  spin_byn_wholesale: 200,
  pity_threshold: 3,
  default_promo_validity_days: 90,
  feed_size: 30,
  start_collecting_at: null,
  elite_rarities_json: ["valuable"],
};

function generateId(prefix) {
  // crypto.randomUUID is available in Node 14.17+/16+/18+. Stable, collision-safe.
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/**
 * P3: structured event logging for the wheel module.
 *
 * Format follows the userbot logging convention (see
 * docs/userbot-logging.md): one line of JSON per event with `ev` and
 * `ts` always present, plus event-specific fields. PM2/journald keep
 * full lines, so we can grep `pm2 logs navalivay-server | grep '"ev":"wheel_'`
 * for a quick filtered stream.
 *
 * Why structured: free-form `console.warn` strings drift across
 * commits and are hard to aggregate. Structured events let us answer
 * questions like "how many epic releases this week" with `jq` instead
 * of regex.
 */
function logWheelEvent(ev, data = {}) {
  try {
    const line = JSON.stringify({
      ev: `wheel_${ev}`,
      ts: new Date().toISOString(),
      ...data,
    });
    // eslint-disable-next-line no-console
    console.log(line);
  } catch (error) {
    // JSON.stringify can throw on circular refs from accidental object
    // references in `data`. Fall back to a tag-only line so we never
    // suppress the event entirely.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ev: `wheel_${ev}`, ts: new Date().toISOString(), log_error: String(error?.message || error) }));
  }
}

function generatePromoCode() {
  const random = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${PROMO_CODE_PREFIX}-${random}`;
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJson(value, fallback) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("[wheel] parseJson failed", error?.message || error);
    return fallback;
  }
}

function isMeaningfulSettingValue(value) {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  if (!str) return false;
  if (str.toLowerCase() === "null") return false;
  if (str.toLowerCase() === "undefined") return false;
  return true;
}

function toSqliteDateTime(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str || str.toLowerCase() === "null") return null;

  // S2-N5: when the input looks like a "naked" datetime-local string from
  // the CRM (`YYYY-MM-DDTHH:MM` with no timezone suffix), interpret it
  // as Minsk-local time and convert to UTC. This matches how every
  // other date-aware field in the project is handled (loyalty rules,
  // promo dates) and avoids the previous behaviour where the backend
  // accepted whatever the browser produced via .toISOString() — which
  // depended on the staff member's local OS timezone.
  const naked = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (naked) {
    const [, year, month, day, hour, minute, second] = naked;
    const utc = getUtcDateForTimeZoneLocalTime(
      Number(year),
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second || 0),
    );
    return toSqliteUtcString(utc);
  }

  if (str.includes("T")) {
    // Strings carrying an explicit timezone (e.g. ISO with `Z` suffix or
    // `+03:00` offset) are already UTC-equivalent; just normalize to
    // SQLite shape.
    return str.replace("T", " ").replace(/\.\d+Z?$/, "").replace(/Z$/, "");
  }
  return str;
}

/**
 * Read all wheel settings as a typed object. Missing rows fall back to
 * DEFAULT_SETTINGS, so the rest of the codebase never has to special-case
 * a partially seeded wheel_settings table.
 */
export function getWheelSettings() {
  const rows = db.prepare("SELECT key, value FROM wheel_settings").all();
  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    spin_byn_retail: safeNumber(
      map.get("spin_byn_retail"),
      DEFAULT_SETTINGS.spin_byn_retail,
    ),
    spin_byn_wholesale: safeNumber(
      map.get("spin_byn_wholesale"),
      DEFAULT_SETTINGS.spin_byn_wholesale,
    ),
    pity_threshold: Math.max(
      1,
      Math.floor(
        safeNumber(map.get("pity_threshold"), DEFAULT_SETTINGS.pity_threshold),
      ),
    ),
    default_promo_validity_days: Math.max(
      1,
      Math.floor(
        safeNumber(
          map.get("default_promo_validity_days"),
          DEFAULT_SETTINGS.default_promo_validity_days,
        ),
      ),
    ),
    feed_size: Math.max(
      1,
      Math.floor(safeNumber(map.get("feed_size"), DEFAULT_SETTINGS.feed_size)),
    ),
    start_collecting_at: isMeaningfulSettingValue(map.get("start_collecting_at"))
      ? toSqliteDateTime(map.get("start_collecting_at"))
      : DEFAULT_SETTINGS.start_collecting_at,
    elite_rarities: parseJson(
      map.get("elite_rarities_json"),
      DEFAULT_SETTINGS.elite_rarities_json,
    ),
  };
}

export function updateWheelSettings(partial) {
  const allowed = [
    ["spin_byn_retail", (v) => String(safeNumber(v, DEFAULT_SETTINGS.spin_byn_retail))],
    [
      "spin_byn_wholesale",
      (v) => String(safeNumber(v, DEFAULT_SETTINGS.spin_byn_wholesale)),
    ],
    [
      "pity_threshold",
      (v) =>
        String(
          Math.max(1, Math.floor(safeNumber(v, DEFAULT_SETTINGS.pity_threshold))),
        ),
    ],
    [
      "default_promo_validity_days",
      (v) =>
        String(
          Math.max(
            1,
            Math.floor(
              safeNumber(v, DEFAULT_SETTINGS.default_promo_validity_days),
            ),
          ),
        ),
    ],
    ["feed_size", (v) => String(Math.max(1, Math.floor(safeNumber(v, DEFAULT_SETTINGS.feed_size))))],
    [
      "start_collecting_at",
      (v) => {
        // Always normalize to SQLite "YYYY-MM-DD HH:MM:SS" format. Frontend
        // historically sent ISO strings (with `T` and trailing Z), and SQLite
        // stamps written via DATETIME('now') use the space-separated form.
        // Lexicographic comparison only works when both sides match.
        const normalized = toSqliteDateTime(v);
        return normalized || "";
      },
    ],
    [
      "elite_rarities_json",
      (v) =>
        JSON.stringify(
          Array.isArray(v) ? v.map((entry) => String(entry || "")).filter(Boolean) : [],
        ),
    ],
  ];

  const upsert = db.prepare(`
    INSERT INTO wheel_settings (key, value, updated_at)
    VALUES (?, ?, DATETIME('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = DATETIME('now')
  `);

  const tx = db.transaction(() => {
    for (const [key, transform] of allowed) {
      // Accept either canonical key ("elite_rarities_json") or the public
      // alias without the _json suffix ("elite_rarities").
      const aliasKey = key.replace("_json", "");
      const present =
        Object.prototype.hasOwnProperty.call(partial || {}, aliasKey) ||
        Object.prototype.hasOwnProperty.call(partial || {}, key);
      if (!present) continue;

      const raw = Object.prototype.hasOwnProperty.call(partial || {}, aliasKey)
        ? partial[aliasKey]
        : partial[key];

      // For start_collecting_at specifically: don't overwrite an existing
      // value with the literal string "null"/empty — that used to make the
      // accrual logic compare against the string "null" and silently drop
      // every order. If admin really wants to clear the marker, they should
      // explicitly send the empty string and we store it as empty.
      if (key === "start_collecting_at" && !isMeaningfulSettingValue(raw)) {
        upsert.run(key, "");
        continue;
      }

      upsert.run(key, transform(raw));
    }
  });

  tx();
  return getWheelSettings();
}

export function listRarities() {
  return db
    .prepare(
      `SELECT code, label, bg_color AS bgColor, text_color AS textColor,
              sort_order AS sortOrder, is_elite AS isElite
       FROM wheel_rarities
       ORDER BY sort_order ASC`,
    )
    .all();
}

function loadActivePrizesForCustomer({ isWholesale }) {
  const flagColumn = isWholesale ? "is_for_wholesale" : "is_for_retail";

  return db
    .prepare(
      `SELECT *
       FROM wheel_prizes
       WHERE is_active = 1
         AND ${flagColumn} = 1
       ORDER BY sort_order ASC, created_at ASC`,
    )
    .all();
}

function effectiveWeight(prize) {
  if (!prize.is_active) return 0;
  const weight = Number(prize.weight || 0);
  if (weight <= 0) return 0;
  if (Number(prize.max_total) > 0 && Number(prize.issued_count || 0) >= Number(prize.max_total)) {
    return 0;
  }
  return weight;
}

function pickWeightedRandom(prizes, rng = Math.random) {
  const weights = prizes.map((prize) => effectiveWeight(prize));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return null;

  const target = rng() * total;
  let acc = 0;
  for (let i = 0; i < prizes.length; i += 1) {
    acc += weights[i];
    if (target <= acc) {
      return prizes[i];
    }
  }
  return prizes[prizes.length - 1];
}

function getCustomerProfitSince(customerId, sinceIso) {
  if (!customerId) return 0;
  const sinceSqlite = toSqliteDateTime(sinceIso) || "1970-01-01 00:00:00";
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(profit), 0) AS total
       FROM orders
       WHERE customer_id = ?
         AND status = 'delivered'
         AND COALESCE(completed_at, created_at) >= ?`,
    )
    .get(customerId, sinceSqlite);
  return safeNumber(row?.total, 0);
}

function ensureCustomerBalance(customerId) {
  const existing = db
    .prepare("SELECT * FROM wheel_customer_balances WHERE customer_id = ?")
    .get(customerId);
  if (existing) return existing;

  db.prepare(
    `INSERT INTO wheel_customer_balances (
      customer_id, spins_available, accumulated_retail_byn,
      accumulated_wholesale_byn, consecutive_nothing, last_updated_at
    ) VALUES (?, 0, 0, 0, 0, DATETIME('now'))`,
  ).run(customerId);

  return db
    .prepare("SELECT * FROM wheel_customer_balances WHERE customer_id = ?")
    .get(customerId);
}

/**
 * Add ledger BYN to a customer balance and convert it into spins
 * according to wheel_settings thresholds.
 *
 * Idempotency: enforced by INSERT OR IGNORE into wheel_balance_ledger
 * (PRIMARY KEY = order_id). If the row already exists, the function
 * returns { accrued: false, reason: "already_synced" } without touching
 * the balance. This survives recompute-customer reruns, double PATCH,
 * race conditions, etc.
 */
export function accrueWheelSpinsForOrder(orderId) {
  if (!orderId) return { accrued: false, reason: "missing_order_id" };

  const order = db
    .prepare(
      `SELECT id, customer_id, status, final_amount, total_amount,
              is_wholesale, completed_at, created_at
       FROM orders WHERE id = ?`,
    )
    .get(orderId);

  if (!order) return { accrued: false, reason: "order_not_found" };
  if (!order.customer_id) return { accrued: false, reason: "no_customer" };
  // Architecturally, only `delivered` triggers wheel accrual (see
  // docs/wheel-architecture.md). `completed` is a transitional CRM state
  // before the order is physically issued; it must not feed the wheel.
  if (order.status !== "delivered") {
    return { accrued: false, reason: "status_not_final" };
  }

  const settings = getWheelSettings();
  const startCollectingAt = settings.start_collecting_at;
  // Both sides are normalized to SQLite "YYYY-MM-DD HH:MM:SS" format so a
  // lexicographic comparison is safe. orders.completed_at/created_at are
  // already in that format because they are written via DATETIME('now') or
  // CURRENT_TIMESTAMP. start_collecting_at comes from getWheelSettings()
  // which forces the same shape.
  const orderDate = order.completed_at || order.created_at;
  if (
    startCollectingAt &&
    orderDate &&
    String(orderDate) < String(startCollectingAt)
  ) {
    return { accrued: false, reason: "before_release" };
  }

  const isWholesale = Number(order.is_wholesale || 0) === 1;
  const amount = Math.max(
    0,
    safeNumber(order.final_amount, safeNumber(order.total_amount, 0)),
  );
  if (amount <= 0) return { accrued: false, reason: "zero_amount" };

  const threshold = isWholesale
    ? settings.spin_byn_wholesale
    : settings.spin_byn_retail;
  if (threshold <= 0) return { accrued: false, reason: "threshold_zero" };

  ensureCustomerBalance(order.customer_id);

  const accumulatedColumn = isWholesale
    ? "accumulated_wholesale_byn"
    : "accumulated_retail_byn";

  const tx = db.transaction(() => {
    // Idempotency journal: PRIMARY KEY enforces "one accrual per order_id".
    // If this row already exists, INSERT OR IGNORE leaves changes === 0 and
    // we exit cleanly. This replaces the old `last_synced_order_id` check
    // which was unsafe when orders were processed out of order.
    const ledgerInsert = db
      .prepare(
        `INSERT OR IGNORE INTO wheel_balance_ledger
         (order_id, customer_id, amount_byn, spins_added, is_wholesale, accrued_at)
         VALUES (?, ?, ?, 0, ?, DATETIME('now'))`,
      )
      .run(orderId, order.customer_id, amount, isWholesale ? 1 : 0);

    if (ledgerInsert.changes === 0) {
      return { spinsAdded: 0, remaining: null, alreadySynced: true };
    }

    const fresh = db
      .prepare("SELECT * FROM wheel_customer_balances WHERE customer_id = ?")
      .get(order.customer_id);
    const accumulated =
      safeNumber(fresh[accumulatedColumn], 0) + amount;
    const spinsToAdd = Math.floor(accumulated / threshold);
    const remaining = accumulated - spinsToAdd * threshold;

    db.prepare(
      `UPDATE wheel_customer_balances
       SET spins_available = spins_available + ?,
           ${accumulatedColumn} = ?,
           last_updated_at = DATETIME('now')
       WHERE customer_id = ?`,
    ).run(spinsToAdd, remaining, order.customer_id);
    // S2-N3: last_synced_order_id is no longer used for idempotency
    // (B3 moved that to wheel_balance_ledger.order_id PRIMARY KEY).
    // Stop writing to the column so it doesn't mislead future readers
    // into thinking it gates accrual. The column itself is left in the
    // schema to avoid a destructive migration.

    db.prepare(
      `UPDATE wheel_balance_ledger
       SET spins_added = ?
       WHERE order_id = ?`,
    ).run(spinsToAdd, orderId);

    return { spinsAdded: spinsToAdd, remaining, alreadySynced: false };
  });

  const result = tx();
  if (result.alreadySynced) {
    return { accrued: false, reason: "already_synced", spins_added: 0 };
  }
  registerCustomerProfitForEpicPools(order.customer_id);
  return {
    accrued: true,
    spins_added: result.spinsAdded,
    accumulated_remaining: result.remaining,
  };
}

function getActiveEpicPrizes() {
  return db
    .prepare(
      `SELECT * FROM wheel_prizes
       WHERE is_active = 1
         AND rarity_code IN (
           SELECT code FROM wheel_rarities WHERE is_elite = 1
         )
         AND (max_total = 0 OR issued_count < max_total)`,
    )
    .all();
}

function getActivePoolForPrize(prizeId) {
  return db
    .prepare(
      `SELECT * FROM wheel_epic_pools
       WHERE prize_id = ? AND is_active = 1
       ORDER BY opened_at DESC
       LIMIT 1`,
    )
    .get(prizeId);
}

function ensureActiveEpicPool(prize) {
  const existing = getActivePoolForPrize(prize.id);
  if (existing) return existing;

  const id = generateId(POOL_ID_PREFIX);
  const poolSize = Math.max(1, Math.floor(safeNumber(prize.epic_pool_size, 5)));
  const thresholdByn = Math.max(0, safeNumber(prize.epic_pool_threshold_byn, 300));
  db.prepare(
    `INSERT INTO wheel_epic_pools (
      id, prize_id, pool_size, threshold_byn, qualified_customers_json, is_active
    ) VALUES (?, ?, ?, ?, '[]', 1)`,
  ).run(id, prize.id, poolSize, thresholdByn);
  logWheelEvent("pool_created", {
    pool_id: id,
    prize_id: prize.id,
    pool_size: poolSize,
    threshold_byn: thresholdByn,
    qualified_count: 0,
  });
  return db.prepare("SELECT * FROM wheel_epic_pools WHERE id = ?").get(id);
}

function getEpicReferenceSince(prize, settings) {
  const lastClosed = db
    .prepare(
      `SELECT closed_at FROM wheel_epic_pools
       WHERE prize_id = ? AND is_active = 0
       ORDER BY closed_at DESC
       LIMIT 1`,
    )
    .get(prize.id);
  if (lastClosed?.closed_at) return lastClosed.closed_at;
  // Both sides of comparison must be in SQLite "YYYY-MM-DD HH:MM:SS"
  // shape. start_collecting_at comes through getWheelSettings()
  // which already normalizes to that format. Fall back to epoch zero
  // in the same format if no marker is set.
  return settings.start_collecting_at || "1970-01-01 00:00:00";
}

/**
 * For each active epic prize, recompute pool membership for the given
 * customer. Idempotent. Should be called whenever an order transitions to
 * delivered/completed.
 */
export function registerCustomerProfitForEpicPools(customerId) {
  if (!customerId) return { updated: 0 };
  const settings = getWheelSettings();
  const epicPrizes = getActiveEpicPrizes();
  let updatedPools = 0;

  for (const prize of epicPrizes) {
    const pool = ensureActiveEpicPool(prize);
    const since = getEpicReferenceSince(prize, settings);
    const profit = getCustomerProfitSince(customerId, since);
    if (profit < safeNumber(pool.threshold_byn, 0)) continue;

    const list = parseJson(pool.qualified_customers_json, []);
    if (Array.isArray(list) && list.includes(customerId)) continue;
    const nextList = Array.isArray(list) ? [...list, customerId] : [customerId];
    db.prepare(
      `UPDATE wheel_epic_pools SET qualified_customers_json = ? WHERE id = ?`,
    ).run(JSON.stringify(nextList), pool.id);
    updatedPools += 1;
  }

  return { updated: updatedPools };
}

function findEpicPrizeReadyForCustomer(customerId, isWholesale) {
  const epicPrizes = getActiveEpicPrizes().filter((prize) => {
    if (isWholesale) return Number(prize.is_for_wholesale || 0) === 1;
    return Number(prize.is_for_retail || 0) === 1;
  });
  for (const prize of epicPrizes) {
    const pool = getActivePoolForPrize(prize.id);
    if (!pool) continue;
    const list = parseJson(pool.qualified_customers_json, []);
    if (!Array.isArray(list)) continue;
    if (list.length < safeNumber(pool.pool_size, 0)) continue;
    if (!list.includes(customerId)) continue;
    return { prize, pool };
  }
  return null;
}

function isEliteRarity(rarityCode, settings) {
  return settings.elite_rarities.includes(rarityCode);
}

function pickPityPrize(prizes, settings, rng = Math.random) {
  // Primary attempt: stay within the spirit of the pity rule and pick a
  // non-elite, non-"nothing" reward.
  const primary = prizes.filter(
    (prize) =>
      prize.rarity_code !== "nothing" &&
      !isEliteRarity(prize.rarity_code, settings) &&
      effectiveWeight(prize) > 0,
  );
  const primaryPick = pickWeightedRandom(primary, rng);
  if (primaryPick) return { prize: primaryPick, fallback: null };

  // Secondary fallback (S7): no qualifying non-elite reward exists. Better to
  // give the player anything other than another "nothing" than to drop them
  // back to weighted-random where "nothing" might fire yet again.
  const secondary = prizes.filter(
    (prize) =>
      prize.rarity_code !== "nothing" && effectiveWeight(prize) > 0,
  );
  const secondaryPick = pickWeightedRandom(secondary, rng);
  if (secondaryPick) {
    return { prize: secondaryPick, fallback: "non_elite_pool_empty" };
  }

  // Tertiary fallback: even elites are exhausted. Try ANY active prize with
  // weight > 0 (epic, anything). Worst case: nothing exists at all and the
  // caller falls back to the literal "nothing" prize. We surface that
  // through the second tuple element so the caller can log it.
  const tertiary = prizes.filter(
    (prize) =>
      prize.rarity_code !== "nothing" &&
      Number(prize.weight || 0) > 0,
  );
  const tertiaryPick = pickWeightedRandom(tertiary, rng);
  if (tertiaryPick) {
    return { prize: tertiaryPick, fallback: "no_candidates" };
  }

  return { prize: null, fallback: "no_candidates" };
}

function generatePromoForPrize(prize, settings, ownerCustomerId = null) {
  if (!prize.promo_template_id || prize.rarity_code === "nothing") {
    return null;
  }

  const template = db
    .prepare("SELECT * FROM promo_codes WHERE id = ?")
    .get(prize.promo_template_id);

  if (!template) return null;

  const promoId = generateId(PROMO_ID_PREFIX);
  const validityDays =
    Math.max(
      1,
      Math.floor(safeNumber(prize.promo_validity_days, settings.default_promo_validity_days)),
    );
  const validFromDate = new Date().toISOString().slice(0, 10);
  // S4: precompute valid_until so admin "Просроченные" filter works for
  // generated wheel promos. validFromDate + (validityDays - 1) gives the
  // inclusive last day, matching how validatePromoCode interprets
  // duration_days.
  const validUntilDate = addDaysToIsoDate(validFromDate, validityDays - 1);
  // valid_until is timestamped at end-of-day in ISO 8601 so the existing
  // `now > promo.valid_until` check in validatePromoCode keeps working
  // identically for wheel-issued and manually issued promos.
  const validUntilIso = `${validUntilDate}T23:59:59.999Z`;

  let attempt = 0;
  let code = generatePromoCode();
  while (attempt < 5) {
    const exists = db.prepare("SELECT 1 FROM promo_codes WHERE code = ?").get(code);
    if (!exists) break;
    code = generatePromoCode();
    attempt += 1;
  }

  // is_wheel_template = 0 on the generated child code so that
  // validatePromoCode does NOT reject it. Only the original template row
  // (manually flagged in CRM) should be rejected.
  // S2-N1: wheel_owner_customer_id binds the code to the winner so it
  // can't be redeemed by another telegram user even if the promo string
  // leaks.
  db.prepare(
    `INSERT INTO promo_codes (
      id, code, description, discount_type, discount_value, min_order_amount,
      max_uses, current_uses, valid_from, valid_until, active,
      customer_description, manager_description, has_gift,
      valid_from_date, duration_days, is_wheel_template,
      wheel_owner_customer_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, NULL, ?, 1, ?, ?, ?, ?, ?, 0, ?, DATETIME('now'))`,
  ).run(
    promoId,
    code,
    template.description || prize.title,
    template.discount_type,
    template.discount_value,
    template.min_order_amount,
    validUntilIso,
    template.customer_description || prize.title,
    template.manager_description || null,
    Number(template.has_gift || 0),
    validFromDate,
    validityDays,
    ownerCustomerId || null,
  );

  return { promoId, code, validUntil: validUntilDate };
}

function addDaysToIsoDate(isoDate, dayOffset) {
  const [year, month, day] = isoDate.split("-").map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return isoDate;
  }
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

/**
 * Spin the wheel for a customer. Wrapped in a single transaction so a
 * concurrent call cannot double-spend a single spin or skip an epic pool.
 */
export function spinWheelForCustomer({
  customerId,
  isWholesale = false,
  rng = Math.random,
  idempotencyKey = null,
}) {
  if (!customerId) {
    const error = new Error("customer_required");
    error.code = "customer_required";
    throw error;
  }

  const settings = getWheelSettings();
  const tx = db.transaction(() => {
    const balance = ensureCustomerBalance(customerId);
    if (balance.spins_available <= 0) {
      const error = new Error("not_enough_spins");
      error.code = "not_enough_spins";
      throw error;
    }

    const prizes = loadActivePrizesForCustomer({ isWholesale });
    if (!prizes.length) {
      const error = new Error("no_prizes_configured");
      error.code = "no_prizes_configured";
      throw error;
    }

    let chosenPrize = null;
    let isEpicRelease = false;
    let isPityRelease = false;
    let pityFallbackReason = null;
    let carriedOverCount = 0;

    const epicReady = findEpicPrizeReadyForCustomer(customerId, isWholesale);
    if (epicReady) {
      // Race-safety re-check (B6): findEpicPrizeReadyForCustomer reads the
      // pool outside any lock. By the time we get here another concurrent
      // spin could have already closed this pool. Verify is_active = 1
      // inside the tx and only commit the epic release if it's still open.
      const stillActive = db
        .prepare(
          "SELECT id FROM wheel_epic_pools WHERE id = ? AND is_active = 1 LIMIT 1",
        )
        .get(epicReady.pool.id);
      if (stillActive) {
        chosenPrize = epicReady.prize;
        isEpicRelease = true;
      }
    }

    if (
      !chosenPrize &&
      Number(balance.consecutive_nothing || 0) >= settings.pity_threshold
    ) {
      const pityResult = pickPityPrize(prizes, settings, rng);
      if (pityResult.prize) {
        chosenPrize = pityResult.prize;
        isPityRelease = true;
        pityFallbackReason = pityResult.fallback;
      } else {
        pityFallbackReason = pityResult.fallback || "no_candidates";
      }
    }

    if (!chosenPrize) {
      chosenPrize = pickWeightedRandom(prizes, rng);
    }

    if (!chosenPrize) {
      const fallback = prizes.find((prize) => prize.rarity_code === "nothing");
      if (!fallback) {
        const error = new Error("no_prizes_available");
        error.code = "no_prizes_available";
        throw error;
      }
      chosenPrize = fallback;
    }

    if (pityFallbackReason) {
      logWheelEvent("pity_fallback", {
        customer_id: customerId,
        prize_id: chosenPrize.id,
        fallback_reason: pityFallbackReason,
      });
    }

    const promo = generatePromoForPrize(chosenPrize, settings, customerId);
    const seed = Math.floor(rng() * 0x7fffffff);
    const spinId = generateId(SPIN_ID_PREFIX);

    db.prepare(
      `INSERT INTO wheel_spins (
        id, customer_id, prize_id, rarity_code, is_wholesale,
        generated_promo_code_id, generated_promo_code, promo_valid_until,
        is_epic_release, is_pity_release, seed_for_animation,
        idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      spinId,
      customerId,
      chosenPrize.id,
      chosenPrize.rarity_code,
      isWholesale ? 1 : 0,
      promo?.promoId || null,
      promo?.code || null,
      promo?.validUntil || null,
      isEpicRelease ? 1 : 0,
      isPityRelease ? 1 : 0,
      seed,
      idempotencyKey || null,
    );

    db.prepare(
      `UPDATE wheel_prizes
       SET issued_count = issued_count + 1
       WHERE id = ?`,
    ).run(chosenPrize.id);

    if (isEpicRelease && epicReady?.pool) {
      db.prepare(
        `UPDATE wheel_epic_pools
         SET is_active = 0,
             released_to_customer_id = ?,
             closed_at = DATETIME('now')
         WHERE id = ?`,
      ).run(customerId, epicReady.pool.id);
      // E5: a customer can be qualified in several active epic pools at
      // once (different prizes, different release thresholds). After
      // they win one, the other pools must drop them — otherwise the
      // very next spin would gift them a second epic prize "for free"
      // because they still satisfy `list.length >= pool_size` and
      // `list.includes(customerId)` in those other pools. Strictly
      // serial: same transaction as the spin so a parallel spin can't
      // observe a half-cleaned state.
      const otherPools = db
        .prepare(
          "SELECT id, qualified_customers_json FROM wheel_epic_pools WHERE is_active = 1 AND id != ?",
        )
        .all(epicReady.pool.id);
      for (const otherPool of otherPools) {
        const list = parseJson(otherPool.qualified_customers_json, []);
        if (!Array.isArray(list) || !list.includes(customerId)) continue;
        const filtered = list.filter((id) => id !== customerId);
        db.prepare(
          "UPDATE wheel_epic_pools SET qualified_customers_json = ? WHERE id = ?",
        ).run(JSON.stringify(filtered), otherPool.id);
      }

      const refreshedPrize = db
        .prepare("SELECT * FROM wheel_prizes WHERE id = ?")
        .get(chosenPrize.id);
      const prizeMaxTotal = Number(refreshedPrize.max_total || 0);
      const prizeIssuedCount = Number(refreshedPrize.issued_count || 0);
      const prizeExhausted =
        prizeMaxTotal > 0 && prizeIssuedCount >= prizeMaxTotal;

      if (prizeExhausted) {
        db.prepare("UPDATE wheel_prizes SET is_active = 0 WHERE id = ?").run(
          chosenPrize.id,
        );
      } else if (refreshedPrize.is_active) {
        // Q4: carry-over for epic prizes with max_total > 1 (or 0 = unlimited).
        // The pool we just closed contained N qualified customers, exactly
        // one of whom won. The remaining N-1 already crossed the profit
        // threshold and would otherwise have to re-qualify under a fresh
        // pool that only counts profit accrued AFTER closed_at — which in
        // practice means they fall out of the system unless they make new
        // orders. Move them into a brand new active pool so the next time
        // any of them spins they get the prize guaranteed (they are already
        // "in the queue").
        //
        // This matches industry practice: lottery jackpots roll over to
        // the next draw, and gacha pity counters carry across banners of
        // the same type. A player who paid into eligibility keeps that
        // eligibility until they actually win.
        const oldQualified = parseJson(epicReady.pool.qualified_customers_json, []);
        const carryOver = Array.isArray(oldQualified)
          ? oldQualified.filter((id) => id && id !== customerId)
          : [];

        if (carryOver.length > 0) {
          const newPoolId = generateId(POOL_ID_PREFIX);
          // Q4 design choice: pool_size of the carry-over pool == the
          // number of carried members. This keeps the contract
          // `list.length >= pool_size` true at creation time, so the
          // very next spin from any of these N-1 customers releases the
          // prize. The user-visible promise is "you crossed the
          // threshold, you're in the queue, the next time you spin you
          // win" — anything else (re-using the original pool_size) would
          // make them wait for a fresh qualifier, which is what we
          // explicitly chose to fix.
          const carryOverPoolSize = Math.max(1, carryOver.length);
          db.prepare(
            `INSERT INTO wheel_epic_pools (
              id, prize_id, pool_size, threshold_byn,
              qualified_customers_json, is_active, opened_at
            ) VALUES (?, ?, ?, ?, ?, 1, DATETIME('now'))`,
          ).run(
            newPoolId,
            chosenPrize.id,
            carryOverPoolSize,
            Math.max(0, safeNumber(epicReady.pool.threshold_byn, 0)),
            JSON.stringify(carryOver),
          );
          carriedOverCount = carryOver.length;
          logWheelEvent("pool_created", {
            pool_id: newPoolId,
            prize_id: chosenPrize.id,
            pool_size: carryOverPoolSize,
            threshold_byn: Math.max(0, safeNumber(epicReady.pool.threshold_byn, 0)),
            qualified_count: carryOver.length,
            reason: "carry_over",
            previous_pool_id: epicReady.pool.id,
          });
        }
      }
    }

    const isNothing = chosenPrize.rarity_code === "nothing";
    const nextConsecutiveNothing = isNothing
      ? Number(balance.consecutive_nothing || 0) + 1
      : 0;

    db.prepare(
      `UPDATE wheel_customer_balances
       SET spins_available = spins_available - 1,
           consecutive_nothing = ?,
           last_updated_at = DATETIME('now')
       WHERE customer_id = ?`,
    ).run(nextConsecutiveNothing, customerId);

    // P3: structured event log emitted once per successful spin. Emit
    // AFTER all DB writes so a row in the log corresponds to a row in
    // wheel_spins (no orphan logs from rolled-back transactions).
    if (isEpicRelease && epicReady?.pool) {
      logWheelEvent("pool_closed", {
        pool_id: epicReady.pool.id,
        prize_id: chosenPrize.id,
        winner_id: customerId,
        carryover_size: carriedOverCount,
      });
      logWheelEvent("epic_release", {
        customer_id: customerId,
        prize_id: chosenPrize.id,
        rarity_code: chosenPrize.rarity_code,
        pool_id: epicReady.pool.id,
        carried_over_count: carriedOverCount,
      });
    }
    if (isPityRelease) {
      logWheelEvent("pity_release", {
        customer_id: customerId,
        prize_id: chosenPrize.id,
        rarity_code: chosenPrize.rarity_code,
        fallback_reason: pityFallbackReason || null,
      });
    }
    logWheelEvent("spin", {
      customer_id: customerId,
      spin_id: spinId,
      prize_id: chosenPrize.id,
      rarity_code: chosenPrize.rarity_code,
      is_epic: isEpicRelease,
      is_pity: isPityRelease,
      is_wholesale: Boolean(isWholesale),
      seed,
    });

    return {
      spinId,
      prize: chosenPrize,
      seed,
      promo,
      isEpicRelease,
      isPityRelease,
    };
  });

  return tx();
}

export function getCustomerWheelState(customerId, { isWholesale = false } = {}) {
  const settings = getWheelSettings();
  const balance = customerId ? ensureCustomerBalance(customerId) : null;
  // Q6: feed_consent_required tells the frontend whether to show the
  // first-visit modal. We treat consent as "answered once" — anything
  // other than NULL on wheel_feed_consent_at means the customer already
  // made a choice (consent_at is stamped on both accept and decline so
  // we don't keep nagging). Anonymous viewers (no customerId) never
  // see the modal — the wheel itself is open, but consent only matters
  // when there's a customer row to bind it to.
  const customerConsentRow = customerId
    ? db
        .prepare(
          "SELECT wheel_feed_consent AS consent, wheel_feed_consent_at AS consent_at FROM customers WHERE id = ?",
        )
        .get(customerId)
    : null;
  const feedConsent = Number(customerConsentRow?.consent || 0) === 1;
  const feedConsentRequired = Boolean(
    customerId && (!customerConsentRow || !customerConsentRow.consent_at),
  );
  const accumulated = balance
    ? safeNumber(
        isWholesale
          ? balance.accumulated_wholesale_byn
          : balance.accumulated_retail_byn,
        0,
      )
    : 0;
  const threshold = isWholesale
    ? settings.spin_byn_wholesale
    : settings.spin_byn_retail;

  const rarities = listRarities();
  const rarityByCode = new Map(rarities.map((rarity) => [rarity.code, rarity]));

  const prizes = loadActivePrizesForCustomer({ isWholesale }).map((prize) => {
    const rarity = rarityByCode.get(prize.rarity_code) || null;
    return {
      id: prize.id,
      title: prize.title,
      description: prize.description,
      image_url: prize.image_url,
      rarity: rarity
        ? {
            code: rarity.code,
            label: rarity.label,
            bgColor: rarity.bgColor,
            textColor: rarity.textColor,
            isElite: Boolean(rarity.isElite),
          }
        : null,
      weight: Number(prize.weight || 0),
      effective_weight: effectiveWeight(prize),
      max_total: Number(prize.max_total || 0),
      issued_count: Number(prize.issued_count || 0),
      is_exhausted:
        Number(prize.max_total || 0) > 0 &&
        Number(prize.issued_count || 0) >= Number(prize.max_total || 0),
      sort_order: Number(prize.sort_order || 0),
    };
  });

  const feed = db
    .prepare(
      `SELECT s.id, s.spun_at, s.rarity_code, s.is_wholesale,
              p.title AS prize_title,
              c.first_name, c.last_name, c.photo_url AS customer_photo
       FROM wheel_spins s
       JOIN wheel_prizes p ON p.id = s.prize_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.rarity_code != 'nothing'
         AND s.customer_id IS NOT NULL
         -- Show only fresh wins from the last 24 hours so the feed
         -- always reflects current "live" activity. Older entries
         -- create a stale impression even when feed_size allows them.
         AND s.spun_at >= DATETIME('now', '-24 hours')
         -- S29: do not show winners that have been deleted from CRM (deleted_at)
         -- nor winners that currently have an active block (customer_blocks).
         -- Showing them in the public feed would leak attempted PII recovery
         -- after the customer asked to be erased / blocked. The block check
         -- mirrors the canonical predicate from utils/customer-blocks.js.
         AND c.deleted_at IS NULL
         -- Q6: only winners who explicitly opted in to PII display in
         -- the live feed are visible. Default is 0 (no consent yet),
         -- so a freshly-migrated DB shows an empty feed until customers
         -- start tapping "Согласен" in the consent modal. This matches
         -- the regulatory ask in BY (закон о персональных данных) and
         -- the design decision logged in docs/wheel-open-questions.md Q6.
         AND c.wheel_feed_consent = 1
         AND NOT EXISTS (
           SELECT 1 FROM customer_blocks cb
           WHERE cb.customer_id = c.id
             AND cb.active = 1
             AND (cb.block_until IS NULL OR cb.block_until > DATETIME('now'))
         )
       ORDER BY s.spun_at DESC
       LIMIT ?`,
    )
    .all(settings.feed_size)
    .map((row) => {
      const rarity = rarityByCode.get(row.rarity_code) || null;
      return {
        id: row.id,
        spun_at: row.spun_at,
        prize_title: row.prize_title,
        first_name: row.first_name || "Гость",
        last_initial: row.last_name ? String(row.last_name).slice(0, 1) : "",
        photo: row.customer_photo || null,
        rarity: rarity
          ? {
              code: rarity.code,
              label: rarity.label,
              bgColor: rarity.bgColor,
              textColor: rarity.textColor,
            }
          : null,
      };
    });

  const myActivePrizes = customerId
    ? db
        .prepare(
          `SELECT s.id, s.spun_at, s.rarity_code, s.generated_promo_code AS promo_code,
                  s.promo_valid_until, s.prize_used_at, s.is_wholesale,
                  p.title AS prize_title, p.description AS prize_description
           FROM wheel_spins s
           JOIN wheel_prizes p ON p.id = s.prize_id
           WHERE s.customer_id = ?
             AND s.rarity_code != 'nothing'
           ORDER BY s.spun_at DESC
           LIMIT 50`,
        )
        .all(customerId)
        .map((row) => {
          const rarity = rarityByCode.get(row.rarity_code) || null;
          return {
            ...row,
            rarity: rarity
              ? {
                  code: rarity.code,
                  label: rarity.label,
                  bgColor: rarity.bgColor,
                  textColor: rarity.textColor,
                }
              : null,
          };
        })
    : [];

  return {
    balance: {
      spins_available: balance ? Number(balance.spins_available || 0) : 0,
      accumulated_byn: accumulated,
      threshold_byn: threshold,
      progress_percent:
        threshold > 0 ? Math.min(100, Math.round((accumulated / threshold) * 100)) : 0,
      consecutive_nothing: balance ? Number(balance.consecutive_nothing || 0) : 0,
    },
    prizes,
    rarities,
    feed,
    my_active_prizes: myActivePrizes,
    feed_consent: feedConsent,
    feed_consent_required: feedConsentRequired,
    settings: {
      pity_threshold: settings.pity_threshold,
      spin_byn_retail: settings.spin_byn_retail,
      spin_byn_wholesale: settings.spin_byn_wholesale,
      elite_rarities: settings.elite_rarities,
    },
  };
}

/**
 * Q6: persist the customer's choice for live-feed PII display.
 *
 * `consent` is a strict boolean. The current value plus the timestamp of
 * the most recent choice are stamped together so the frontend can stop
 * showing the consent modal regardless of accept vs decline. Returning
 * `null` lets the route turn that into a 404 without leaking customer
 * existence.
 */
export function setFeedConsent(customerId, consent) {
  if (!customerId) return null;
  const customer = db
    .prepare("SELECT id FROM customers WHERE id = ?")
    .get(customerId);
  if (!customer) return null;

  const next = consent ? 1 : 0;
  db.prepare(
    `UPDATE customers
     SET wheel_feed_consent = ?,
         wheel_feed_consent_at = DATETIME('now')
     WHERE id = ?`,
  ).run(next, customerId);

  logWheelEvent("consent_changed", {
    customer_id: customerId,
    consent: Boolean(consent),
  });

  const row = db
    .prepare(
      "SELECT wheel_feed_consent AS consent, wheel_feed_consent_at AS consent_at FROM customers WHERE id = ?",
    )
    .get(customerId);
  return {
    consent: Number(row?.consent || 0) === 1,
    consent_at: row?.consent_at || null,
  };
}

export function listAdminPrizes() {
  const rarities = listRarities();
  const rarityByCode = new Map(rarities.map((rarity) => [rarity.code, rarity]));
  return db
    .prepare(
      `SELECT * FROM wheel_prizes ORDER BY sort_order ASC, created_at ASC`,
    )
    .all()
    .map((prize) => ({
      ...prize,
      rarity: rarityByCode.get(prize.rarity_code) || null,
      is_active: Boolean(prize.is_active),
      is_for_retail: Boolean(prize.is_for_retail),
      is_for_wholesale: Boolean(prize.is_for_wholesale),
    }));
}

/**
 * Validate the create/update prize payload from CRM.
 *
 * Returns { errors: string[] } where each entry is a short slug like
 * `rarity_unknown`. Callers (admin routes) should respond with HTTP 400
 * and `details: errors[]` when any entry is present.
 *
 * C3-CR: when called with `isUpdate: true`, pass the current row in
 * `existing` so we can validate "at least one pool stays enabled" even
 * when the partial payload only touches one of the two flags.
 */
export function validatePrizePayload(payload, { isUpdate = false, existing = null } = {}) {
  const errors = [];
  const data = payload || {};

  if (!isUpdate || data.rarity_code !== undefined) {
    const rarityCode = String(data.rarity_code || "").trim();
    if (!rarityCode) {
      errors.push("rarity_code_required");
    } else {
      const rarity = db
        .prepare("SELECT 1 FROM wheel_rarities WHERE code = ? LIMIT 1")
        .get(rarityCode);
      if (!rarity) errors.push("rarity_unknown");
    }
  }

  if (data.promo_template_id) {
    // C1-CR: extra defensive check — confirm the referenced row exists.
    // We do not block reusing the same template across prizes; that
    // matches the docs ("Promo-template can be used as wheel template").
    const template = db
      .prepare("SELECT id FROM promo_codes WHERE id = ? LIMIT 1")
      .get(String(data.promo_template_id));
    if (!template) errors.push("promo_template_not_found");
  }

  // is_for_retail / is_for_wholesale: at least one must be truthy.
  // C3-CR: on partial update, fall back to the existing row's value for
  // the flag that wasn't touched by the payload — otherwise PATCHing
  // only `is_for_retail=false` could leave the prize with both pools
  // disabled and never get caught here.
  const retailGiven = Object.prototype.hasOwnProperty.call(data, "is_for_retail");
  const wholesaleGiven = Object.prototype.hasOwnProperty.call(data, "is_for_wholesale");
  if (!isUpdate || retailGiven || wholesaleGiven) {
    const retailFlag = retailGiven
      ? Boolean(data.is_for_retail)
      : existing
        ? Boolean(existing.is_for_retail)
        : true;
    const wholesaleFlag = wholesaleGiven
      ? Boolean(data.is_for_wholesale)
      : existing
        ? Boolean(existing.is_for_wholesale)
        : false;
    if (!retailFlag && !wholesaleFlag) {
      errors.push("at_least_one_pool_required");
    }
  }

  if (data.weight !== undefined) {
    const weight = Number(data.weight);
    if (!Number.isFinite(weight) || weight < 0) {
      errors.push("weight_must_be_non_negative");
    }
  }

  if (data.epic_pool_size !== undefined) {
    const size = Number(data.epic_pool_size);
    if (!Number.isFinite(size) || size < 1) {
      errors.push("epic_pool_size_must_be_positive");
    }
  }

  if (data.epic_pool_threshold_byn !== undefined) {
    const threshold = Number(data.epic_pool_threshold_byn);
    if (!Number.isFinite(threshold) || threshold < 1) {
      errors.push("epic_pool_threshold_must_be_positive");
    }
  }

  if (data.promo_validity_days !== undefined) {
    const days = Number(data.promo_validity_days);
    if (!Number.isFinite(days) || days < 1) {
      errors.push("promo_validity_days_must_be_positive");
    }
  }

  if (data.max_total !== undefined) {
    const maxTotal = Number(data.max_total);
    if (!Number.isFinite(maxTotal) || maxTotal < 0) {
      errors.push("max_total_must_be_non_negative");
    }
  }

  if (!isUpdate) {
    if (!String(data.title || "").trim()) {
      errors.push("title_required");
    }
  } else if (data.title !== undefined && !String(data.title || "").trim()) {
    errors.push("title_required");
  }

  return { errors };
}

/**
 * Validate the wheel settings payload (PUT /api/admin/crm/wheel/settings).
 * Returns { errors: string[] }.
 */
export function validateWheelSettingsPayload(payload) {
  const errors = [];
  const data = payload || {};

  const positiveNumberKeys = [
    "spin_byn_retail",
    "spin_byn_wholesale",
    "pity_threshold",
    "default_promo_validity_days",
    "feed_size",
  ];
  for (const key of positiveNumberKeys) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    const value = Number(data[key]);
    if (!Number.isFinite(value) || value < 1) {
      errors.push(`${key}_must_be_positive`);
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(data, "elite_rarities") ||
    Object.prototype.hasOwnProperty.call(data, "elite_rarities_json")
  ) {
    const raw =
      data.elite_rarities !== undefined ? data.elite_rarities : data.elite_rarities_json;
    if (raw !== null && raw !== undefined && !Array.isArray(raw)) {
      errors.push("elite_rarities_must_be_array");
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, "start_collecting_at")) {
    const raw = data.start_collecting_at;
    if (raw !== null && raw !== undefined && raw !== "") {
      const str = String(raw).trim();
      if (str.toLowerCase() === "null" || str.toLowerCase() === "undefined") {
        errors.push("start_collecting_at_invalid");
      } else {
        const parsed = new Date(str);
        if (Number.isNaN(parsed.getTime())) {
          errors.push("start_collecting_at_invalid");
        }
      }
    }
  }

  return { errors };
}

export function createPrize(payload) {
  const id = generateId("wp");
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO wheel_prizes (
        id, rarity_code, title, description, image_url, weight,
        max_total, is_for_retail, is_for_wholesale, promo_template_id,
        promo_validity_days, epic_pool_size, epic_pool_threshold_byn,
        is_active, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      String(payload.rarity_code || "common"),
      String(payload.title || "").trim() || "Без названия",
      payload.description ? String(payload.description) : null,
      payload.image_url ? String(payload.image_url) : null,
      Math.max(0, safeNumber(payload.weight, 1)),
      Math.max(0, Math.floor(safeNumber(payload.max_total, 0))),
      payload.is_for_retail === false ? 0 : 1,
      payload.is_for_wholesale ? 1 : 0,
      payload.promo_template_id || null,
      Math.max(1, Math.floor(safeNumber(payload.promo_validity_days, 90))),
      Math.max(1, Math.floor(safeNumber(payload.epic_pool_size, 5))),
      Math.max(0, safeNumber(payload.epic_pool_threshold_byn, 300)),
      payload.is_active === false ? 0 : 1,
      Math.floor(safeNumber(payload.sort_order, 0)),
    );

    // C1-CR: flag the linked promo_codes row as a wheel template so that
    // validatePromoCode rejects direct customer application. Done inside
    // the same transaction as the INSERT so we never end up in a state
    // where the prize references a template that isn't flagged.
    if (payload.promo_template_id) {
      db.prepare(
        "UPDATE promo_codes SET is_wheel_template = 1 WHERE id = ?",
      ).run(payload.promo_template_id);
    }
  });
  tx();
  return db.prepare("SELECT * FROM wheel_prizes WHERE id = ?").get(id);
}

export function updatePrize(id, payload) {
  const existing = db
    .prepare("SELECT * FROM wheel_prizes WHERE id = ?")
    .get(id);
  if (!existing) return null;

  const merged = { ...existing, ...payload };
  const previousTemplateId = existing.promo_template_id || null;
  const nextTemplateId = merged.promo_template_id || null;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE wheel_prizes
       SET rarity_code = ?,
           title = ?,
           description = ?,
           image_url = ?,
           weight = ?,
           max_total = ?,
           is_for_retail = ?,
           is_for_wholesale = ?,
           promo_template_id = ?,
           promo_validity_days = ?,
           epic_pool_size = ?,
           epic_pool_threshold_byn = ?,
           is_active = ?,
           sort_order = ?
       WHERE id = ?`,
    ).run(
      String(merged.rarity_code || "common"),
      String(merged.title || "").trim() || "Без названия",
      merged.description ? String(merged.description) : null,
      merged.image_url ? String(merged.image_url) : null,
      Math.max(0, safeNumber(merged.weight, 1)),
      Math.max(0, Math.floor(safeNumber(merged.max_total, 0))),
      merged.is_for_retail === false || merged.is_for_retail === 0 ? 0 : 1,
      merged.is_for_wholesale ? 1 : 0,
      nextTemplateId,
      Math.max(1, Math.floor(safeNumber(merged.promo_validity_days, 90))),
      Math.max(1, Math.floor(safeNumber(merged.epic_pool_size, 5))),
      Math.max(0, safeNumber(merged.epic_pool_threshold_byn, 300)),
      merged.is_active === false || merged.is_active === 0 ? 0 : 1,
      Math.floor(safeNumber(merged.sort_order, 0)),
      id,
    );

    // C1-CR: keep is_wheel_template synchronized with the actual usage
    // graph. If the template changed, set the new one and clear the old
    // one — but only clear when no other prize still uses it.
    if (nextTemplateId && nextTemplateId !== previousTemplateId) {
      db.prepare(
        "UPDATE promo_codes SET is_wheel_template = 1 WHERE id = ?",
      ).run(nextTemplateId);
    }
    if (
      previousTemplateId &&
      previousTemplateId !== nextTemplateId &&
      !isPromoStillUsedAsTemplate(previousTemplateId, id)
    ) {
      db.prepare(
        "UPDATE promo_codes SET is_wheel_template = 0 WHERE id = ?",
      ).run(previousTemplateId);
    }
  });
  tx();

  return db.prepare("SELECT * FROM wheel_prizes WHERE id = ?").get(id);
}

function isPromoStillUsedAsTemplate(promoId, excludePrizeId = null) {
  if (!promoId) return false;
  const params = [promoId];
  let where = "promo_template_id = ?";
  if (excludePrizeId) {
    where += " AND id != ?";
    params.push(excludePrizeId);
  }
  return Boolean(
    db.prepare(`SELECT 1 FROM wheel_prizes WHERE ${where} LIMIT 1`).get(...params),
  );
}

export function deletePrize(id) {
  // S24: soft-delete must also retire the active epic pool for that
  // prize. Otherwise the pool keeps qualified_customers_json but the
  // prize itself can't be released (is_active=0 pulls it out of
  // weighted/epic pickers), and the next time the manager re-enables
  // the prize an old, stale pool springs back into life with stale
  // membership. Closing the pool inside the same call ensures the
  // re-enable path always starts from a clean slate.
  const tx = db.transaction(() => {
    db.prepare("UPDATE wheel_prizes SET is_active = 0 WHERE id = ?").run(id);
    db.prepare(
      "UPDATE wheel_epic_pools SET is_active = 0, closed_at = DATETIME('now') WHERE prize_id = ? AND is_active = 1",
    ).run(id);
  });
  tx();
}

export function listAdminSpins({ limit = 50, offset = 0, customerId, rarity } = {}) {
  const params = [];
  const where = [];
  if (customerId) {
    where.push("s.customer_id = ?");
    params.push(customerId);
  }
  if (rarity) {
    where.push("s.rarity_code = ?");
    params.push(rarity);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit = Math.max(1, Math.min(500, Math.floor(safeNumber(limit, 50))));
  const safeOffset = Math.max(0, Math.floor(safeNumber(offset, 0)));

  const rows = db
    .prepare(
      `SELECT s.*, p.title AS prize_title, p.rarity_code,
              c.first_name, c.last_name, c.telegram_username
       FROM wheel_spins s
       JOIN wheel_prizes p ON p.id = s.prize_id
       LEFT JOIN customers c ON c.id = s.customer_id
       ${whereSql}
       ORDER BY s.spun_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, safeLimit, safeOffset);

  const totalRow = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM wheel_spins s
       JOIN wheel_prizes p ON p.id = s.prize_id
       ${whereSql}`,
    )
    .get(...params);

  return { rows, total: Number(totalRow?.count || 0) };
}

export function getAdminDashboard() {
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS total_spins,
         SUM(CASE WHEN rarity_code = 'nothing' THEN 1 ELSE 0 END) AS nothing_spins,
         SUM(CASE WHEN is_epic_release = 1 THEN 1 ELSE 0 END) AS epic_releases,
         SUM(CASE WHEN is_pity_release = 1 THEN 1 ELSE 0 END) AS pity_releases
       FROM wheel_spins`,
    )
    .get();

  const rarityBreakdown = db
    .prepare(
      `SELECT rarity_code, COUNT(*) AS count
       FROM wheel_spins
       GROUP BY rarity_code`,
    )
    .all();

  const epicPools = db
    .prepare(
      `SELECT ep.*, p.title AS prize_title
       FROM wheel_epic_pools ep
       JOIN wheel_prizes p ON p.id = ep.prize_id
       WHERE ep.is_active = 1
       ORDER BY ep.opened_at DESC`,
    )
    .all()
    .map((pool) => ({
      ...pool,
      qualified_customers: parseJson(pool.qualified_customers_json, []),
    }));

  // S2-N4: only show active prizes in the CRM dashboard. Soft-deleted
  // prizes (`is_active = 0`) used to mix into "Призы и расход", which
  // confused managers reviewing live performance — they couldn't tell
  // whether `Скрыто` columns were skipped or live. Soft-deleted ones
  // can still be inspected via the Призы tab where the manager picks
  // "Активен"/"Все". For the dashboard we keep only live rows.
  const prizesIssued = db
    .prepare(
      `SELECT p.id, p.title, p.rarity_code, p.issued_count, p.max_total,
              p.is_for_retail, p.is_for_wholesale, p.is_active
       FROM wheel_prizes p
       WHERE p.is_active = 1
       ORDER BY p.sort_order ASC, p.created_at ASC`,
    )
    .all();

  return {
    totals: {
      total_spins: Number(totals?.total_spins || 0),
      nothing_spins: Number(totals?.nothing_spins || 0),
      epic_releases: Number(totals?.epic_releases || 0),
      pity_releases: Number(totals?.pity_releases || 0),
    },
    rarity_breakdown: rarityBreakdown,
    active_epic_pools: epicPools,
    prizes_issued: prizesIssued,
  };
}
