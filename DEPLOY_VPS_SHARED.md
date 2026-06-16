# Deploy bambooIT — VPS współdzielony z e-dietetyk (Docker + GitHub Actions)

> **Model:** bambooIT to samodzielny stack Docker (własne `postgres`, `redis`,
> `backend`, `web`, `backup`). Pełna izolacja od e-dietetyka — osobne kontenery,
> osobne wolumeny, **bez publikowania portów Postgresa/Redisa na hoście**.
> Deploy uruchamia **GitHub Actions** przez klucz SSH z Secrets — nikt nie musi
> dawać interaktywnego dostępu SSH.
>
> **Jedyny punkt styku z e-dietetykiem:** jego istniejący reverse-proxy (ten, co
> trzyma porty 80/443) musi przekierować `bambooit.pl → 127.0.0.1:3001`.
> Kontener `nginx` bambooIT jest **wyłączony** (profil `standalone-proxy`), żeby
> nie walczyć o 80/443.

```
Internet ─443─▶ [proxy e-dietetyka :80/:443]
                     │  host: bambooit.pl
                     ▼
              127.0.0.1:3001 ─▶ bambooit_web (Next.js)
                                     │ API_URL=http://backend:4000 (sieć compose)
                                     ▼
                                bambooit_backend ─▶ bambooit_postgres / redis
```

---

## 0. Zanim zaczniesz — wykryj proxy e-dietetyka (na VPS)

```bash
# Kto trzyma porty 80/443?
sudo ss -ltnp '( sport = :80 or sport = :443 )'
# Czy to nginx hosta, dockerowy nginx, Traefik, czy Coolify?
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'
systemctl is-active nginx 2>/dev/null
```

Zapamiętaj wynik — w kroku 6 dopinamy `bambooit.pl` do tego proxy. Sprawdź też,
że porty **3001 i 4001 na 127.0.0.1 są wolne**:

```bash
sudo ss -ltnp '( sport = :3001 or sport = :4001 )'   # powinno nic nie zwrócić
```

---

## 0.5 ⚠️ Bezpieczeństwo e-dietetyka — przeczytaj przed `up`

bambooIT współdzieli host z **produkcyjnym** e-dietetykiem. Te zasady trzymają go
nietkniętym. Każdy krok niżej jest **addytywny** — nic nie modyfikuje kontenerów,
sieci, wolumenów ani bazy e-dietetyka.

**A) RAM — największe ryzyko (OOM-killer).** bambooIT to ~2,2 GB limitów
(postgres 512M + backend 1G + web 512M + redis 192M). Jeśli na hoście braknie
RAM, kernel może ubić **dowolny** kontener — w tym e-dietetyka. **Sprawdź zapas
PRZED `up`:**
```bash
free -h            # ile wolnego RAM + czy jest swap
docker stats --no-stream   # ile zżera e-dietetyk teraz
```
Jeśli wolnego < ~2,5 GB i brak swapu → **NIE odpalaj `up`**, najpierw dodaj swap:
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**B) Porty.** bambooIT publikuje tylko `127.0.0.1:3001/4001` (loopback) — potwierdź,
że są wolne (krok 0). Postgres/Redis bambooIT **nie publikują** portów hosta → zero
kolizji.

**C) Edycja `/opt/dietetyk/nginx/prod.conf` (jedyny dotyk pliku e-dietetyka).**
ZAWSZE:
```bash
sudo cp /opt/dietetyk/nginx/prod.conf /opt/dietetyk/nginx/prod.conf.bak   # backup PRZED edycją
# ...dopisz blok bambooit...
docker exec dietetyk_nginx nginx -t        # JEŚLI BŁĄD → NIE reloaduj, przywróć .bak:
#   sudo cp /opt/dietetyk/nginx/prod.conf.bak /opt/dietetyk/nginx/prod.conf
docker exec dietetyk_nginx nginx -s reload # graceful — e-dietetyk bez przerwy
```
Reload bez `nginx -t` = ZAKAZANE. Błędny config z reloadem ubiłby też e-dietetyka.

