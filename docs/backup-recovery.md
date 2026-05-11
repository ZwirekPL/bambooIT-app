# Backup i odzyskiwanie bazy danych

Wdrożone w ramach **RODO Faza 2.3**. Codzienny zaszyfrowany backup PostgreSQL
do lokalnego wolumenu `./backups` na VPS. Off-site (zewnętrzne S3) zostanie
dodane w osobnym kroku.

## Architektura

```
┌─────────────┐                         ┌──────────────┐
│ cron (02:00)│──▶ pg-backup.sh ──▶ gpg │ /backups/    │
│ in backup   │    (pg_dump)           │ *.dump.gpg   │
│ container   │                         │ (30d retain) │
└─────────────┘                         └──────────────┘
```

- **Container:** `dietetyk_backup` (osobny serwis w `docker-compose.prod.yml`)
- **Obraz:** `alpine:3.20` + `postgresql15-client` + `gnupg`
- **Schedule:** codziennie o 02:00 Europe/Warsaw (`CRON_SCHEDULE=0 2 * * *`)
- **Szyfrowanie:** GPG symmetric AES-256 z passphrase z env `BACKUP_PASSPHRASE`
- **Retention:** 30 dni lokalnie (`BACKUP_RETENTION_DAYS=30`)
- **Format:** `pg_dump --format=custom --compress=6` → `.dump.gpg`
- **Lokalizacja:** `/opt/dietetyk/backups/dietetyk-YYYYMMDDTHHMMSSZ.dump.gpg`

## Pierwsze uruchomienie

### 1. Wygeneruj passphrase

```bash
openssl rand -base64 32
```

Zapisz w **bezpiecznym miejscu** (menedżer haseł). **Utrata hasła = utrata
możliwości odzyskania backupu.**

### 2. Dodaj do `.env.prod` na serwerze

```
BACKUP_PASSPHRASE=<tu wklej passphrase>
```

Opcjonalnie:
```
BACKUP_CRON_SCHEDULE=0 2 * * *        # default
BACKUP_RETENTION_DAYS=30              # default
```

### 3. Zbuduj i uruchom kontener

```bash
cd /opt/dietetyk
docker compose -f docker-compose.prod.yml up -d --build backup
```

### 4. Weryfikacja

```bash
# Sprawdź że kontener chodzi
docker ps | grep dietetyk_backup

# Zobacz logi (powinno pokazać harmonogram i czekać na pierwsze uruchomienie)
docker compose -f docker-compose.prod.yml logs backup

# Uruchom backup RĘCZNIE (pomiń cron, sprawdź że działa)
docker compose -f docker-compose.prod.yml exec backup /usr/local/bin/pg-backup.sh

# Zweryfikuj że plik powstał
ls -lh /opt/dietetyk/backups/
```

## Restore — procedura odzyskiwania danych

### Scenariusz 1: restore z lokalnego backupu

**WAŻNE:** restore nadpisuje dane w bazie. Przed restore zrób backup obecnego
stanu:

```bash
docker compose -f docker-compose.prod.yml exec backup /usr/local/bin/pg-backup.sh
```

#### Krok po kroku

```bash
# 1. Wybierz plik do restore
ls -lh /opt/dietetyk/backups/
# np. dietetyk-20260418T020000Z.dump.gpg

# 2. Restore — passphrase pobierane z env kontenera automatycznie
docker compose -f docker-compose.prod.yml exec backup \
  /usr/local/bin/pg-restore.sh /backups/dietetyk-20260418T020000Z.dump.gpg

# 3. Zrestartuj backend żeby odświeżył pulę połączeń
docker compose -f docker-compose.prod.yml restart backend
```

### Scenariusz 2: restore na świeżym serwerze (disaster recovery)

Jeśli stracisz VPS i musisz odtworzyć wszystko od zera:

1. Postaw nowy VPS z Docker + docker-compose
2. Sklonuj repo: `git clone https://github.com/ZwirekPL/DietetykDEV /opt/dietetyk`
3. Skopiuj plik backupu na nowy serwer (ze swojej kopii lokalnej / po SCP)
   - Umieść go w `/opt/dietetyk/backups/`
4. Skopiuj (lub odtwórz) `.env.prod` z tym samym `ENCRYPTION_KEY` (dla
   zaszyfrowanych danych medycznych) i `BACKUP_PASSPHRASE`
