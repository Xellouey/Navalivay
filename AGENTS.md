# NAVALIVAY Agent Notes

## Design Reference

Before changing any customer-facing frontend UI, read `docs/frontend-design-reference-for-agents.md`.

That reference applies to the user/customer app only. It does not define the visual language for CRM, admin, or internal backoffice screens.

Use the current implemented customer UI as the canonical source of truth unless the user explicitly provides a newer screenshot or Figma correction.

## Additional Project References

Read these when the task touches the matching area:

- `docs/loyalty-rules.md`
  - customer loyalty rules
  - checkout loyalty UX
  - CRM wording for discounts and bonuses
- `docs/timezone-rules.md`
  - all business date/time logic
  - Minsk timezone rules for frontend and backend
- `docs/prod-hotfix-playbook.md`
  - production investigation and hotfix workflow
  - what is allowed while the customer is actively testing
- `docs/cash-pacing-rules.md`
  - CRM finance module `План пробития`
  - month plan/fact/recalculation rules
  - rounding, current-month additions, daily cash facts