**D) Sieć `dietetyk_default`** jest w naszym compose jako `external: true` — compose
**nigdy jej nie tworzy ani nie kasuje**, tylko dopina do niej `bambooit_web`
(addytywnie). `docker compose down` jej nie ruszy.

**E) Nigdy `docker compose down -v`** (skasowałoby wolumeny). Nigdy
`docker system prune -a` (zdjęłoby obrazy e-dietetyka). deploy.yml używa tylko
`docker image prune -f` = wyłącznie obrazy-sieroty (nieużywane), bezpieczne.

**F) Migracje** dotyczą wyłącznie `bambooit_postgres` (osobny kontener/baza) —
nie ma fizycznej drogi do bazy e-dietetyka.

---

## 1. DNS (panel aftermarket.hosting — tam są nameservery bambooit.pl)

Dodaj rekordy A na IP VPS:

```
A   bambooit.pl       <IP_VPS>
A   www.bambooit.pl   <IP_VPS>
```

Sprawdź po propagacji: `dig +short bambooit.pl` → IP VPS.

---

## 2. Repo na VPS (user systemowy bambooIT)

```bash
# jeśli nie ma jeszcze usera (osobny od e-dietetyka):
sudo adduser bambooit && sudo usermod -aG docker bambooit
sudo su - bambooit

git clone git@github.com:ZwirekPL/bambooIT-app.git ~/bambooIT
cd ~/bambooIT
```

---

## 3. Sekrety produkcyjne — `.env.prod` (tylko na VPS, NIE w git)

```bash
cp .env.prod.example .env.prod
# wygeneruj sekrety:
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "AUTH_SECRET=$(openssl rand -base64 32)"
echo "BACKUP_PASSPHRASE=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
nano .env.prod   # wklej powyższe + RESEND_API_KEY (ten sam co dev), reszta już wypełniona
```

Stripe pomijamy (mock mode) — zostaw zakomentowane. `.env.prod` jest w `.gitignore`.

---

## 4. Pierwszy deploy — ręcznie (kontrola pierwszego razu)

```bash
cd ~/bambooIT
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d postgres redis
docker compose -f docker-compose.prod.yml run --rm backend \
  npx prisma migrate deploy --schema /app/packages/database/prisma/schema.prisma
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps     # web+backend = healthy?
```

Konto admina (jednorazowo):
```bash
docker compose -f docker-compose.prod.yml exec backend \
  node -e "require('ts-node/register'); require('/app/scripts/create-admin.ts')" 2>/dev/null \
  || echo "użyj ADMIN_EMAIL/ADMIN_PASSWORD wg scripts/create-admin.ts"
```

Smoke test lokalnie na VPS (zanim wepniemy proxy):
```bash
curl -s http://127.0.0.1:4001/health      # → {"status":"ok"}
curl -sI http://127.0.0.1:3001 | head -1  # → HTTP/1.1 200
```

---

## 5. Klucz deploy + GitHub Secrets (automatyzacja bez SSH dla człowieka)

Na VPS wygeneruj **dedykowany** klucz tylko do deployu:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/bambooit_deploy -N "" -C "github-actions-deploy"
cat ~/.ssh/bambooit_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/bambooit_deploy      # ← skopiuj CAŁY klucz prywatny
```

W GitHub repo → **Settings → Secrets and variables → Actions → New secret**:

| Secret | Wartość |
|---|---|
| `VPS_HOST` | IP VPS |
| `VPS_USERNAME` | `bambooit` |
| `VPS_SSH_KEY` | zawartość `~/.ssh/bambooit_deploy` (klucz **prywatny**) |
| `VPS_APP_DIR` | `/home/bambooit/bambooIT` |
| `VPS_PORT` | (opcjonalnie) port SSH, domyślnie 22 |

Od teraz **push do `main` → CI (build+testy) → `deploy.yml` SSH-uje i robi
`docker compose build/up + migrate`**. Możesz też odpalić ręcznie z zakładki
Actions (workflow_dispatch).

---

## 6. Wpięcie `bambooit.pl` do nginx e-dietetyka (kontener `dietetyk_nginx`)

Ustalone na tym VPS: 80/443 trzyma kontener **`dietetyk_nginx`** (nginx:alpine),
config = host file **`/opt/dietetyk/nginx/prod.conf`**, sieć **`dietetyk_default`**,
certy webrootem (`/var/www/certbot` + `/etc/letsencrypt`). `bambooit_web` jest już
podłączony do `dietetyk_default` (compose), więc nginx widzi go jako
`http://bambooit_web:3000`.

