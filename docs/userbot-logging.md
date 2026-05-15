# Userbot Structured Event Logging

## Overview

Userbot (`server/userbot/index.js`) logs all key events in a structured JSON format to stdout (PM2 logs). This allows easy filtering, grepping, and debugging across sessions.

Each line is a valid JSON object with at least `ev` (event type) and `ts` (ISO timestamp).

## Quick Filter

```bash
# Last 1000 lines, structured events only
pm2 logs navalivay-userbot --nostream --lines 1000 | grep '{"ev"'

# Real-time stream
pm2 logs navalivay-userbot | grep '{"ev"'

# Filter by event type
pm2 logs navalivay-userbot --nostream --lines 5000 | grep '"ev":"flood"'
pm2 logs navalivay-userbot --nostream --lines 5000 | grep '"ev":"send"'
```

## Event Types

### `send` — Message send attempt/result

```json
{"ev":"send","ts":"2026-05-15T16:51:00.000Z","outcome":"sent","attempt":1,"chat_id":"123456","order_id":"order_abc","msg_id":9876}
{"ev":"send","ts":"2026-05-15T16:51:00.000Z","outcome":"failed","attempt":0,"chat_id":"123456","order_id":"order_abc","error":"entity_not_found_no_dialog"}
{"ev":"send","ts":"2026-05-15T16:51:00.000Z","outcome":"attempt","attempt":2,"chat_id":"123456","order_id":"order_abc"}
{"ev":"send","ts":"2026-05-15T16:51:00.000Z","outcome":"failed","attempt":2,"chat_id":"123456","order_id":"order_abc","error":"..."}
```

| Field | Values | Meaning |
|-------|--------|---------|
| `outcome` | `sent`, `failed`, `attempt` | Result or intermediary step |
| `attempt` | `1`, `2`, `3`, `0` | 1=GramJS cache, 2=stored access_hash, 3=prefetchDialogs, 0=all failed |
| `chat_id` | string | Telegram user ID |
| `order_id` | string or null | Order ID from request |
| `msg_id` | number | Telegram message ID (only on success) |
| `error` | string | Error description (only on failure) |

### `flood` — FloodWait rate limit

```json
{"ev":"flood","ts":"2026-05-15T16:51:00.000Z","chat_id":"123456","seconds":30,"capped":30,"order_id":"order_abc"}
```

| Field | Meaning |
|-------|---------|
| `seconds` | Raw FloodWait seconds from Telegram |
| `capped` | Capped value (`FLOOD_WAIT_CAP_SEC = 1800`) |

When flood hits, `floodWaitUntil` is set globally, blocking ALL `send-message` requests until expiry.

### `blocked` — CRM block prevented send

```json
{"ev":"blocked","ts":"...","chat_id":"123456","order_id":"order_abc"}
```

Fired when the customer has an active CRM block. Userbot returns 403 without sending.

### `resolve` — /resolve-username result

```json
{"ev":"resolve","ts":"...","username":"someuser","outcome":"ok","telegram_id":"123456"}
{"ev":"resolve","ts":"...","username":"someuser","outcome":"not_found"}
```

Currently gated by `RESOLVE_USERNAME_ENABLED = false` — returns 503 immediately.

### `session_dead` — Telegram session invalidated

```json
{"ev":"session_dead","ts":"...","chat_id":"123456","error":"AUTH_KEY_UNREGISTERED"}
```

Session needs to be re-created: delete `data/userbot.session`, re-run login.

### `send_error` — Non-Flood, non-session error in send-message

```json
{"ev":"send_error","ts":"...","chat_id":"123456","error":"...","order_id":"order_abc"}
```

## Send Attempt Chain

The userbot tries 3 ways to find a recipient before giving up:

1. **Attempt 1**: `client.sendMessage(BigInt(chatId))` — entity in GramJS in-memory cache
2. **Attempt 2**: `Api.InputPeerUser` from stored `access_hash` in `userbot_entities` table
3. **Attempt 3**: `prefetchDialogs()` + retry — refreshes dialog cache from Telegram

If all 3 fail: → `entity_not_found_no_dialog` (no dialog exists, message not sent).

Attempt 4 (`contacts.resolveUsername`) was removed — was causing FloodWait cascade that blocked ALL sends.

## Rate Limits

| Guard | Scope | Details |
|-------|-------|---------|
| `floodWaitUntil` | Global (send-message) | Set on any FloodWait from send-message. Blocks all sends until expiry. |
| `RESOLVE_USERNAME_ENABLED` | resolve-username only | `false` until Telegram lifts rate limit on @Rez0nsky (enabled manually). |
| `FLOOD_WAIT_CAP_SEC` | 1800s (30 min) | Caps any FloodWait to prevent multi-hour blocks. |

## Logged in parallel to bot_message_log DB

Events also logged into `bot_message_log` table (via `stmtInsertLog`) with:
- `outcome`: `sent`, `failed`
- `source`: `userbot`
- `via_attempt`: which attempt succeeded (1-3)
- `order_id`, `auto` flags in `meta` JSON

## Frontend event log

Auto-notify skips (`new_customer_no_dialog`, `customer_blocked`, etc.) are logged to `bot_message_log` from `server/utils/auto-notify.js`. The userbot JSON events cover the actual send attempt (after eligibility passes).
