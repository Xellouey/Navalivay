# Loyalty Rules

## Purpose

This document defines the current loyalty behavior across the customer app, CRM, and backend-facing UI assumptions.

Promo-specific behavior is documented in:

- `docs/promo-rules.md`

Use it when a task touches:

- checkout loyalty application
- bonus accrual
- loyalty discount display
- CRM wording around order discounts

## Core Business Rules

- Loyalty categories are currently separated into:
  - `liquids`
  - `disposables`
  - `devices`
- The customer can earn bonuses independently in each category.
- One order can apply at most one loyalty bonus per category.
- A loyalty bonus never auto-applies.
- Loyalty application is always an explicit customer action.
- If a promo code is active on the order, loyalty bonuses are blocked for that order.

## Checkout UX Rules

- Do not represent bonus usage as `шт.` or quantity selection when the real rule is binary.
- In checkout, use a direct CTA such as `Применить`.
- After applying a bonus to one product in a category:
  - that product may show `Применено`
  - other products in the same category must not show another active apply button
- If a category has no available bonus, show progress/state copy instead of disabled fake controls.
- The UI must match the business rule exactly. Do not allow the user to think they can apply two bonuses in one category within one order.

## Wording Rules

Use consistent labels:

- `Промокод`
  - promo-code discount on the order
- `За покупки`
  - loyalty discount earned from the purchase system
- `На заказ`
  - order-level discount that is not the loyalty discount

Avoid ambiguous labels such as:

- `Покупки` without context
- generic `Скидка`, if there is more than one discount source visible nearby

## CRM Display Rules

When multiple discount sources are visible in CRM:

- separate loyalty discount from order-level discount
- do not show one total discount line plus a second loyalty line if that reads like the same money was subtracted twice
- use one visual pattern for all discount rows in the same card

## Order Editing / Cancellation Expectations

The validated expectation for the current system is:

- issued/delivered orders affect dashboards and cash summaries
- payment cancellation should remove the order from delivered-day summaries
- stock returns only after order cancellation, not merely after payment deletion
- loyalty behavior around cancellation must be checked separately when tasks touch earned bonuses

If a task changes these rules, update this document.
