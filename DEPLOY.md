# Jak uruchomić DietetykAI na serwerze — instrukcja krok po kroku

Instrukcja napisana tak, żebyś mógł ją wykonać nawet bez doświadczenia z serwerami.
Każdy krok to gotowa komenda do skopiowania — nic nie musisz pisać od zera.

---

## Co będziesz potrzebować

Zanim zaczniesz, przygotuj:

| Co | Gdzie to zdobyć | Uwagi |
|----|------------------|-------|
| **VPS (serwer)** | Hostinger, OVH, Hetzner, DigitalOcean | Min. 2 GB RAM, Ubuntu 22.04 lub 24.04 |
| **Domena** | Twój dostawca domen | Np. `dietetyk-ai.pl` |
| **Konto Stripe** | [stripe.com](https://stripe.com) | Do płatności — potrzebne klucze API |
| **Konto OpenAI** | [platform.openai.com](https://platform.openai.com) | Do generowania diet — potrzebny klucz API |
| **Skrzynka email / SMTP** | Twój dostawca lub [mailtrap.io](https://mailtrap.io) | Do wysyłania maili (weryfikacja, reset hasła) |
| **Terminal SSH** | Windows: [Termius](https://termius.com) lub wbudowany terminal | Aby połączyć się z serwerem |

---

## CZĘŚĆ 1: Kupno i przygotowanie serwera

### Krok 1 — Kup VPS

Przykład na Hostinger (podobnie wygląda u innych):
1. Wejdź na stronę hostingu (np. hostinger.pl)
2. Wybierz VPS z minimum **2 GB RAM** i **Ubuntu 22.04** lub **24.04**
3. Po zakupie dostaniesz:
   - **Adres IP** serwera (np. `185.123.45.67`)
   - **Hasło root** (lub klucz SSH)
   - Ewentualnie **port SSH** (domyślnie `22`)

Zapisz te dane — będą potrzebne do połączenia.

### Krok 2 — Podepnij domenę

Wejdź w panel DNS swojej domeny i dodaj rekord:

| Typ | Nazwa | Wartość |
|-----|-------|---------|
| A | @ | `185.123.45.67` ← tu wstaw IP swojego VPS |
| A | www | `185.123.45.67` ← to samo IP |

Po zapisaniu poczekaj do 30 minut — DNS musi się rozpropagować.

**Jak sprawdzić czy działa?** Otwórz terminal na komputerze i wpisz:
```
ping twoja-domena.pl
```
Jeśli odpowiada z IP Twojego serwera — DNS działa.

---

## CZĘŚĆ 2: Pierwsze uruchomienie serwera

### Krok 3 — Połącz się z serwerem

Otwórz terminal (Termius, Windows Terminal, lub PowerShell) i wpisz:

```bash
ssh root@185.123.45.67
```
*(zamień na swoje IP)*

Wpisz hasło gdy zapyta. Po zalogowaniu zobaczysz coś jak:
```
root@vps-12345:~#
```
To znaczy, że jesteś na serwerze. Wszystkie kolejne komendy wpisujesz tutaj.

### Krok 4 — Pobierz kod aplikacji

Skopiuj i wklej te komendy **jedną po drugiej**:

```bash
mkdir -p /opt/dietetyk
```
```bash
cd /opt/dietetyk
```
```bash
git clone https://github.com/TWOJ_USER/DietetykDEV.git .
```
*(zamień `TWOJ_USER` na swój login GitHub)*

Jeśli repo jest prywatne, Git zapyta o login i hasło (użyj Personal Access Token z GitHub).

### Krok 5 — Uruchom automatyczny setup

Ta komenda zainstaluje wszystko co potrzebne:

```bash
sudo bash infra/setup-vps.sh twoja-domena.pl
```
*(zamień `twoja-domena.pl` na swoją domenę)*

**Co ta komenda robi automatycznie:**
- Instaluje Docker (silnik kontenerów)
- Instaluje zabezpieczenia (firewall — blokuje wszystko oprócz portów 80, 443 i SSH)
- Pobiera certyfikat SSL (zielona kłódka w przeglądarce)
- Generuje hasła i klucze szyfrowania
- Ustawia automatyczny backup bazy co noc o 2:00
- Ustawia automatyczne sprawdzanie zdrowia aplikacji co 5 minut

Zajmie to 2-5 minut. Na końcu zobaczysz podsumowanie.

---

## CZĘŚĆ 3: Konfiguracja

### Krok 6 — Uzupełnij dane w pliku konfiguracyjnym

Setup wygenerował plik `.env.prod` z gotowymi hasłami. Musisz ręcznie uzupełnić kilka rzeczy.

Otwórz plik do edycji:
```bash
nano /opt/dietetyk/.env.prod
```

Zobaczysz plik z wieloma liniami. Poruszaj się strzałkami ↑↓. Znajdź i uzupełnij:

**Email (SMTP) — żeby aplikacja mogła wysyłać maile:**
```
SMTP_HOST=smtp.gmail.com          ← adres serwera pocztowego
SMTP_PORT=587                     ← port (587 to standard)
SMTP_USER=twoj@email.com          ← login do poczty
SMTP_PASS=haslo-aplikacji          ← hasło (dla Gmail: "hasło aplikacji")
SMTP_FROM="DietetykAI <twoj@email.com>"
```

**Stripe — żeby działały płatności:**
```
STRIPE_SECRET_KEY=sk_live_...     ← ze Stripe Dashboard → Developers → API keys
STRIPE_WEBHOOK_SECRET=whsec_...   ← uzupełnisz po kroku 10
```

**OpenAI — żeby działało generowanie diet:**
```
OPENAI_API_KEY=sk-...             ← z platform.openai.com → API Keys
```

**Jak zapisać plik w nano:**
1. Naciśnij `Ctrl + O` (litera O, nie zero)
2. Naciśnij `Enter` (potwierdź nazwę pliku)
3. Naciśnij `Ctrl + X` (wyjdź z edytora)

### Krok 7 — Uruchom aplikację

Skopiuj i wklej tę komendę (buduje i uruchamia wszystko):

```bash
cd /opt/dietetyk && docker compose -f docker-compose.prod.yml up -d --build
```

**To potrwa 5-10 minut** przy pierwszym uruchomieniu (pobiera obrazy, kompiluje kod).
Zobaczysz postęp na ekranie. Poczekaj aż się skończy.

### Krok 8 — Uruchom migracje bazy danych

```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma
```

Zobaczysz listę migracji i komunikat o sukcesie.

### Krok 9 — Sprawdź czy wszystko działa

```bash
bash infra/status.sh
```

Powinieneś zobaczyć coś takiego:
```
── Services ──────────────────────────────────
dietetyk_postgres   Up (healthy)
dietetyk_redis      Up (healthy)
dietetyk_backend    Up (healthy)
dietetyk_web        Up (healthy)
dietetyk_nginx      Up

── Health Checks ─────────────────────────────
dietetyk_postgres   healthy
dietetyk_redis      healthy
dietetyk_backend    healthy
dietetyk_web        healthy
```

Jeśli wszystko jest `healthy` — **aplikacja działa!**

Otwórz przeglądarkę i wejdź na:
```
https://twoja-domena.pl
```

Powinieneś zobaczyć stronę DietetykAI z zieloną kłódką SSL.

### Krok 10 — Skonfiguruj Stripe Webhook

Żeby Stripe informował aplikację o płatnościach:

1. Wejdź na [dashboard.stripe.com](https://dashboard.stripe.com)
2. Kliknij: **Developers** → **Webhooks** → **Add endpoint**
3. Wpisz URL: `https://twoja-domena.pl/webhooks/stripe`
4. Kliknij **Select events** i zaznacz:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Kliknij **Add endpoint**
6. Skopiuj **Signing secret** (zaczyna się od `whsec_...`)
7. Wklej go do pliku konfiguracyjnego:
   ```bash
   nano /opt/dietetyk/.env.prod
   ```
   Znajdź linię `STRIPE_WEBHOOK_SECRET=` i wklej za znakiem `=`
8. Zrestartuj backend:
   ```bash
   cd /opt/dietetyk && docker compose -f docker-compose.prod.yml restart backend
   ```

---

## CZĘŚĆ 4: Codzienne zarządzanie

### Sprawdź czy wszystko działa

Wpisujesz jedną komendę i dostajesz pełny raport:
```bash
bash /opt/dietetyk/infra/status.sh
```

### Jeśli coś nie działa — zobacz logi

```bash
bash /opt/dietetyk/infra/logs.sh backend
```
To pokaże logi backendu (gdzie zwykle jest problem). Naciśnij `Ctrl + C` żeby wyjść.

### Restart gdy coś się zawiesi

```bash
cd /opt/dietetyk && docker compose -f docker-compose.prod.yml restart
```

Lub restart konkretnego serwisu:
```bash
cd /opt/dietetyk && docker compose -f docker-compose.prod.yml restart backend
```

### Ręczny backup bazy

Automatyczny działa co noc, ale możesz zrobić ręczny:
```bash
bash /opt/dietetyk/infra/backup.sh
```

---

## CZĘŚĆ 5: Aktualizacja aplikacji

### Sposób 1 — Automatycznie (rekomendowany)

Gdy wypchniesz zmiany na GitHub (`git push`), serwer sam:
1. Pobierze nowy kod
2. Zrobi backup bazy
3. Zbuduje nową wersję
4. Sprawdzi czy działa (smoke test)

Nie musisz nic robić na serwerze.

### Sposób 2 — Ręcznie na serwerze

Jeśli chcesz zaktualizować ręcznie:
```bash
cd /opt/dietetyk
git pull origin master
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma
bash infra/status.sh
```

---

## CZĘŚĆ 6: Gdy coś się zepsuje

### Problem: Strona nie działa po aktualizacji

Cofnij do poprzedniej wersji:
```bash
bash /opt/dietetyk/infra/rollback.sh
```
Skrypt zapyta o potwierdzenie, wpisujesz `y` i Enter.

### Problem: Baza danych uszkodzona

Przywróć z backupu (najpierw sprawdź jakie masz):
```bash
ls /opt/dietetyk-backups/
```
Zobaczysz pliki jak `dietetyk_2026-03-17_0200.sql.gz`. Wybierz najnowszy i przywróć:
```bash
gunzip -c /opt/dietetyk-backups/dietetyk_2026-03-17_0200.sql.gz | docker compose -f /opt/dietetyk/docker-compose.prod.yml exec -T postgres psql -U dietetyk dietetyk_ai
```

### Problem: Nie wiem co jest nie tak

Wyślij mi (do Claude Code) wynik tych dwóch komend:
```bash
bash /opt/dietetyk/infra/status.sh
```
```bash
bash /opt/dietetyk/infra/logs.sh backend 200
```
Skopiuj output i wklej mi — znajdę przyczynę i napiszę fix.

---

## CZĘŚĆ 7: Ważne informacje bezpieczeństwa

### Klucz szyfrowania (`ENCRYPTION_KEY`)

To najważniejszy sekret w całej aplikacji. Szyfruje dane medyczne pacjentów.

**Jeśli go zgubisz — stracisz dostęp do wszystkich zaszyfrowanych danych. Nie da się ich odzyskać.**

Skopiuj go z `.env.prod` i zapisz w bezpiecznym miejscu:
- Menedżer haseł (1Password, Bitwarden)
- Wydrukuj i schowaj w sejfie
- Nigdy nie wysyłaj mailem ani na czacie

### Backupy

- Automatyczne co noc o 2:00
- Przechowywane 14 dni
- Lokalizacja: `/opt/dietetyk-backups/`
- Rozważ kopiowanie backupów na zewnętrzny dysk/chmurę (np. rclone do Google Drive)

### Monitoring

- Co 5 minut skrypt sprawdza czy wszystkie serwisy żyją
- Jeśli coś padnie — automatycznie restartuje
- Logi monitora: `/var/log/dietetyk-monitor.log`

---

## Ściągawka — najczęstsze komendy

| Co chcesz zrobić | Komenda |
|-----------------|---------|
| Połącz się z serwerem | `ssh root@TWOJ_IP` |
| Sprawdź status | `bash /opt/dietetyk/infra/status.sh` |
| Zobacz logi | `bash /opt/dietetyk/infra/logs.sh backend` |
| Restart wszystkiego | `cd /opt/dietetyk && docker compose -f docker-compose.prod.yml restart` |
| Restart backendu | `cd /opt/dietetyk && docker compose -f docker-compose.prod.yml restart backend` |
| Aktualizuj aplikację | `cd /opt/dietetyk && git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| Cofnij aktualizację | `bash /opt/dietetyk/infra/rollback.sh` |
| Zrób backup | `bash /opt/dietetyk/infra/backup.sh` |
| Zobacz backupy | `ls /opt/dietetyk-backups/` |
| Edytuj konfigurację | `nano /opt/dietetyk/.env.prod` |
| Wyłącz wszystko | `cd /opt/dietetyk && docker compose -f docker-compose.prod.yml down` |
| Włącz z powrotem | `cd /opt/dietetyk && docker compose -f docker-compose.prod.yml up -d` |
