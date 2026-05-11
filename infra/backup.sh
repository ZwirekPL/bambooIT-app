#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  DietetykAI — PostgreSQL Backup Script                                       ║
# ║  Run daily via cron (setup-vps.sh configures this automatically)             ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
set -euo pipefail

BACKUP_DIR="/opt/dietetyk-backups"
APP_DIR="/opt/dietetyk"
KEEP_DAYS=14
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
BACKUP_FILE="$BACKUP_DIR/dietetyk_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] $(date) — Starting PostgreSQL backup..."

# Dump from running container, compress with gzip
docker compose -f "$APP_DIR/docker-compose.prod.yml" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-dietetyk}" "${POSTGRES_DB:-dietetyk_ai}" \
  --no-owner --clean --if-exists \
  | gzip > "$BACKUP_FILE"

# Verify backup is not empty
if [[ -s "$BACKUP_FILE" ]]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[backup] $(date) — Success: $BACKUP_FILE ($SIZE)"
else
  echo "[backup] $(date) — ERROR: Backup file is empty!"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Rotate: remove backups older than KEEP_DAYS
DELETED=$(find "$BACKUP_DIR" -name "dietetyk_*.sql.gz" -mtime +$KEEP_DAYS -delete -print | wc -l)
if [[ $DELETED -gt 0 ]]; then
  echo "[backup] $(date) — Removed $DELETED old backups (older than ${KEEP_DAYS} days)"
fi

# Show disk usage
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
COUNT=$(find "$BACKUP_DIR" -name "dietetyk_*.sql.gz" | wc -l)
echo "[backup] $(date) — Total: $COUNT backups, $TOTAL_SIZE disk usage"
