# Deploy Roadmap — DietetykAI

Krok po kroku przygotowanie do produkcji.
Status: IN PROGRESS | Data: 2026-03-17

---

## ETAP 0: Zbieranie danych (POTRZEBNE OD CIEBIE)

| # | Dane | Wartość | Status |
|---|------|---------|--------|
| 1 | Domena | `e-dietetyk.com` | [x] |
| 2 | VPS dostawca + IP | `___` (w trakcie kupowania) | [ ] |
| 3 | SSH port | `22` (domyślny?) | [ ] |
| 4 | SMTP dostawca + dane | `___` | [ ] |
| 5 | Email nadawcy | `___` | [ ] |
| 6 | Stripe mode (test/live) | `___` | [ ] |
| 7 | Stripe klucze (masz?) | `___` | [ ] |
| 8 | OpenAI API key (masz?) | `___` | [ ] |
| 9 | Email konta ADMIN | `___` | [ ] |
| 10 | Hasło konta ADMIN | `___` (min 12 znaków) | [ ] |

---

## ETAP 1: Audyty kodu (PRZED deploymentem)

### 1.1 Security scan
- [ ] Hardcoded secrets scan
- [ ] `npm audit` na wszystkich workspace'ach
- [ ] dangerouslySetInnerHTML — sprawdzenie sanityzacji
- [ ] Raw SQL queries — sprawdzenie injection
- [ ] Auth checks na wszystkich route'ach
- [ ] IDOR — ownership verification
- [ ] Sensitive data w logach

### 1.2 Poprawki kodu (wynikające z audytu)
- [ ] Dodać `app.set('trust proxy', 1)` w server.ts
- [ ] Docker log rotation w docker-compose.prod.yml
- [ ] Healthcheck w web Dockerfile
- [ ] Naprawić znalezione problemy security

### 1.3 Audyt konfiguracji produkcyjnej
- [ ] .env.prod.example completeness — porównać z kodem
- [ ] CORS origin — dokładna domena
- [ ] Cookie flags — httpOnly, secure, sameSite
- [ ] Rate limiter — konfiguracja produkcyjna

---

## ETAP 2: Przygotowanie migracji danych dev → prod

### 2.1 Backup bazy dev (PEŁNY)
```bash
# Na lokalnej maszynie (dev)
docker exec dietetyk_postgres pg_dump -U dietetyk -d dietetyk_ai --format=custom -f /backups/dev-full-backup.dump

# Kopiuj z kontenera na host
docker cp dietetyk_postgres:/backups/dev-full-backup.dump ./backups/dev-full-backup.dump
```

### 2.2 Eksport danych referencyjnych (osobno, bezpieczne do importu na prod)
```bash
# Produkty żywnościowe (6602 rekordów + nutrienty + aminokwasy + bioaktywne + alergeny + flagi)
docker exec dietetyk_postgres pg_dump -U dietetyk -d dietetyk_ai \
  --data-only --table='"CleanProduct"' --table='"CleanProductNutrients"' \
  --table='"CleanProductAminoAcids"' --table='"CleanProductBioactives"' \
  --table='"CleanProductAllergen"' --table='"CleanProductDietFlag"' \
  -f /backups/food-products.sql

# Przepisy
docker exec dietetyk_postgres pg_dump -U dietetyk -d dietetyk_ai \
  --data-only --table='"Recipe"' --table='"RecipeIngredient"' \
  --table='"RecipeNutritionSnapshot"' --table='"RecipeTag"' \
  -f /backups/recipes.sql

# Posty na blogu
docker exec dietetyk_postgres pg_dump -U dietetyk -d dietetyk_ai \
  --data-only --table='"Post"' -f /backups/blog-posts.sql
```

### 2.3 Decyzja: co przenieść na produkcję?

| Dane | Przenieść? | Powód |
|------|-----------|-------|
| Produkty żywnościowe (6602) | TAK | Bazowe dane, miesiące pracy |
| Przepisy | TAK | Zweryfikowane przez dietetyka |
| Reguły kliniczne (101) | SEED | Odpalić seed script (świeże z kodu) |
| Protokoły (20) | SEED | Odpalić seed script |
| Triggery + Konflikty | SEED | Odpalić seed script |
| Posty na blogu | TAK/NIE? | Zależy czy masz treści gotowe |
| Użytkownicy testowi | NIE | Dane testowe |
| Wywiady / Plany diet | NIE | Dane testowe/pacjentów dev |
| Audit logi | NIE | Dane testowe |
| Opinie (testimonials) | NIE? | Zależy czy prawdziwe |
| Zamówienia / Płatności | NIE | Dane testowe Stripe |

