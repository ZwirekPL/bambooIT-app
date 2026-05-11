# Pre-Deploy Checklist — DietetykAI

Audyty i przygotowania do wykonania przed deploymentem na VPS.
Data utworzenia: 2026-03-17

---

## A. AUDYTY DO PRZEPROWADZENIA

### 1. Audyt bezpieczeństwa (KRYTYCZNY)
- [ ] **Hardcoded secrets scan** — przeszukanie kodu pod kątem wycieków kluczy, haseł, tokenów
- [ ] **Dependency audit** — `npm audit` na wszystkich workspace'ach (znane CVE)
- [ ] **OWASP Top 10 check** — SQL injection (raw queries?), XSS (`dangerouslySetInnerHTML`?), CSRF (middleware), IDOR (ownership checks na wszystkich endpointach)
- [ ] **Rate limiting review** — czy wszystkie wrażliwe endpointy mają limit (login, register, forgot-password, AI generation)
- [ ] **Weryfikacja szyfrowania** — czy wszystkie dane medyczne są faktycznie szyfrowane przed zapisem do DB (Interview.answers, medicalFlags, DietPlan.content, LabPanel.data)

### 2. Audyt wydajności
- [ ] **Next.js bundle analysis** — rozmiar bundli JS, czy nie ciągniemy za dużo do klienta
- [ ] **Prisma N+1 queries** — czy są include/select zamiast lazy loading
- [ ] **Indeksy bazy** — czy pola filtrowane/sortowane mają indeksy (patientId, dietitianId, createdAt, email, status, etc.)
- [ ] **Rozmiar obrazów Docker** — multi-stage build sizes, czy prod images są lean

### 3. Audyt funkcjonalny (smoke test checklist)
- [ ] **Ścieżka krytyczna**: rejestracja → weryfikacja email → logowanie → wywiad → generowanie planu → podgląd planu
- [ ] **Płatności Stripe**: checkout → webhook → aktywacja subskrypcji → dostęp do funkcji
- [ ] **Role**: ADMIN widzi panel admina, DIETITIAN widzi swoich pacjentów, PATIENT widzi tylko swoje dane
- [ ] **Edge cases**: wygasły token, nieprawidłowe hasło, brak połączenia z OpenAI, brak Stripe keys

### 4. Audyt konfiguracji produkcyjnej
- [ ] **Zmienne środowiskowe** — `.env.prod.example` pokrywa WSZYSTKIE env vars wymagane przez kod
- [ ] **CORS** — `CORS_ORIGIN` ustawiony na dokładną domenę (nie `*`)
- [ ] **Cookie flags** — `httpOnly`, `secure`, `sameSite` poprawne na produkcji
- [ ] **Logowanie** — sprawdzić czy nigdzie nie wyciekają dane medyczne/hasła/tokeny do logów

---

## B. DO PRZYGOTOWANIA / NAPRAWIENIA

### Faza 1 — MUST HAVE przed deploymentem

| # | Element | Opis | Status |
|---|---------|------|--------|
| 1 | **Security scan** | Secrets + npm audit + dependency check | [ ] |
| 2 | **Admin seed script** | Pierwszy admin user — jak go stworzyć na fresh DB? Seed script albo CLI command | [ ] |
| 3 | **Seed data** | Reguły kliniczne (101), produkty żywnościowe (6602), protokoły — czy są w migracjach czy trzeba osobny seed? | [ ] |
| 4 | **`trust proxy` w Express** | `app.set('trust proxy', 1)` — żeby rate limiter i IP logging działały za Nginx | [ ] |
| 5 | **Graceful shutdown** | Backend powinien obsługiwać SIGTERM — zamknąć BullMQ workery, Prisma disconnect, zamknąć Express server | [ ] |
| 6 | **Docker log rotation** | Dodać `logging` config w docker-compose.prod.yml (max-size, max-file) | [ ] |
| 7 | **Smoke test lokalnie** | Przetestować `docker-compose.prod.yml` na lokalu przed deployem na VPS | [ ] |

### Faza 2 — W ciągu tygodnia po deploy

| # | Element | Opis | Status |
|---|---------|------|--------|
| 8 | **Backup offsite** | Kopie zapasowe poza VPS (rclone do Google Drive / S3 / Backblaze) | [ ] |
| 9 | **Monitoring z alertami** | Powiadomienia gdy serwis padnie (email/Slack/webhook) — teraz jest tylko cron bez notyfikacji | [ ] |
| 10 | **Bundle size optimization** | `@next/bundle-analyzer`, tree shaking, dynamic imports | [ ] |
| 11 | **Database indexing review** | Dodać indeksy na często filtrowanych polach | [ ] |
| 12 | **Custom 502 error page** | Nginx error_page 502 — teraz pokaże generic nginx HTML | [ ] |
| 13 | **Redis persistence** | Rozważyć `appendonly yes` jeśli cache jest krytyczny | [ ] |
| 14 | **Static asset caching** | Nginx cache dla `/public/` (obrazy, favicony) — teraz cached tylko `/_next/static/` | [ ] |
| 15 | **Web Dockerfile HEALTHCHECK** | Web Dockerfile nie ma HEALTHCHECK (backend ma) | [ ] |
| 16 | **SSL renewal strategy** | Certbot standalone wymaga zatrzymania nginx — rozważyć webroot method | [ ] |
| 17 | **Database connection pooling** | Prisma domyślny connection_limit=5 — na produkcji może być za mało | [ ] |

---

## C. CO JUŻ JEST GOTOWE ✅

- [x] Docker multi-stage builds (backend + web)
- [x] docker-compose.prod.yml z healthcheckami
- [x] Nginx reverse proxy z SSL (TLS 1.2/1.3, HSTS, security headers)
- [x] GitHub Actions CI (lint, type-check, build, unit tests, E2E)
- [x] GitHub Actions deploy (SSH + auto-deploy po CI)
- [x] VPS setup script (infra/setup-vps.sh)
- [x] Backup script (infra/backup.sh) + cron co noc
- [x] Health monitoring (infra/monitor.sh) + cron co 5 min
- [x] Rollback script (infra/rollback.sh)
- [x] Status + logs scripts
- [x] .env.prod.example z komentarzami
- [x] DEPLOY.md instrukcja krok po kroku
- [x] Non-root Docker users
- [x] Firewall (UFW)
- [x] Resource limits na kontenerach (memory)
- [x] Gzip compression w Nginx
- [x] Stripe webhook endpoint w Nginx config

---

## D. NOTATKI

- VPS minimum: 2 GB RAM, Ubuntu 22.04/24.04
- Porty: 80 (HTTP→redirect), 443 (HTTPS), 22 (SSH)
- Kontaktery: postgres:5432, redis:6379, backend:4000, web:3000 — tylko wewnętrzne (expose, nie ports)
- ENCRYPTION_KEY — KRYTYCZNY, zapisać w bezpiecznym miejscu, utrata = utrata danych medycznych
- Backupy: /opt/dietetyk-backups/, retencja 14 dni
