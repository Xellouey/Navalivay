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
- `docs/promo-rules.md`
  - promo-code validation and lifecycle
  - gift-by-promo manager flow
  - promo validity model and compatibility rules
- `docs/wholesale-rules.md`
  - wholesale link access and tier logic
  - category group wholesale pricing
  - wholesale storefront and checkout restrictions
- `docs/telegram-mini-app.md`
  - Telegram env vars, `/api/settings`, compact mode, wholesale `t.me` links, bot menu button
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

## Project Memory (migrated from editor configs and cloud-code)

These files document key architectural patterns, subsystems, and development workflows.
They were originally in `.cursor/skills/` and `~/.claude/projects/*/memory/` and have been
copied here so they live with the project, not just in editor configs.

### From .cursor/skills/

- `docs/cursor-skill-crm-orders-board.md`
  - Kanban board: columns, drag-and-drop, manager actions, polling
  - Delivered orders modal with server-side stats and pagination
- `docs/cursor-skill-modal-async-pattern.md`
  - Anti-pattern: modal can't close because loading flag
  - Fix: close modal directly in try block
  - Checklist for new modals
- `docs/cursor-skill-pos-cashier-system.md`
  - Fake CRM: cashier lock screen hides admin login
  - POS sales table with pending/completed status
  - Integration with dashboard statistics
- `docs/cursor-skill-profile-and-tabbar.md`
  - Profile page with Telegram avatar caching
  - Bottom tab bar navigation (4 tabs)
  - Bonus system placeholder slot

### From Claude Code (~/.claude/projects/*/memory/)

- `docs/claude-memory-index.md` — index of Claude feedback rules
- `docs/claude-feedback-code-review-loop.md` — run code-reviewer until 0 violations
- `docs/claude-feedback-ux-improver.md` — run ux-improver after UI changes

## Subsystems

- `docs/userbot-logging.md`
  - Userbot structured JSON event format (`{"ev":"send|flood|resolve|..."}`)
  - Key events: send, flood, blocked, resolve, session_dead
  - How to grep/filter events
  - Rate limits: RESOLVE_USERNAME_ENABLED, floodWaitUntil, FLOOD_WAIT_CAP_SEC
  - Send attempt chain: 1 (cache) → 2 (access_hash) → 3 (prefetch)
  - **ResolveUsername Ban Incident 15.05.2026** — подробно: как случилось, FloodWait-цикл, что сделано, как разбанить

## Read first when starting

- `docs/prod-hotfix-playbook.md` — before any production change
- `docs/userbot-logging.md` — особенно секцию про бан resolveUsername