5. Uruchom kontenery: `docker compose -f docker-compose.prod.yml up -d`
6. Po starcie Postgres:
   ```bash
   docker compose -f docker-compose.prod.yml exec backup \
     /usr/local/bin/pg-restore.sh /backups/<plik>.dump.gpg
   ```
7. Zrestartuj backend: `docker compose -f docker-compose.prod.yml restart backend`

**Bez `ENCRYPTION_KEY` z oryginału dane medyczne (`Interview.answers`,
`DietPlan.content`, `DietitianNote.content`) będą nieczytelne — AES-256-GCM
wymaga tego samego klucza.**

### Scenariusz 3: ręczne odszyfrowanie poza Dockerem

Jeśli potrzebujesz wyjąć backup poza serwer (np. do analizy lokalnie):

```bash
# Skopiuj zaszyfrowany plik na lokalny komputer
scp root@31.97.75.190:/opt/dietetyk/backups/dietetyk-XXX.dump.gpg ./

# Odszyfruj (wymaga zainstalowanego gpg)
gpg --batch --decrypt \
    --passphrase '<twoja passphrase>' \
    -o dietetyk.dump \
    dietetyk-XXX.dump.gpg

# Teraz pg_restore do dowolnej instancji Postgres
pg_restore -h localhost -U postgres -d mydb dietetyk.dump
```

## Miesięczna rutyna — test restore

**Rekomendacja:** raz na miesiąc przetestuj że restore faktycznie działa, na
ostatnim backupie. Procedura:

1. Postaw tymczasową bazę test: `docker run --rm -d --name pgtest -p 5433:5432 -e POSTGRES_PASSWORD=test postgres:15-alpine`
2. Skopiuj najnowszy `.dump.gpg` na swój komputer
3. Odszyfruj + `pg_restore` do `pgtest`
4. Sprawdź że tabele i wiersze są obecne (np. `SELECT COUNT(*) FROM "User"`)
5. `docker rm -f pgtest`

Udokumentuj datę testu (np. w pliku `docs/backup-test-log.md` lub komentarzem
do calendara).

## Monitoring

Kontener `dietetyk_backup` loguje wynik każdego backupu do stdout. Można
sprawdzić:

```bash
# Ostatni backup
docker compose -f docker-compose.prod.yml logs backup --tail=50

# Live
docker compose -f docker-compose.prod.yml logs -f backup
```

Jeśli Sentry jest aktywny, nieudane backupy trafią do error loga kontenera →
przydałby się osobny alert (TODO). Na razie: **manualnie sprawdzaj logi co
tydzień**.

## Co nie jest objęte (TODO przy rozwoju)

- **Off-site storage** (Cloudflare R2 / Backblaze B2) — gdy VPS padnie na
  amen, te backupy znikają razem z nim
- **Alerty** (Sentry / email) gdy backup się nie powiedzie
- **Point-in-time recovery** — obecnie tylko snapshoty dobowe. Jeśli
  potrzebujesz odzyskać stan z 14:37, musisz mieć backup WAL + archive mode
  (skomplikowane, nie warto dla MVP)
- **Test-restore automat** — obecnie miesięczny test jest manualny

## Zmiana harmonogramu / retencji

Edytuj `.env.prod`:
```
BACKUP_CRON_SCHEDULE=0 3 * * 0    # co niedzielę o 3:00
BACKUP_RETENTION_DAYS=90          # 90 dni
```
Potem restart kontenera:
```bash
docker compose -f docker-compose.prod.yml up -d backup
```

## Zmiana passphrase

Po zmianie `BACKUP_PASSPHRASE` **stare backupy nie będą się otwierać nowym
hasłem**. Proces:

1. Zrób nowy backup **starym hasłem** (żeby mieć punkt odniesienia)
2. Odszyfruj go stary hasłem, zapisz gdzieś tymczasowo
3. Zmień `BACKUP_PASSPHRASE` w `.env.prod`
4. `docker compose -f docker-compose.prod.yml up -d backup`
5. Uruchom nowy backup nowym hasłem
6. Usuń stare pliki ze starym hasłem (lub zaktualizuj dokumentację żeby
   wiedzieć że te starsze wymagają innego hasła)

W praktyce — **nie zmieniaj passphrase**, chyba że podejrzewasz wyciek.
