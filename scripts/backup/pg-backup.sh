#!/bin/sh
# Encrypted daily PostgreSQL backup (RODO Phase 2.3).
#
# pg_dump → gpg symmetric (AES-256) → /backups/dietetyk-<timestamp>.dump.gpg
# Prunes files older than RETENTION_DAYS.
#
# Invoked by cron (see entrypoint.sh). Can also be run manually inside the
# backup container:
#   docker compose -f docker-compose.prod.yml exec backup /usr/local/bin/pg-backup.sh

set -eu

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="/backups/dietetyk-${STAMP}.dump.gpg"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

echo "[backup $(date -Iseconds)] starting → ${OUT}"

# pg_dump in custom format (compressed, parallel-restore-capable).
# Pipe directly into gpg so plaintext never touches disk.
pg_dump \
    --host="${PGHOST}" \
    --username="${PGUSER}" \
    --dbname="${PGDATABASE}" \
    --format=custom \
    --compress=6 \
  | gpg \
    --batch --yes \
    --symmetric \
    --cipher-algo AES256 \
    --passphrase "${BACKUP_PASSPHRASE}" \
    --output "${OUT}"

SIZE="$(stat -c %s "${OUT}" 2>/dev/null || echo 0)"
echo "[backup $(date -Iseconds)] complete → ${OUT} (${SIZE} bytes)"

# Prune old backups.
DELETED="$(find /backups -maxdepth 1 -type f -name 'dietetyk-*.dump.gpg' -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)"
echo "[backup $(date -Iseconds)] pruned ${DELETED} files older than ${RETENTION_DAYS} days"
