#!/bin/sh
# Decrypt + restore a PostgreSQL backup created by pg-backup.sh.
#
# Usage (inside backup container):
#   /usr/local/bin/pg-restore.sh /backups/dietetyk-YYYYMMDDTHHMMSSZ.dump.gpg
#
# The target database (PGDATABASE) MUST already exist. This script does NOT
# drop or recreate the database — use pg_restore --clean flag if needed, or
# create a fresh DB first.
#
# WARNING: this replaces data in the target database. Take a backup first.

set -eu

if [ $# -ne 1 ]; then
    echo "Usage: $0 <path-to-dump.gpg>" >&2
    exit 1
fi

INPUT="$1"

: "${PGHOST:?PGHOST is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"

if [ ! -f "${INPUT}" ]; then
    echo "[restore] File not found: ${INPUT}" >&2
    exit 1
fi

echo "[restore] Decrypting ${INPUT} and restoring to ${PGHOST}/${PGDATABASE}"
echo "[restore] WARNING: this will overwrite existing data. Press Ctrl-C within 5s to cancel."
sleep 5

gpg \
    --batch --yes \
    --decrypt \
    --passphrase "${BACKUP_PASSPHRASE}" \
    "${INPUT}" \
  | pg_restore \
    --host="${PGHOST}" \
    --username="${PGUSER}" \
    --dbname="${PGDATABASE}" \
    --no-owner \
    --no-privileges \
    --clean --if-exists

echo "[restore] done"
