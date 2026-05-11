#!/bin/sh
set -eu

: "${PGHOST:?PGHOST is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"

CRON_SCHEDULE="${CRON_SCHEDULE:-0 2 * * *}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

echo "[backup] Starting backup service"
echo "[backup]   schedule:  ${CRON_SCHEDULE}"
echo "[backup]   retention: ${RETENTION_DAYS} days"
echo "[backup]   target:    ${PGHOST}/${PGDATABASE}"
echo "[backup]   volume:    /backups"

# Export env vars so the cron-invoked shell inherits them.
env | grep -E '^(PG|BACKUP_|RETENTION_)' > /etc/environment

# Write crontab.
{
    echo "SHELL=/bin/sh"
    echo "BASH_ENV=/etc/environment"
    echo "${CRON_SCHEDULE} . /etc/environment; /usr/local/bin/pg-backup.sh >> /var/log/backup.log 2>&1"
} > /etc/crontabs/root

# Ensure log file exists so `tail -F` works even before first run.
mkdir -p /var/log
touch /var/log/backup.log

# Start crond in foreground and stream log to container stdout.
crond -f -l 6 -L /dev/stdout &
CROND_PID=$!
tail -F /var/log/backup.log &

wait "${CROND_PID}"
