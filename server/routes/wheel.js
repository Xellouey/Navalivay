import express from "express";
import rateLimit from "express-rate-limit";
import { db } from "../db.js";
import { authMiddleware } from "../auth.js";
import { requireTelegramMiniAppAuth } from "../telegram-miniapp-auth.js";
import { normalizeTelegramUsername } from "../loyalty.js";
import { resolveWholesaleContextFromRequest } from "../wholesale-service.js";
import {
  accrueWheelSpinsForOrder,
  createPrize,
  deletePrize,
  getAdminDashboard,
  getCustomerWheelState,
  getWheelSettings,
  listAdminPrizes,
  listAdminSpins,
  listRarities,
  registerCustomerProfitForEpicPools,
  spinWheelForCustomer,
  updatePrize,
  updateWheelSettings,
  validatePrizePayload,
  validateWheelSettingsPayload,
} from "../wheel/wheel-service.js";

export const wheelRouter = express.Router();

const allowInsecureTelegramFallback =
  !["production", "test"].includes(String(process.env.NODE_ENV || "").toLowerCase()) &&
  process.env.ALLOW_INSECURE_TELEGRAM_AUTH !== "0";

const wheelReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const wheelSpinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

function findCustomerFromAuth(req) {
  const telegramId = String(req.telegramAuth?.telegramId || "").trim();
  const telegramUsername = normalizeTelegramUsername(req.telegramAuth?.telegramUsername);
  if (telegramId) {
    const byId = db
      .prepare("SELECT * FROM customers WHERE telegram_id = ?")
      .get(telegramId);
    if (byId) return byId;
  }
  if (telegramUsername) {
    return db
      .prepare(
        "SELECT * FROM customers WHERE LOWER(COALESCE(telegram_username, '')) = LOWER(?) LIMIT 1",
      )
      .get(telegramUsername);
  }
  return null;
}

/**
 * Resolve wholesale context for wheel routes.
 *
 * B4 fix: previously this checked only that the headers were present,
 * which let any retail client forge `X-Wholesale-Code` /
 * `X-Wholesale-Secret` from DevTools and read the wholesale prize pool.
 * Now we delegate to resolveWholesaleContextFromRequest which validates
 * tier+secret against wholesale_tiers. On read endpoints we fall back
 * to retail (return false) instead of 403, so stale or malformed
 * headers do not break UX — the customer simply sees the retail wheel.
 */
function isValidatedWholesaleRequest(req) {
  try {
    const context = resolveWholesaleContextFromRequest(req);
    return Boolean(context?.isWholesale);
  } catch (_error) {
    // Bad creds (wrong tier/secret pair, missing half of the pair, etc.)
    // are treated as retail rather than rejected outright. If the legit
    // wholesale link is broken the customer can still browse.
    return false;
  }
}

wheelRouter.get(
  "/api/wheel/state",
  wheelReadLimiter,
  requireTelegramMiniAppAuth({ allowInsecureFallback: allowInsecureTelegramFallback }),
  (req, res) => {
    try {
      const customer = findCustomerFromAuth(req);
      const isWholesale = isValidatedWholesaleRequest(req);
      const state = getCustomerWheelState(customer?.id || null, { isWholesale });
      res.json({
        customer_id: customer?.id || null,
        is_wholesale: isWholesale,
        ...state,
      });
    } catch (error) {
      console.error("[wheel] state failed", error);
      res.status(500).json({ error: "wheel_state_failed", message: error.message });
    }
  },
);

