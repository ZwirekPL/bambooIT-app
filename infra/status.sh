#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  DietetykAI — Quick Status Dashboard                                         ║
# ║  Shows all services status, health, resources, and recent logs               ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

APP_DIR="/opt/dietetyk"
COMPOSE="docker compose -f $APP_DIR/docker-compose.prod.yml"

echo "════════════════════════════════════════════════════════════"
echo "  DietetykAI — Status Dashboard"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════════════"

echo ""
echo "── Services ──────────────────────────────────────────────"
$COMPOSE ps

echo ""
echo "── Resource Usage ────────────────────────────────────────"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
  dietetyk_backend dietetyk_web dietetyk_postgres dietetyk_redis dietetyk_nginx 2>/dev/null || echo "(some containers not running)"

echo ""
echo "── Disk Usage ────────────────────────────────────────────"
df -h / | tail -1 | awk '{print "  Root: " $3 " used / " $2 " total (" $5 " used)"}'

BACKUP_DIR="/opt/dietetyk-backups"
if [[ -d "$BACKUP_DIR" ]]; then
  BACKUP_COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" 2>/dev/null | wc -l)
  BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
  LAST_BACKUP=$(ls -t "$BACKUP_DIR"/dietetyk_*.sql.gz 2>/dev/null | head -1 | xargs -I{} basename {} 2>/dev/null || echo "none")
  echo "  Backups: $BACKUP_COUNT files ($BACKUP_SIZE), last: $LAST_BACKUP"
fi

echo ""
echo "── Health Checks ─────────────────────────────────────────"
for svc in dietetyk_postgres dietetyk_redis dietetyk_backend dietetyk_web; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "no healthcheck")
  printf "  %-25s %s\n" "$svc" "$STATUS"
done

echo ""
echo "── Git ───────────────────────────────────────────────────"
cd "$APP_DIR" 2>/dev/null && echo "  Branch: $(git branch --show-current)  Commit: $(git log --oneline -1)" || echo "  Not a git repo"

echo ""
echo "── Recent Backend Errors (last 20 lines) ─────────────────"
$COMPOSE logs --tail=20 backend 2>/dev/null | grep -iE "error|ERR|WARN|fail" || echo "  No recent errors"
echo ""
