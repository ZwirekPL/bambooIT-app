#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  DietetykAI — Quick Rollback Script                                          ║
# ║  Rolls back to previous git commit and restarts services                     ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
set -euo pipefail

APP_DIR="/opt/dietetyk"
COMPOSE="docker compose -f $APP_DIR/docker-compose.prod.yml"

cd "$APP_DIR"

CURRENT=$(git rev-parse --short HEAD)
PREVIOUS=$(git rev-parse --short HEAD~1)

echo "[rollback] Current commit:  $CURRENT"
echo "[rollback] Rolling back to: $PREVIOUS"
echo ""

read -p "Proceed with rollback? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "[rollback] Cancelled."
  exit 0
fi

echo "[rollback] Checking out $PREVIOUS..."
git checkout "$PREVIOUS"

echo "[rollback] Rebuilding and restarting services..."
$COMPOSE build --parallel
$COMPOSE up -d

echo "[rollback] Waiting for health check..."
sleep 10

HEALTH=$(docker exec dietetyk_backend wget -qO- http://localhost:4000/health 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | grep -q "OK"; then
  echo "[rollback] Success! Running on commit $PREVIOUS"
else
  echo "[rollback] WARNING: Health check failed after rollback!"
  echo "[rollback] Check logs: $COMPOSE logs -f backend"
fi

echo ""
echo "To restore to latest: cd $APP_DIR && git checkout master && git pull"