wheelRouter.post(
  "/api/wheel/spin",
  wheelSpinLimiter,
  requireTelegramMiniAppAuth({ allowInsecureFallback: allowInsecureTelegramFallback }),
  (req, res) => {
    try {
      const customer = findCustomerFromAuth(req);
      if (!customer?.id) {
        return res
          .status(404)
          .json({ error: "customer_not_found", message: "Клиент не найден" });
      }
      const isWholesale = isValidatedWholesaleRequest(req);
      const result = spinWheelForCustomer({
        customerId: customer.id,
        isWholesale,
      });

      const balanceRow = db
        .prepare(
          "SELECT spins_available, accumulated_retail_byn, accumulated_wholesale_byn FROM wheel_customer_balances WHERE customer_id = ?",
        )
        .get(customer.id);

      res.json({
        spin_id: result.spinId,
        prize: {
          id: result.prize.id,
          title: result.prize.title,
          description: result.prize.description,
          image_url: result.prize.image_url,
          rarity_code: result.prize.rarity_code,
        },
        is_epic_release: Boolean(result.isEpicRelease),
        is_pity_release: Boolean(result.isPityRelease),
        promo_code: result.promo?.code || null,
        promo_valid_until: result.promo?.validUntil || null,
        animation_seed: result.seed,
        spins_left: balanceRow?.spins_available || 0,
        accumulated_byn: isWholesale
          ? Number(balanceRow?.accumulated_wholesale_byn || 0)
          : Number(balanceRow?.accumulated_retail_byn || 0),
      });
    } catch (error) {
      const knownErrors = new Set([
        "not_enough_spins",
        "no_prizes_configured",
        "no_prizes_available",
        "customer_required",
      ]);
      if (knownErrors.has(error.code)) {
        return res
          .status(400)
          .json({ error: error.code, message: error.message });
      }
      console.error("[wheel] spin failed", error);
      res.status(500).json({ error: "wheel_spin_failed", message: error.message });
    }
  },
);

wheelRouter.get(
  "/api/wheel/my-prizes",
  wheelReadLimiter,
  requireTelegramMiniAppAuth({ allowInsecureFallback: allowInsecureTelegramFallback }),
  (req, res) => {
    try {
      const customer = findCustomerFromAuth(req);
      if (!customer?.id) {
        return res.json({ prizes: [] });
      }
      const status = String(req.query?.status || "all");
      let where = "s.customer_id = ? AND s.rarity_code != 'nothing'";
      if (status === "active") {
        where +=
          " AND s.prize_used_at IS NULL AND (s.promo_valid_until IS NULL OR DATE(s.promo_valid_until) >= DATE('now'))";
      } else if (status === "used") {
        where += " AND s.prize_used_at IS NOT NULL";
      } else if (status === "expired") {
        where +=
          " AND s.prize_used_at IS NULL AND s.promo_valid_until IS NOT NULL AND DATE(s.promo_valid_until) < DATE('now')";
      }

      const rows = db
        .prepare(
          `SELECT s.*, p.title AS prize_title, p.description AS prize_description,
                  p.image_url AS prize_image_url, r.label AS rarity_label,
                  r.bg_color AS rarity_bg, r.text_color AS rarity_text
           FROM wheel_spins s
           JOIN wheel_prizes p ON p.id = s.prize_id
           LEFT JOIN wheel_rarities r ON r.code = s.rarity_code
           WHERE ${where}
           ORDER BY s.spun_at DESC
           LIMIT 100`,
        )
        .all(customer.id);

      res.json({
        prizes: rows.map((row) => ({
          spin_id: row.id,
          prize_title: row.prize_title,
          prize_description: row.prize_description,
          prize_image_url: row.prize_image_url,
          rarity_code: row.rarity_code,
          rarity_label: row.rarity_label,
          rarity_bg: row.rarity_bg,
          rarity_text: row.rarity_text,
          promo_code: row.generated_promo_code,
          promo_valid_until: row.promo_valid_until,
          spun_at: row.spun_at,
          prize_used_at: row.prize_used_at,
          is_epic_release: Boolean(row.is_epic_release),
        })),
      });
    } catch (error) {
      console.error("[wheel] my prizes failed", error);
      res.status(500).json({ error: "wheel_my_prizes_failed", message: error.message });
    }
  },
);

