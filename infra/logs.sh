#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  DietetykAI — Quick Log Viewer                                               ║
# ║  Usage: bash logs.sh [service] [lines]                                       ║
# ║  Examples: bash logs.sh              — all services, last 100 lines          ║
# ║            bash logs.sh backend      — backend only                          ║
# ║            bash logs.sh backend 500  — backend, last 500 lines               ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

APP_DIR="/opt/dietetyk"
COMPOSE="docker compose -f $APP_DIR/docker-compose.prod.yml"
SERVICE="${1:-}"
LINES="${2:-100}"

if [[ -n "$SERVICE" ]]; then
  $COMPOSE logs --tail="$LINES" -f "$SERVICE"
else
  $COMPOSE logs --tail="$LINES" -f
fi
