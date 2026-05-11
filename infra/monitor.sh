#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  DietetykAI — Health Monitor Script                                          ║
# ║  Run every 5 min via cron. Restarts unhealthy services automatically.        ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
set -uo pipefail

APP_DIR="/opt/dietetyk"
COMPOSE="docker compose -f $APP_DIR/docker-compose.prod.yml"
LOG_PREFIX="[monitor] $(date '+%Y-%m-%d %H:%M:%S')"

# Optional: SMTP notification (set in .env.prod or here)
ALERT_EMAIL="${ALERT_EMAIL:-}"

send_alert() {
  local subject="$1"
  local body="$2"
  echo "$LOG_PREFIX ALERT: $subject"

  if [[ -n "$ALERT_EMAIL" ]] && command -v mail &> /dev/null; then
    echo "$body" | mail -s "[DietetykAI] $subject" "$ALERT_EMAIL"
  fi
}

check_container() {
  local name="$1"
  local status
  status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "not_found")

  case "$status" in
    healthy)
      return 0
      ;;
    unhealthy)
      echo "$LOG_PREFIX $name is UNHEALTHY — restarting..."
      $COMPOSE restart "$name"
      send_alert "$name unhealthy — restarted" "Container $name was unhealthy and has been restarted on $(hostname)"
      return 1
      ;;
    starting)
      echo "$LOG_PREFIX $name is still starting..."
      return 0
      ;;
    *)
      echo "$LOG_PREFIX $name status: $status"
      return 1
      ;;
  esac
}

# Check backend health via HTTP (most critical service)
check_backend_http() {
  local response
  response=$(wget -qO- --timeout=5 http://localhost:4000/health 2>/dev/null || echo "FAIL")

  if echo "$response" | grep -q "OK"; then
    return 0
  else
    echo "$LOG_PREFIX Backend HTTP health check FAILED"
    send_alert "Backend API down" "GET /health returned: $response"
    return 1
  fi
}

# Check disk usage
check_disk() {
  local usage
  usage=$(df / | tail -1 | awk '{print $5}' | tr -d '%')

  if [[ $usage -gt 90 ]]; then
    send_alert "Disk usage critical: ${usage}%" "Server $(hostname) disk is at ${usage}%"
    echo "$LOG_PREFIX WARNING: Disk usage at ${usage}%"
  fi
}

# Check memory
check_memory() {
  local available
  available=$(free -m | awk '/^Mem:/{print $7}')

  if [[ $available -lt 200 ]]; then
    send_alert "Low memory: ${available}MB available" "Server $(hostname) has only ${available}MB free RAM"
    echo "$LOG_PREFIX WARNING: Only ${available}MB RAM available"
  fi
}

# ── Run checks ────────────────────────────────────────────────────────────────
ERRORS=0

check_container "dietetyk_postgres"  || ((ERRORS++))
check_container "dietetyk_redis"     || ((ERRORS++))
check_container "dietetyk_backend"   || ((ERRORS++))
check_container "dietetyk_web"       || ((ERRORS++))
check_backend_http                   || ((ERRORS++))
check_disk
check_memory

if [[ $ERRORS -eq 0 ]]; then
  echo "$LOG_PREFIX All services healthy"
else
  echo "$LOG_PREFIX $ERRORS issue(s) detected"
fi