Kanoniczny blok serwera: **`nginx/bambooit-on-dietetyk.conf`** w tym repo.

### 6a. Faza A — HTTP + pobranie certu
```bash
# Dopisz blok HTTP (Faza A) na koniec configu e-dietetyka:
sudo sh -c 'cat /home/bambooit/bambooIT/nginx/bambooit-on-dietetyk.conf >> /opt/dietetyk/nginx/prod.conf'
#  ⚠ wklejasz CAŁY plik; sekcja :443 jest zakomentowana — to OK na ten etap.

# Test składni i reload (NIE psuje e-dietetyka — walidacja przed reloadem):
docker exec dietetyk_nginx nginx -t
docker exec dietetyk_nginx nginx -s reload

# Sprawdź, że bambooit.pl odpowiada po HTTP (DNS musi już wskazywać na VPS):
curl -sI http://bambooit.pl | head -1        # → HTTP/1.1 200 (lub 307 z Next.js)
```

### 6b. Pobranie certu Let's Encrypt (webroot — tak jak e-dietetyk)
```bash
# Jeśli certbot jest na hoście:
sudo certbot certonly --webroot -w /var/www/certbot -d bambooit.pl -d www.bambooit.pl
# Jeśli e-dietetyk używa kontenera certbota — daj znać nazwę, podam wariant.
# Cert ląduje w /etc/letsencrypt (zamontowane do dietetyk_nginx).
```

### 6c. Faza B — włącz HTTPS
W `/opt/dietetyk/nginx/prod.conf` w dopisanym bloku bambooit.pl:
1. odkomentuj sekcję `server { listen 443 ssl ... }`,
2. w bloku `:80` zamień `location / { proxy_pass ... }` na
   `location / { return 301 https://bambooit.pl$request_uri; }`
   (zostaw `location /.well-known/acme-challenge/` dla odnawiania certu).
```bash
docker exec dietetyk_nginx nginx -t
docker exec dietetyk_nginx nginx -s reload
curl -sI https://bambooit.pl | head -1        # → HTTP/2 200
```

> **Uwaga:** `/opt/dietetyk/nginx/prod.conf` należy do e-dietetyka — przy jego
> ewentualnym redeployu blok bambooit.pl może zostać nadpisany. Kanoniczna kopia
> jest w `nginx/bambooit-on-dietetyk.conf` (tego repo) — w razie czego dopnij
> ponownie. (Docelowo można dać `dietetyk_nginx` osobny mount `conf.d/bambooit.conf`
> — wtedy bez ryzyka nadpisania; wymaga jednorazowego recreate kontenera.)

---

## 7. Smoke test po wpięciu domeny

```bash
curl -s https://bambooit.pl/health || curl -sI https://bambooit.pl | head -1
```
W przeglądarce: `https://bambooit.pl`, `/pakiety`, `/audyt` (submit → lead +
mail), `/zaloguj` (logowanie admin/klient), panel klienta, `/admin/zgloszenia`.

---

## 8. Aktualizacje (po pierwszym deployu)
Tylko **`git push` do `main`** → reszta dzieje się sama (CI → deploy.yml).
Ręcznie: Actions → „Deploy" → Run workflow.
