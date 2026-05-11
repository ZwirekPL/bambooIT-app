# Instrukcja wdrożenia na VPS Hostinger

> Instrukcja dla osoby bez wiedzy technicznej. Czytaj krok po kroku — nie pomijaj żadnego etapu.

---

## Co będziesz potrzebować

- Konto na **Hostinger** (hostinger.pl)
- Zakupiony **VPS** (minimum plan KVM 2 — 2 GB RAM, 2 vCPU, 40 GB dysk)
- Wykupioną **domenę** (np. twoja-domena.pl) — może być w Hostinger lub gdzie indziej
- Około **30–60 minut** wolnego czasu
- Na Windows: pobrany program **PuTTY** (https://www.putty.org/) do połączenia z serwerem
- Na macOS/Linux: wbudowany Terminal

---

## Krok 1 — Zakup VPS na Hostinger

1. Wejdź na **hostinger.pl** → kliknij „VPS" w menu
2. Wybierz plan **KVM 2** (lub wyższy)
3. Wybierz system operacyjny: **Ubuntu 22.04**
4. Dokończ zakup i poczekaj kilka minut na aktywację

Po aktywacji, w panelu Hostinger pojawi się:
- **Adres IP serwera** — np. `123.45.67.89`
- **Hasło root** — zapisz je bezpiecznie!

---

## Krok 2 — Połączenie z serwerem przez SSH

### Na Windows (PuTTY):
1. Otwórz PuTTY
2. W polu **Host Name** wpisz IP swojego serwera, np. `123.45.67.89`
3. Port zostaw `22`
4. Kliknij **Open**
5. Pojawi się czarne okno — wpisz `root` i naciśnij Enter
6. Wpisz hasło (nie widać znaków podczas wpisywania — to normalne) i naciśnij Enter

### Na macOS/Linux (Terminal):
```bash
ssh root@123.45.67.89
```
Wpisz hasło gdy zostaniesz o nie poproszony.

---

## Krok 3 — Aktualizacja systemu i instalacja Docker

Wklej poniższe komendy **jedna po drugiej** i naciśnij Enter po każdej:

```bash
apt update && apt upgrade -y
```
*(To może potrwać 2–5 minut)*

```bash
apt install -y curl git
```

```bash
curl -fsSL https://get.docker.com | sh
```
*(Instalacja Docker — może potrwać 2–3 minuty)*

Sprawdź czy Docker działa:
```bash
docker --version
```
Powinno wyświetlić coś w stylu: `Docker version 27.x.x`

---

## Krok 4 — Konfiguracja klucza SSH (do automatycznego deploy z GitHub)

Wygeneruj klucz SSH na serwerze:
```bash
ssh-keygen -t ed25519 -C "deploy@dietetyk" -f ~/.ssh/deploy_key -N ""
```

Wyświetl **klucz prywatny** (skopiuj całą zawartość — będzie potrzebna w GitHub):
```bash
cat ~/.ssh/deploy_key
```

Dodaj **klucz publiczny** do autoryzowanych kluczy serwera:
```bash
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
```

---

## Krok 5 — Dodanie sekretów do GitHub

1. Wejdź na **github.com** → Twoje repozytorium → **Settings** → **Secrets and variables** → **Actions**
2. Kliknij **New repository secret** i dodaj kolejno:

| Nazwa | Wartość |
|-------|---------|
| `VPS_HOST` | IP Twojego serwera, np. `123.45.67.89` |
| `VPS_USER` | `root` |
| `VPS_PORT` | `22` |
| `VPS_SSH_KEY` | Zawartość pliku `~/.ssh/deploy_key` (klucz prywatny z Kroku 4) |

---

## Krok 6 — Klonowanie repozytorium na serwer

Stwórz folder dla aplikacji:
```bash
mkdir -p /opt/dietetyk
cd /opt/dietetyk
```

Sklonuj repozytorium:
```bash
git clone https://github.com/TWOJE_KONTO/DietetykDEV.git .
```
*(Zamień `TWOJE_KONTO` na nazwę konta GitHub)*

---

## Krok 7 — Konfiguracja zmiennych środowiskowych

Stwórz plik z ustawieniami produkcyjnymi:
```bash
nano /opt/dietetyk/.env.prod
```

Wklej poniższy szablon i **uzupełnij wszystkie wartości**:

```env
# === Baza danych ===
POSTGRES_USER=dietetyk
POSTGRES_PASSWORD=WPISZ_SILNE_HASLO_DO_BAZY
POSTGRES_DB=dietetyk_ai
DATABASE_URL=postgresql://dietetyk:WPISZ_SILNE_HASLO_DO_BAZY@postgres:5432/dietetyk_ai?schema=public

# === Backend ===
PORT=4000
NODE_ENV=production
ENCRYPTION_KEY=WYGENERUJ_64_ZNAKI_HEX
JWT_SECRET=WYGENERUJ_64_ZNAKI_HEX
CORS_ORIGIN=https://TWOJA_DOMENA

# === Frontend ===
NEXT_PUBLIC_API_URL=https://TWOJA_DOMENA/api
AUTH_SECRET=WYGENERUJ_LOSOWY_CIAG_ZNAKOW
AUTH_URL=https://TWOJA_DOMENA
API_URL=http://backend:4000

# === Domena i aplikacja ===
DOMAIN=TWOJA_DOMENA
APP_URL=https://TWOJA_DOMENA

# === n8n ===
N8N_HOST=TWOJA_DOMENA
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=WPISZ_HASLO_DO_N8N
N8N_DB=n8n

# === Email (opcjonalnie — do resetowania haseł) ===
SMTP_HOST=smtp.twojdostawca.pl
SMTP_PORT=587
SMTP_USER=noreply@TWOJA_DOMENA
SMTP_PASS=HASLO_SMTP
SMTP_FROM=DietetykAI <noreply@TWOJA_DOMENA>
```

**Jak wygenerować bezpieczne klucze?** Wpisz:
```bash
openssl rand -hex 32
```
Uruchom to polecenie 2–3 razy i wpisz wyniki jako `ENCRYPTION_KEY`, `JWT_SECRET` itd.

Zapisz plik: naciśnij `Ctrl+X`, potem `Y`, potem `Enter`.

---

## Krok 8 — Pierwsze uruchomienie aplikacji

```bash
cd /opt/dietetyk
docker compose -f docker-compose.prod.yml build
```
*(Budowanie — może potrwać 5–15 minut przy pierwszym uruchomieniu)*

```bash
docker compose -f docker-compose.prod.yml up -d
```

Sprawdź czy wszystko działa:
```bash
docker compose -f docker-compose.prod.yml ps
```

Powinny być widoczne usługi: `postgres`, `redis`, `backend`, `web`, `n8n`, `nginx` — wszystkie ze statusem `Up`.

---

## Krok 9 — Konfiguracja domeny

### W panelu Hostinger (lub u swojego dostawcy domen):
1. Wejdź do zarządzania domeną → **DNS Zone Editor**
2. Dodaj rekord **A**:
   - Nazwa/Host: `@` (lub pusta — dla głównej domeny)
   - Wartość: IP Twojego serwera
   - TTL: 3600
3. Jeśli chcesz też `www.`:
   - Dodaj kolejny rekord A: Host: `www`, Wartość: IP serwera

Poczekaj 5–30 minut na propagację DNS.

---

## Krok 10 — Certyfikat SSL (HTTPS)

Na serwerze zainstaluj Certbot:
```bash
apt install -y certbot
```

Zatrzymaj nginx tymczasowo, pobierz certyfikat:
```bash
docker compose -f docker-compose.prod.yml stop nginx
certbot certonly --standalone -d TWOJA_DOMENA -d www.TWOJA_DOMENA
docker compose -f docker-compose.prod.yml start nginx
```

Edytuj konfigurację nginx — podmień `TWOJA_DOMENA` na prawdziwą domenę:
```bash
nano /opt/dietetyk/nginx/prod.conf
```
Znajdź wszystkie wystąpienia `TWOJA_DOMENA` i zamień na swoją domenę (np. `dietetyk.pl`).

Przeładuj nginx:
```bash
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## Krok 11 — Weryfikacja

Otwórz w przeglądarce:
- `https://TWOJA_DOMENA` — powinna się otworzyć strona główna aplikacji
- `https://TWOJA_DOMENA/api/health` — powinno wyświetlić `{"status":"ok"}`
- `https://TWOJA_DOMENA/n8n/` — panel n8n (logowanie: admin / hasło z .env.prod)

---

## Automatyczne odnawianie certyfikatu SSL

Dodaj do harmonogramu (cron):
```bash
crontab -e
```

Dodaj na końcu pliku:
```
0 3 * * * certbot renew --quiet && docker compose -f /opt/dietetyk/docker-compose.prod.yml exec nginx nginx -s reload
```

Zapisz (`Ctrl+X`, `Y`, `Enter`).

---

## Automatyczny deploy po zmianach kodu

Po skonfigurowaniu GitHub Secrets (Krok 5), każdy push na gałąź `master` spowoduje:
1. GitHub uruchomi testy (CI pipeline)
2. Jeśli testy przejdą — automatycznie wdroży nową wersję na VPS

Możesz też wdrożyć ręcznie: wejdź na GitHub → **Actions** → **Deploy to VPS** → **Run workflow**.

---

## Rozwiązywanie problemów

**Sprawdzenie logów konkretnej usługi:**
```bash
docker compose -f docker-compose.prod.yml logs backend --tail=50
docker compose -f docker-compose.prod.yml logs web --tail=50
```

**Restart usługi:**
```bash
docker compose -f docker-compose.prod.yml restart backend
```

**Restart całej aplikacji:**
```bash
docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d
```

**Sprawdzenie miejsca na dysku:**
```bash
df -h
docker system prune -f   # usuwa nieużywane obrazy
```
