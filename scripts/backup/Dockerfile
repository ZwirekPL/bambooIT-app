# Encrypted PostgreSQL backup service (RODO Phase 2.3).
#
# Runs a cron daemon that invokes pg-backup.sh on schedule. Dumps are encrypted
# with AES-256 via GPG (passphrase from BACKUP_PASSPHRASE env var) and written
# to the /backups volume. Old dumps are pruned per RETENTION_DAYS.

FROM alpine:3.20

RUN apk add --no-cache \
    postgresql15-client \
    gnupg \
    coreutils \
    tzdata \
    bash

ENV TZ=Europe/Warsaw
RUN cp /usr/share/zoneinfo/Europe/Warsaw /etc/localtime

COPY pg-backup.sh /usr/local/bin/pg-backup.sh
COPY pg-restore.sh /usr/local/bin/pg-restore.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/pg-backup.sh /usr/local/bin/pg-restore.sh /usr/local/bin/entrypoint.sh

VOLUME ["/backups"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
