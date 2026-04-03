# Promo Rules

## Purpose

This document defines current promo-code behavior across backend, customer checkout, and CRM.

Use it when a task touches:

- promo-code validation
- promo validity periods
- CRM promo management
- gift-by-promo operational flow
- checkout promo UX and wording
- wholesale compatibility

## Source Of Truth

- Backend validation and lifecycle:
  - `server/promo-code-service.js`
- Admin promo CRUD API:
  - `server/routes/promo.js`
- Public promo validation endpoint:
  - `server/routes/public.js` (`POST /api/promo/validate`)
- CRM promo UI:
  - `frontend/src/views/admin/crm/loyalty/PromoCodesTab.vue`
- CRM orders (applied promo hints for staff):
  - `frontend/src/views/admin/crm/CrmOrders.vue`
  - `frontend/src/views/admin/crm/CrmOrderDetail.vue`
- Checkout promo UI:
  - `frontend/src/views/CheckoutView.vue`

## Promo Data Model

Current promo fields include:

- Core:
  - `code`
  - `discount_type` (`fixed` or `percent`)
  - `discount_value`
  - `min_order_amount`
  - `max_uses`
  - `active`
- Text:
  - `customer_description` (customer-facing)
  - `manager_description` (CRM manager-facing instructions)
  - legacy `description` is kept for compatibility
- Gift operations:
  - `has_gift` (`0/1`)
- Validity:
  - new model:
    - `valid_from_date` (`YYYY-MM-DD`)
    - `duration_days` (`null` or `> 0`)
  - legacy model (still supported):
    - `valid_from`
    - `valid_until`

## Validity Rules

### New validity model (preferred)

- Promo starts on `valid_from_date`.
- If `duration_days > 0`, promo ends on:
  - `valid_from_date + duration_days - 1` (inclusive).
- If `duration_days` is `null`, promo is perpetual after start date.
- Business date boundaries are Minsk-based (`Europe/Minsk`).

### Legacy validity model (compatibility)

- If new fields are absent, validation falls back to `valid_from` and `valid_until`.
- Legacy datetime behavior is retained to avoid breaking old promos.

## Validation Rules

- Code must exist and be active.
- Promo must be in active validity window.
- Usage must not exceed `max_uses` (except `0 = unlimited`).
- Order total must satisfy `min_order_amount`.
- Discount:
  - `fixed`: capped by order amount
  - `percent`: `0 < value <= 100`

## Checkout Rules

- Customer sees:
  - discount amount
  - `customer_description` (fallback to legacy `description`)
- Order payload should send `promo_code` only for validated promo state.
- Promo and loyalty cannot be combined in one order.
- Promo codes are disabled in wholesale mode. See `docs/wholesale-rules.md`.
- `POST /api/promo/validate` itself does not receive wholesale context. Final promo blocking in wholesale mode is enforced during order create/modify endpoints.

## CRM Rules

### Promo form

- Use separate fields:
  - `Описание для клиента`
  - `Описание для менеджера`
- Gift toggle:
  - `Есть подарок к заказу`
- Validity UX:
  - `Действует с` (date)
  - `На сколько дней` or `Бессрочно`
  - UI shows computed inclusive end date.

### Orders visibility

- If order promo has `has_gift = 1`, CRM should show a clear visual marker.
- Manager-facing instructions come from `manager_description` (API: `promo_manager_description` on orders).
- The orders board and order detail can show this text whenever it is present (including non-gift promos), as an assembly hint for staff.
- This is an operational hint, not an automated gift-picking subsystem.

## Wording Rules

- Use `Промокод` for promo input block.
- Use `Скидка по промокоду` for checkout summary row with applied promo discount.
- Use `За покупки` for loyalty discount.
- Avoid ambiguous generic `Скидка` if multiple discount sources are visible.

## Migration And Compatibility Notes

- Promo migration adds:
  - `customer_description`
  - `manager_description`
  - `has_gift`
  - `valid_from_date`
  - `duration_days`
- `customer_description` is backfilled from legacy `description` when possible.
- Legacy columns are intentionally preserved during transition.

## Regression Checklist

At minimum verify:

- create/edit regular promo
- create/edit gift promo
- perpetual promo (`duration_days = null`)
- bounded promo (`duration_days > 0`) with inclusive end date
- checkout shows customer description correctly
- CRM order card/detail shows gift marker and manager instructions
- old promos using legacy validity still validate as before
