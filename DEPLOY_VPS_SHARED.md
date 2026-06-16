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

## 6. Wpięcie `bambooit.pl` do proxy e-dietetyka

### Wariant A — host ma nginx (najczęstszy)
`/etc/nginx/sites-available/bambooit.pl`:
```nginx
server {
    listen 80;
    server_name bambooit.pl www.bambooit.pl;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://bambooit.pl$request_uri; }
}
server {
    listen 443 ssl http2;
    server_name bambooit.pl www.bambooit.pl;
    # certbot dopisze ssl_certificate / ssl_certificate_key

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3001;        # kontener web bambooIT
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_read_timeout 60s;
    }

    # Stripe webhook (gdy włączymy płatności) — bezpośrednio do backendu:
    # location /webhooks/ { proxy_pass http://127.0.0.1:4001; ... }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/bambooit.pl /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d bambooit.pl -d www.bambooit.pl
```

### Wariant B — e-dietetyk na dockerowym nginx/Traefik/Coolify
- **Traefik:** dodaj labels na serwisie `web` (Host(`bambooit.pl`)) i podłącz web
  do sieci Traefika — daj znać, dopiszę labels do compose.
- **Coolify:** dodaj nowy resource „Docker Compose" wskazujący ten plik, domenę
  `bambooit.pl`, Coolify ogarnie routing+SSL sam (wtedy pomijamy nginx hosta).

> Powiedz mi co pokazał krok 0, a dopiszę dokładny wariant.

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