wheelRouter.get(
  "/api/admin/crm/wheel/settings",
  authMiddleware,
  (req, res) => {
    try {
      res.json(getWheelSettings());
    } catch (error) {
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

wheelRouter.put(
  "/api/admin/crm/wheel/settings",
  authMiddleware,
  (req, res) => {
    try {
      // S5: surface validation errors as 400 with details so the CRM
      // can show actionable feedback instead of a generic toast.
      const { errors } = validateWheelSettingsPayload(req.body || {});
      if (errors.length) {
        return res.status(400).json({ error: "validation_failed", details: errors });
      }
      res.json(updateWheelSettings(req.body || {}));
    } catch (error) {
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

// S17: dedicated endpoint for the rarity dictionary so CrmWheel can
// populate the prize-form select even before any prizes exist. Without
// this, the manager could not save the very first prize because the
// rarity dropdown was empty.
wheelRouter.get(
  "/api/admin/crm/wheel/rarities",
  authMiddleware,
  (req, res) => {
    try {
      res.json({ rarities: listRarities() });
    } catch (error) {
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

wheelRouter.get(
  "/api/admin/crm/wheel/prizes",
  authMiddleware,
  (req, res) => {
    try {
      res.json({
        prizes: listAdminPrizes(),
      });
    } catch (error) {
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

wheelRouter.post(
  "/api/admin/crm/wheel/prizes",
  authMiddleware,
  (req, res) => {
    try {
      const { errors } = validatePrizePayload(req.body || {});
      if (errors.length) {
        return res.status(400).json({ error: "validation_failed", details: errors });
      }
      res.json(createPrize(req.body || {}));
    } catch (error) {
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

wheelRouter.put(
  "/api/admin/crm/wheel/prizes/:id",
  authMiddleware,
  (req, res) => {
    try {
      // C3-CR: load the row first so validatePrizePayload can fall back
      // to existing values for fields the partial PATCH didn't touch.
      const existing = db
        .prepare("SELECT * FROM wheel_prizes WHERE id = ?")
        .get(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "not_found" });
      }
      const { errors } = validatePrizePayload(req.body || {}, {
        isUpdate: true,
        existing,
      });
      if (errors.length) {
        return res.status(400).json({ error: "validation_failed", details: errors });
      }
      const updated = updatePrize(req.params.id, req.body || {});
      if (!updated) {
        return res.status(404).json({ error: "not_found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

wheelRouter.delete(
  "/api/admin/crm/wheel/prizes/:id",
  authMiddleware,
  (req, res) => {
    try {
      deletePrize(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

wheelRouter.get(
  "/api/admin/crm/wheel/dashboard",
  authMiddleware,
  (req, res) => {
    try {
      res.json(getAdminDashboard());
    } catch (error) {
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

wheelRouter.get(
  "/api/admin/crm/wheel/spins",
  authMiddleware,
  (req, res) => {
    try {
      const { limit, offset, customer_id, rarity } = req.query || {};
      res.json(
        listAdminSpins({
          limit,
          offset,
          customerId: customer_id || null,
          rarity: rarity || null,
        }),
      );
    } catch (error) {
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);

wheelRouter.post(
  "/api/admin/crm/wheel/recompute-customer/:id",
  authMiddleware,
  (req, res) => {
    try {
      const customerId = String(req.params.id || "").trim();
      if (!customerId) {
        return res.status(400).json({ error: "customer_required" });
      }
      // S10: only delivered orders accrue spins on the wheel. Match the
      // canonical filter so this admin tool replays exactly the same
      // set of orders the live accrual hook would have processed.
      //
      // S6: thanks to the wheel_balance_ledger introduced in B3, this
      // loop is now safely idempotent — replaying delivered orders that
      // have already been ledger-recorded is a no-op. Manager sees
      // accrued_spins = 0 in that case.
      const orders = db
        .prepare(
          `SELECT id FROM orders
           WHERE customer_id = ?
             AND status = 'delivered'
           ORDER BY COALESCE(completed_at, created_at) ASC`,
        )
        .all(customerId);
      let accruedSpins = 0;
      for (const order of orders) {
        const result = accrueWheelSpinsForOrder(order.id);
        if (result.accrued) accruedSpins += Number(result.spins_added || 0);
      }
      const epic = registerCustomerProfitForEpicPools(customerId);
      res.json({ ok: true, accrued_spins: accruedSpins, pools_updated: epic.updated });
    } catch (error) {
      res.status(500).json({ error: "failed", message: error.message });
    }
  },
);
