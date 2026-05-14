# Jak uruchomić bambooIT na serwerze — instrukcja krok po kroku

> **Status:** Draft prepared during BE-4. Wymaga przetestowania na żywym VPS (BE-5).
> Niektóre kroki mogą wymagać korekty po pierwszym deploy'u.

Instrukcja prowadzi przez deploy bambooIT na VPS Ubuntu 24.04 z Nginx jako reverse proxy i PM2 do zarządzania procesami Node.js. Każdy krok to gotowa komenda do skopiowania.

---

## 1. Co będziesz potrzebować

| Co | Gdzie | Uwagi |
|----|-------|-------|
| **VPS** | Hostinger / OVH / Hetzner / DigitalOcean | Min. 2 GB RAM, Ubuntu 22.04+ |
| **Domena** | Dowolny rejestrator | `bambooit.pl` (per CLAUDE.md) |
| **Konto Stripe** | [stripe.com](https://stripe.com) | Sekret klucza, publishable key, webhook secret, 3 Price IDs |
| **SMTP** | Mailtrap (dev) / Postmark / Resend (prod) | Hostowanie maili transakcyjnych |
| **Sentry** | [sentry.io](https://sentry.io) | DSN dla web + backend (osobne projekty) |
| **Konto GitHub** | github.com | Repo `bambooIT` (prywatne) |
| **SSH klient** | Termius / wbudowany terminal | Połączenie z VPS |

---

## 2. Pierwsze kroki na VPS

### 2.1 Połączenie SSH
```bash
ssh root@<TWÓJ_VPS_IP>
```

### 2.2 Stwórz dedykowanego usera (NIE root do appki)
```bash
adduser bambooit
usermod -aG sudo bambooit
# Klucz SSH dla nowego usera:
rsync --archive --chown=bambooit:bambooit ~/.ssh /home/bambooit
```

### 2.3 Zaktualizuj system
```bash
apt update && apt upgrade -y
```

### 2.4 Zainstaluj Node.js 22, nginx, PostgreSQL, Redis, git, certbot
```bash
# Node.js 22 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Reszta
apt install -y nginx postgresql postgresql-contrib redis-server git certbot python3-certbot-nginx
```

### 2.5 PM2 globally
```bash
npm install -g pm2
```

---

## 3. PostgreSQL — osobna baza dla bambooIT

VPS współdzielony z e-dietetyk (ADR-003). Osobny user, osobna baza.

```bash
sudo -u postgres psql
```

```sql
CREATE USER bambooit_user WITH PASSWORD 'PRZYZNAJ_SILNE_HASLO';
CREATE DATABASE bambooit_prod OWNER bambooit_user;
GRANT ALL PRIVILEGES ON DATABASE bambooit_prod TO bambooit_user;
\q
```

Verify connection:
```bash
psql -h localhost -U bambooit_user -d bambooit_prod -c '\dt'
# (powinna być pusta — migracje wgramy dalej)
```

---

## 4. Klonowanie repo

```bash
su - bambooit
cd ~
git clone git@github.com:<USERNAME>/bambooIT.git
cd bambooIT
npm ci
```

---

## 5. Zmienne środowiskowe

Backend `apps/backend/.env`:
```bash
cp apps/backend/.env.example apps/backend/.env
nano apps/backend/.env
```

Wypełnij:
```ini
# Database
DATABASE_URL=postgresql://bambooit_user:HASLO@localhost:5432/bambooit_prod?schema=public

# JWT (min 32 chars)
JWT_SECRET=WYGENERUJ_SILNY_SEKRET_64_CHARS

# App URLs
APP_URL=https://bambooit.pl
CORS_ORIGIN=https://bambooit.pl
PORT=4001                                  # 4000 zajęty przez e-dietetyk

# Encryption (32 bytes hex)
ENCRYPTION_KEY=WYGENERUJ_32_BYTE_HEX

# Redis (współdzielony, klucze prefix-owane "bambooit:")
REDIS_URL=redis://localhost:6379/1         # osobna baza Redis

# SMTP (Mailtrap dev / prod email)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=bambooIT <hello@bambooit.pl>
NOTIFICATIONS_TO_EMAIL=hello@bambooit.pl

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_START=price_...
STRIPE_PRICE_FIRMA=price_...
STRIPE_PRICE_FIRMA_PLUS=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Sentry
SENTRY_DSN=https://...@sentry.io/...
NODE_ENV=production
```

Frontend `apps/web/.env.production`:
```bash
cp apps/web/.env.example apps/web/.env.production
nano apps/web/.env.production
```

```ini
NEXT_PUBLIC_API_URL=https://bambooit.pl
API_URL=http://localhost:4001
NEXTAUTH_URL=https://bambooit.pl
NEXTAUTH_SECRET=WYGENERUJ_SILNY_SEKRET
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=...
```

---

## 6. Build + migracje

```bash
cd ~/bambooIT

# Generate Prisma client + build database package
npm run generate --workspace=database
npm run build --workspace=database

# Apply migrations to production DB
npx --workspace=database prisma migrate deploy

# Build backend
npm run build --workspace=backend

# Build frontend (production)
npm run build --workspace=web
```

---

## 7. PM2 — uruchamianie procesów

Stwórz `ecosystem.config.cjs` w root:
```bash
nano ecosystem.config.cjs
```

```javascript
module.exports = {
  apps: [
    {
      name: 'bambooit-backend',
      cwd: '/home/bambooit/bambooIT/apps/backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: '/home/bambooit/logs/backend-error.log',
      out_file: '/home/bambooit/logs/backend-out.log',
      time: true,
    },
    {
      name: 'bambooit-web',
      cwd: '/home/bambooit/bambooIT/apps/web',
      script: 'npm',
      args: 'start',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production', PORT: '3001' },
      error_file: '/home/bambooit/logs/web-error.log',
      out_file: '/home/bambooit/logs/web-out.log',
      time: true,
    },
  ],
};
```

Stwórz katalog logów + start:
```bash
mkdir -p ~/logs
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u bambooit --hp /home/bambooit
```

Sprawdź:
```bash
pm2 status
pm2 logs bambooit-backend --lines 30
```

---

## 8. Nginx reverse proxy

`/etc/nginx/sites-available/bambooit.pl`:
```nginx
# Redirect HTTP → HTTPS (certbot doda po SSL)
server {
    listen 80;
    server_name bambooit.pl www.bambooit.pl;
    return 301 https://bambooit.pl$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.bambooit.pl;
    # SSL certs filled by certbot
    return 301 https://bambooit.pl$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bambooit.pl;

    # SSL certs filled by certbot

    # Stripe webhook — raw body, no JSON parsing
    location /webhooks/ {
        proxy_pass http://localhost:4001/webhooks/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # API routes proxied to backend
    location ~ ^/(auth|users|profile|admin|checkout|orders|subscriptions|posts|testimonials|referrals|leads|health) {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_read_timeout 60s;
    }

    # Everything else → Next.js
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_read_timeout 60s;
    }

    # Static caching for /public
    location ~* \.(jpg|jpeg|png|gif|svg|webp|ico|css|js|woff2)$ {
        proxy_pass http://localhost:3001;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    client_max_body_size 10M;
}
```

Aktywacja:
```bash
sudo ln -s /etc/nginx/sites-available/bambooit.pl /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. SSL z Let's Encrypt

DNS musi już wskazywać na VPS (A record `bambooit.pl` + `www.bambooit.pl` → IP VPS):
```bash
sudo certbot --nginx -d bambooit.pl -d www.bambooit.pl
```

Certbot zmodyfikuje config Nginx automatycznie. Verify:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Auto-renewal (cron przez certbot):
```bash
sudo certbot renew --dry-run
```

---

## 10. Stripe webhook

W Stripe Dashboard → Webhooks → Add endpoint:
- URL: `https://bambooit.pl/webhooks`
- Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`

Skopiuj `Signing secret` → wklej do `STRIPE_WEBHOOK_SECRET` w `apps/backend/.env`.

Restart backend:
```bash
pm2 restart bambooit-backend
```

---

## 11. Verify smoke test

Z VPS:
```bash
curl https://bambooit.pl/health
# → {"status":"ok"}

curl -X POST https://bambooit.pl/leads/contact -H "content-type: application/json" -d '{"name":"Test","email":"test@example.com","message":"Test message ok","rodo":true}'
# → {"ok":true,"leadId":"..."}
```

W przeglądarce:
- `https://bambooit.pl` — strona główna ładuje się
- `https://bambooit.pl/pakiety` — pricing widoczny
- `https://bambooit.pl/audyt` — formularz submit działa
- `https://bambooit.pl/zaloguj` — formularz, rejestracja → faktyczne konto w DB

---

## 12. Automated deploy (BE-5)

Po pierwszym manual deploy, dodaj `.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  workflow_run:
    workflows: ['CI']
    types: [completed]
    branches: [main]

jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - name: SSH deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: bambooit
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd ~/bambooIT
            git pull origin main
            npm ci
            npm run generate --workspace=database
            npm run build --workspace=database
            npx --workspace=database prisma migrate deploy
            npm run build --workspace=backend
            npm run build --workspace=web
            pm2 reload ecosystem.config.cjs
```

Sekrety w GitHub repo Settings → Secrets:
- `VPS_HOST` — IP serwera
- `VPS_SSH_KEY` — prywatny klucz SSH dla user `bambooit`

---

## 13. Monitoring + alerty

### Sentry
DSN-y już w `.env`. Pierwsze błędy pojawią się w Sentry dashboard w ciągu kilku minut po deploy.

### Healthcheck endpoint
`https://bambooit.pl/health/db` zwraca status DB. Dodaj uptime monitor (np. BetterStack / UptimeRobot / Pingdom) — alert email/SMS przy 502.

### Logi PM2
```bash
pm2 logs --lines 100      # ostatnie 100 linii obu apps
pm2 logs bambooit-backend  # tylko backend
```

Rotacja logów:
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 14. Backup

### Database
Cron job (jako `bambooit` user):
```bash
crontab -e
```

```cron
# Codzienny backup o 3:00 (rotacja 14 dni)
0 3 * * * pg_dump -h localhost -U bambooit_user bambooit_prod | gzip > ~/backups/bambooit_$(date +\%Y\%m\%d).sql.gz && find ~/backups -name "bambooit_*.sql.gz" -mtime +14 -delete
```

Test restore (na osobnej bazie):
```bash
gunzip -c ~/backups/bambooit_20260514.sql.gz | psql -h localhost -U bambooit_user -d bambooit_test
```

---

## 15. Co dalej

Po pierwszym successful deploy:
1. Cron job: `npx --workspace=database prisma generate` po każdym `git pull` (jeśli automated deploy)
2. Pre-launch checklist:
   - [ ] Test rejestracji końcówka-do-końcówki
   - [ ] Test Stripe Checkout w trybie test mode → flip do live
   - [ ] Test cookie banner → sprawdź czy zapisuje do DB
   - [ ] Test maili (rejestracja, reset hasła, subscription welcome)
   - [ ] Sprawdź Sentry — jakieś errory po pierwszej godzinie?
   - [ ] Lighthouse audit z prod URL (powinno wycelować w 90+)
3. Pierwszy klient — Remigiusz uruchamia outreach

---

## Troubleshooting

### Backend startup failed: "Missing DATABASE_URL"
Sprawdź `apps/backend/.env` — czy wszystko wpisane. PM2 musi widzieć `.env`:
```bash
pm2 restart bambooit-backend --update-env
```

### Nginx 502 Bad Gateway
Backend lub frontend nie działa. Sprawdź:
```bash
pm2 status
pm2 logs --err --lines 50
```

### Stripe webhook 400 — INVALID_SIGNATURE
Webhook secret nie zgadza się. Sprawdź:
1. Stripe Dashboard → Webhooks → kopia signing secret
2. `STRIPE_WEBHOOK_SECRET` w `apps/backend/.env`
3. `pm2 restart bambooit-backend --update-env`

### Prisma migrate deploy fails
Sprawdź `DATABASE_URL` + uprawnienia user:
```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bambooit_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bambooit_user;
```

---

*Ten dokument jest draftem. Aktualizuj w trakcie pierwszego deploy — każdy "tu się zacięło" → zapisz krok jak go naprawiłeś.*
