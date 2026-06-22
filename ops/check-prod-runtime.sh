#!/usr/bin/env bash
# Проверка, что production runtime совпадает с docs/DEPLOY_REBUILD_RESTART.md
# (сверено с NavalivayNew 2026-06-22).
#
# Запуск на сервере:
#   ./ops/check-prod-runtime.sh
# Код выхода: 0 = ок, 1 = есть расхождения (удобно для cron / после деплоя).

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

failures=0
warnings=0

fail() {
  echo -e "${RED}FAIL:${NC} $1"
  failures=$((failures + 1))
}

warn() {
  echo -e "${YELLOW}WARN:${NC} $1"
  warnings=$((warnings + 1))
}

ok() {
  echo -e "${GREEN}OK:${NC} $1"
}

port_pid() {
  local port="$1"
  lsof -t -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null | head -1 || true
}

pm2_app_online() {
  local name="$1"
  pm2 jlist 2>/dev/null | python3 -c "
import json, sys
name = sys.argv[1]
try:
    apps = json.load(sys.stdin)
except Exception:
    sys.exit(1)
for app in apps:
    if app.get('name') == name:
        st = app.get('pm2_env', {}).get('status')
        sys.exit(0 if st == 'online' else 1)
sys.exit(1)
" "$name" 2>/dev/null
}

echo "=== NAVALIVAY prod runtime check ==="

# --- API :8082 = systemd navalivay-server ---
if ! systemctl is-active --quiet navalivay-server 2>/dev/null; then
  fail "navalivay-server не active"
else
  ok "navalivay-server active"
fi

main_pid="$(systemctl show navalivay-server -p MainPID --value 2>/dev/null || true)"
listen_pid="$(port_pid 8082)"
if [ -z "$listen_pid" ]; then
  fail "порт 8082 никто не слушает"
elif [ -n "$main_pid" ] && [ "$main_pid" != "0" ] && [ "$listen_pid" = "$main_pid" ]; then
  ok ":8082 владелец PID $listen_pid = systemd MainPID"
else
  fail ":8082 PID=$listen_pid, systemd MainPID=$main_pid (трафик может идти не в тот процесс)"
fi

if curl -fsS -m 3 http://127.0.0.1:8082/api/health >/dev/null 2>&1; then
  ok "GET /api/health на :8082"
else
  fail "GET /api/health на :8082 не отвечает"
fi

poll_code="$(curl -s -o /dev/null -w '%{http_code}' -m 3 http://127.0.0.1:8082/api/admin/crm/orders/poll-summary || echo 000)"
if [ "$poll_code" = "401" ]; then
  ok "poll-summary без токена → 401"
elif [ "$poll_code" = "404" ]; then
  fail "poll-summary → 404 (вероятно старый/не тот API на :8082)"
else
  warn "poll-summary → HTTP $poll_code (ожидали 401)"
fi

# --- PM2: bot + userbot, НЕ api-зомби ---
if command -v pm2 >/dev/null 2>&1; then
  if pm2_app_online navalivay-bot; then
    ok "PM2 navalivay-bot online"
  else
    fail "PM2 navalivay-bot не online (на prod бот в PM2)"
  fi

  if pm2_app_online navalivay-userbot; then
    ok "PM2 navalivay-userbot online"
  else
    fail "PM2 navalivay-userbot не online"
  fi

  if pm2 jlist 2>/dev/null | grep -q '"name":"navalivay-api"'; then
    api_pm2_pid="$(pm2 jlist 2>/dev/null | python3 -c "
import json, sys
for app in json.load(sys.stdin):
    if app.get('name') == 'navalivay-api':
        print(app.get('pid') or '')
        break
" 2>/dev/null || true)"
    if [ -n "$api_pm2_pid" ] && [ "$api_pm2_pid" = "$listen_pid" ]; then
      fail "PM2 navalivay-api слушает :8082 — конфликт с systemd"
    else
      warn "PM2 navalivay-api есть в списке, но :8082 не его (зомби — pm2 delete navalivay-api)"
    fi
  else
    ok "PM2 navalivay-api отсутствует"
  fi
else
  warn "pm2 не найден — пропуск PM2-проверок"
fi

# --- userbot health ---
if curl -fsS -m 3 http://127.0.0.1:8083/health 2>/dev/null | grep -q '"connected":true'; then
  ok "userbot /health connected:true"
else
  fail "userbot :8083 не connected (auto-notify уйдёт в очередь)"
fi

# --- systemd bot unit не должен дублировать PM2 ---
if systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' | grep -qx 'navalivay-bot.service'; then
  if systemctl is-active --quiet navalivay-bot 2>/dev/null; then
    fail "navalivay-bot.service active одновременно с PM2 — риск двух ботов"
  else
    ok "navalivay-bot.service не active (бот только в PM2)"
  fi
fi

echo ""
echo "Итого: failures=$failures warnings=$warnings"
if [ "$failures" -gt 0 ]; then
  exit 1
fi
exit 0