### 2.4 Skrypt seed na produkcji (kolejność!)
```bash
# Po uruchomieniu kontenerów i migrate deploy:

# 1. Reguły kliniczne (z kodu — zawsze świeże)
docker exec dietetyk_backend npx ts-node -r tsconfig-paths/register \
  src/policies/seed-rules.ts

# 2. Protokoły żywieniowe
docker exec dietetyk_backend npx ts-node -r tsconfig-paths/register \
  src/policies/seed-protocols.ts

# 3. Triggery (mapowania wywiad → protokół)
docker exec dietetyk_backend npx ts-node -r tsconfig-paths/register \
  src/policies/seed-protocol-triggers.ts

# 4. Konflikty protokołów
docker exec dietetyk_backend npx ts-node -r tsconfig-paths/register \
  src/policies/seed-protocol-conflicts.ts

# 5. Import produktów żywnościowych (z backupu dev LUB z USDA)
# Opcja A: z backupu dev
docker cp ./backups/food-products.sql dietetyk_postgres:/tmp/
docker exec dietetyk_postgres psql -U dietetyk -d dietetyk_ai -f /tmp/food-products.sql

# Opcja B: z USDA (pełny reimport, ~30 min)
docker exec dietetyk_backend npx ts-node -r tsconfig-paths/register \
  src/import/usda-importer.ts /data/SRLegacyFoods.json

# 6. Kategorie cenowe
docker exec dietetyk_backend node ../../scripts/seed-price-categories.js

# 7. Przepisy (z backupu dev)
docker cp ./backups/recipes.sql dietetyk_postgres:/tmp/
docker exec dietetyk_postgres psql -U dietetyk -d dietetyk_ai -f /tmp/recipes.sql

# 8. Blog (opcjonalnie)
docker cp ./backups/blog-posts.sql dietetyk_postgres:/tmp/
docker exec dietetyk_postgres psql -U dietetyk -d dietetyk_ai -f /tmp/blog-posts.sql
```

---

## ETAP 3: Skrypt tworzenia admina

Potrzebny skrypt/endpoint do utworzenia pierwszego konta ADMIN na świeżej bazie.

```bash
# Będzie: scripts/create-admin.ts
# Użycie: ADMIN_EMAIL=admin@domena.pl ADMIN_PASSWORD=... npx ts-node scripts/create-admin.ts
```

---

## ETAP 4: Konfiguracja VPS

### 4.1 Zakup i połączenie
- [ ] VPS kupiony (min 2GB RAM, Ubuntu 22.04/24.04)
- [ ] Domena podpięta (rekord A → IP serwera)
- [ ] SSH połączenie działa

### 4.2 Setup
```bash
ssh root@IP_SERWERA
cd /opt
git clone https://github.com/ZwirekPL/DietetykDEV.git dietetyk
cd dietetyk
sudo bash infra/setup-vps.sh e-dietetyk.com
```

### 4.3 Konfiguracja .env.prod
- [ ] Uzupełnić SMTP dane
- [ ] Uzupełnić Stripe klucze + Price ID
- [ ] Uzupełnić OpenAI key
- [ ] Zweryfikować DOMAIN + URLs
- [ ] Zapisać ENCRYPTION_KEY w bezpiecznym miejscu!

### 4.4 Pierwsze uruchomienie
```bash
cd /opt/dietetyk
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend \
  npx prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma
```

### 4.5 Seed danych (ETAP 2.4)
- [ ] Seed reguł klinicznych
- [ ] Seed protokołów
- [ ] Seed triggerów + konfliktów
- [ ] Import produktów żywnościowych
- [ ] Seed kategorii cenowych
- [ ] Import przepisów
- [ ] Import postów (opcjonalnie)
- [ ] Utworzenie konta ADMIN (ETAP 3)

### 4.6 Stripe webhook
- [ ] Dodać endpoint w Stripe Dashboard
- [ ] Wkleić webhook secret do .env.prod
- [ ] Restart backendu

### 4.7 Smoke test
```bash
bash infra/status.sh
curl https://e-dietetyk.com/api/health
# Test rejestracji, logowania, wywiadu przez przeglądarkę
```

---

## ETAP 5: Po deploy (tydzień 1)

- [ ] Backup offsite (rclone/S3)
- [ ] Monitoring z alertami (email gdy coś padnie)
- [ ] Bundle size optymalizacja
- [ ] Database indexing review
- [ ] Custom 502 error page
- [ ] SSL renewal test
- [ ] Load test (opcjonalnie)

---

## POSTĘP

| Etap | Status | Data |
|------|--------|------|
| 0 — Dane | Domena OK, VPS w trakcie | 2026-03-17 |
| 1.1 — Security scan | DONE | 2026-03-17 |
| 1.2 — Trust proxy + fixes | DONE | 2026-03-17 |
| 1.3 — Config audit | DONE (.env.prod.example → e-dietetyk.com) | 2026-03-17 |
| 2 — Migracja danych | DO ZROBIENIA | |
| 3 — Admin seed script | DONE (scripts/create-admin.ts) | 2026-03-17 |
| 4 — VPS setup | CZEKA na zakup VPS | |
| 5 — Po deploy | DO ZROBIENIA | |

### Wykonane poprawki (2026-03-17):
- [x] `trust proxy` dodany do Express (server.ts)
- [x] Health IDOR endpoint usunięty (/health/patient/:id)
- [x] Health /db — nie ujawnia już liczby userów
- [x] Docker log rotation (json-file, max 10m × 3 pliki)
- [x] Web Dockerfile HEALTHCHECK dodany
- [x] .env.prod.example zaktualizowany na e-dietetyk.com
- [x] nodemailer zaktualizowany 6.10→8.0.2 (CVE fix)
- [x] npm audit: 0 vulnerabilities
- [x] scripts/create-admin.ts — gotowy
- [x] Mobile responsiveness — 27 poprawek (osobny commit)
