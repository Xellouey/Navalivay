import { db } from "../db.js";

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
  elite_rarities_json: ["epic", "mythic", "gold", "legendary"],
};

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generatePromoCode() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
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
  } catch (_error) {
    return fallback;
  }
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
    start_collecting_at:
      map.get("start_collecting_at") || DEFAULT_SETTINGS.start_collecting_at,
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
    ["start_collecting_at", (v) => String(v)],
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
      if (Object.prototype.hasOwnProperty.call(partial || {}, key.replace("_json", ""))) {
        const value = partial[key.replace("_json", "")];
        upsert.run(key, transform(value));
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(partial || {}, key)) {
        upsert.run(key, transform(partial[key]));
      }
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
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(profit), 0) AS total
       FROM orders
       WHERE customer_id = ?
         AND status IN ('delivered','completed')
         AND COALESCE(completed_at, created_at) >= COALESCE(?, '1970-01-01')`,
    )
    .get(customerId, sinceIso);
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
 * according to wheel_settings thresholds. Idempotent per orderId via
 * last_synced_order_id check.
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
  if (!["delivered", "completed"].includes(order.status)) {
    return { accrued: false, reason: "status_not_final" };
  }

  const settings = getWheelSettings();
  const startCollectingAt = settings.start_collecting_at;
  const orderDate = order.completed_at || order.created_at;
  if (startCollectingAt && orderDate && orderDate < startCollectingAt) {
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

  const balance = ensureCustomerBalance(order.customer_id);
  if (balance.last_synced_order_id === orderId) {
    return { accrued: false, reason: "already_synced", spins_added: 0 };
  }

  const accumulatedColumn = isWholesale
    ? "accumulated_wholesale_byn"
    : "accumulated_retail_byn";

  const tx = db.transaction(() => {
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
           last_synced_order_id = ?,
           last_updated_at = DATETIME('now')
       WHERE customer_id = ?`,
    ).run(spinsToAdd, remaining, orderId, order.customer_id);

    return { spinsAdded: spinsToAdd, remaining };
  });

  const result = tx();
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
  db.prepare(
    `INSERT INTO wheel_epic_pools (
      id, prize_id, pool_size, threshold_byn, qualified_customers_json, is_active
    ) VALUES (?, ?, ?, ?, '[]', 1)`,
  ).run(
    id,
    prize.id,
    Math.max(1, Math.floor(safeNumber(prize.epic_pool_size, 5))),
    Math.max(0, safeNumber(prize.epic_pool_threshold_byn, 300)),
  );
  return db.prepare("SELECT * FROM wheel_epic_pools WHERE id = ?").get(id);
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
    const since = pool.opened_at > (settings.start_collecting_at || "")
      ? pool.opened_at
      : settings.start_collecting_at;
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
  const candidates = prizes.filter(
    (prize) =>
      prize.rarity_code !== "nothing" &&
      !isEliteRarity(prize.rarity_code, settings) &&
      effectiveWeight(prize) > 0,
  );
  return pickWeightedRandom(candidates, rng);
}

function generatePromoForPrize(prize, settings) {
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

  let attempt = 0;
  let code = generatePromoCode();
  while (attempt < 5) {
    const exists = db.prepare("SELECT 1 FROM promo_codes WHERE code = ?").get(code);
    if (!exists) break;
    code = generatePromoCode();
    attempt += 1;
  }

  db.prepare(
    `INSERT INTO promo_codes (
      id, code, description, discount_type, discount_value, min_order_amount,
      max_uses, current_uses, valid_from, valid_until, active,
      customer_description, manager_description, has_gift,
      valid_from_date, duration_days, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, NULL, NULL, 1, ?, ?, ?, ?, ?, DATETIME('now'))`,
  ).run(
    promoId,
    code,
    template.description || prize.title,
    template.discount_type,
    template.discount_value,
    template.min_order_amount,
    template.customer_description || prize.title,
    template.manager_description || null,
    Number(template.has_gift || 0),
    validFromDate,
    validityDays,
  );

  const validUntil = addDaysToIsoDate(validFromDate, validityDays - 1);
  return { promoId, code, validUntil };
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

    const epicReady = findEpicPrizeReadyForCustomer(customerId, isWholesale);
    if (epicReady) {
      chosenPrize = epicReady.prize;
      isEpicRelease = true;
    } else if (
      Number(balance.consecutive_nothing || 0) >= settings.pity_threshold
    ) {
      const pityPrize = pickPityPrize(prizes, settings, rng);
      if (pityPrize) {
        chosenPrize = pityPrize;
        isPityRelease = true;
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

    const promo = generatePromoForPrize(chosenPrize, settings);
    const seed = Math.floor(rng() * 0x7fffffff);
    const spinId = generateId(SPIN_ID_PREFIX);

    db.prepare(
      `INSERT INTO wheel_spins (
        id, customer_id, prize_id, rarity_code, is_wholesale,
        generated_promo_code_id, generated_promo_code, promo_valid_until,
        is_epic_release, is_pity_release, seed_for_animation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

      const refreshedPrize = db
        .prepare("SELECT * FROM wheel_prizes WHERE id = ?")
        .get(chosenPrize.id);
      if (
        Number(refreshedPrize.max_total || 0) > 0 &&
        Number(refreshedPrize.issued_count || 0) >= Number(refreshedPrize.max_total)
      ) {
        db.prepare("UPDATE wheel_prizes SET is_active = 0 WHERE id = ?").run(
          chosenPrize.id,
        );
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
              c.first_name, c.last_name, c.customer_photo
       FROM wheel_spins s
       JOIN wheel_prizes p ON p.id = s.prize_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.rarity_code != 'nothing'
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
    settings: {
      pity_threshold: settings.pity_threshold,
      spin_byn_retail: settings.spin_byn_retail,
      spin_byn_wholesale: settings.spin_byn_wholesale,
      elite_rarities: settings.elite_rarities,
    },
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

export function createPrize(payload) {
  const id = generateId("wp");
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
  return db.prepare("SELECT * FROM wheel_prizes WHERE id = ?").get(id);
}

export function updatePrize(id, payload) {
  const existing = db
    .prepare("SELECT * FROM wheel_prizes WHERE id = ?")
    .get(id);
  if (!existing) return null;

  const merged = { ...existing, ...payload };
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
    merged.promo_template_id || null,
    Math.max(1, Math.floor(safeNumber(merged.promo_validity_days, 90))),
    Math.max(1, Math.floor(safeNumber(merged.epic_pool_size, 5))),
    Math.max(0, safeNumber(merged.epic_pool_threshold_byn, 300)),
    merged.is_active === false || merged.is_active === 0 ? 0 : 1,
    Math.floor(safeNumber(merged.sort_order, 0)),
    id,
  );

  return db.prepare("SELECT * FROM wheel_prizes WHERE id = ?").get(id);
}

export function deletePrize(id) {
  db.prepare("UPDATE wheel_prizes SET is_active = 0 WHERE id = ?").run(id);
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

  const prizesIssued = db
    .prepare(
      `SELECT p.id, p.title, p.rarity_code, p.issued_count, p.max_total,
              p.is_for_retail, p.is_for_wholesale, p.is_active
       FROM wheel_prizes p
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
