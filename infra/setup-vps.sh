#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  DietetykAI — VPS First-Time Setup Script                                   ║
# ║  Run as root on a fresh Ubuntu 22.04/24.04 VPS                              ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[setup]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err()  { echo -e "${RED}[error]${NC} $1"; exit 1; }

# ── Check root ────────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || err "Run this script as root: sudo bash setup-vps.sh"

DOMAIN="${1:-}"
[[ -n "$DOMAIN" ]] || err "Usage: sudo bash setup-vps.sh <your-domain.com>"

APP_DIR="/opt/dietetyk"
BACKUP_DIR="/opt/dietetyk-backups"

log "Setting up DietetykAI for domain: $DOMAIN"

# ── 1. System updates ────────────────────────────────────────────────────────
log "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Install Docker ────────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  log "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  log "Docker already installed: $(docker --version)"
fi

# ── 3. Install Docker Compose plugin ─────────────────────────────────────────
if ! docker compose version &> /dev/null; then
  log "Installing Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
else
  log "Docker Compose already installed: $(docker compose version)"
fi

# ── 4. Install Certbot ───────────────────────────────────────────────────────
if ! command -v certbot &> /dev/null; then
  log "Installing Certbot for SSL..."
  apt-get install -y -qq certbot
else
  log "Certbot already installed"
fi

# ── 5. Install Git ───────────────────────────────────────────────────────────
apt-get install -y -qq git wget curl jq

# ── 6. Firewall ──────────────────────────────────────────────────────────────
log "Configuring firewall (UFW)..."
apt-get install -y -qq ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable
ufw status

# ── 7. Create app directory ──────────────────────────────────────────────────
log "Creating app directory: $APP_DIR"
mkdir -p "$APP_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p /var/www/certbot

# ── 8. Clone repo (or skip if exists) ────────────────────────────────────────
if [[ -d "$APP_DIR/.git" ]]; then
  log "Repository already cloned at $APP_DIR"
else
  log "Clone the repository manually:"
  echo ""
  echo "  cd $APP_DIR"
  echo "  git clone <your-repo-url> ."
  echo ""
fi

# ── 9. SSL Certificate ───────────────────────────────────────────────────────
if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  log "SSL certificate already exists for $DOMAIN"
else
  log "Obtaining SSL certificate..."
  certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email "admin@$DOMAIN" \
    -d "$DOMAIN" \
    || warn "SSL certificate failed — make sure DNS points to this server first!"
fi

# ── 10. Setup auto-renewal ───────────────────────────────────────────────────
log "Setting up SSL auto-renewal cron..."
(crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * certbot renew --quiet --deploy-hook 'docker restart dietetyk_nginx' >> /var/log/certbot-renew.log 2>&1") | crontab -

# ── 11. Configure nginx domain ───────────────────────────────────────────────
NGINX_CONF="$APP_DIR/nginx/prod.conf"
if [[ -f "$NGINX_CONF" ]]; then
  log "Updating nginx config with domain: $DOMAIN"
  sed -i "s/TWOJA_DOMENA/$DOMAIN/g" "$NGINX_CONF"
else
  warn "nginx/prod.conf not found — configure after cloning the repo"
fi

# ── 12. Setup backup cron ────────────────────────────────────────────────────
log "Setting up daily PostgreSQL backup cron..."
BACKUP_SCRIPT="$APP_DIR/infra/backup.sh"
(crontab -l 2>/dev/null | grep -v backup.sh; echo "0 2 * * * $BACKUP_SCRIPT >> /var/log/dietetyk-backup.log 2>&1") | crontab -

# ── 13. Setup health monitoring cron ─────────────────────────────────────────
log "Setting up health check cron (every 5 min)..."
MONITOR_SCRIPT="$APP_DIR/infra/monitor.sh"
(crontab -l 2>/dev/null | grep -v monitor.sh; echo "*/5 * * * * $MONITOR_SCRIPT >> /var/log/dietetyk-monitor.log 2>&1") | crontab -

# ── 14. Generate secrets ─────────────────────────────────────────────────────
log "Generating secrets..."
ENV_FILE="$APP_DIR/.env.prod"

if [[ -f "$ENV_FILE" ]]; then
  warn ".env.prod already exists — skipping secret generation"
else
  if [[ -f "$APP_DIR/.env.prod.example" ]]; then
    cp "$APP_DIR/.env.prod.example" "$ENV_FILE"

    # Generate random secrets
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    AUTH_SECRET=$(openssl rand -base64 32)
    PG_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)

    sed -i "s|ENCRYPTION_KEY=|ENCRYPTION_KEY=$ENCRYPTION_KEY|" "$ENV_FILE"
    sed -i "s|JWT_SECRET=|JWT_SECRET=$JWT_SECRET|" "$ENV_FILE"
    sed -i "s|AUTH_SECRET=|AUTH_SECRET=$AUTH_SECRET|" "$ENV_FILE"
    sed -i "s|POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD|POSTGRES_PASSWORD=$PG_PASSWORD|" "$ENV_FILE"
    sed -i "s|dietetyk.example.com|$DOMAIN|g" "$ENV_FILE"

    chmod 600 "$ENV_FILE"
    log "Created .env.prod with generated secrets (edit remaining values manually)"
  else
    warn ".env.prod.example not found — create .env.prod manually from the template"
  fi
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  VPS setup complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Clone the repo:  cd $APP_DIR && git clone <url> ."
echo "  2. Edit .env.prod:  nano $APP_DIR/.env.prod"
echo "     - Set SMTP credentials"
echo "     - Set Stripe keys"
echo "     - Set OpenAI API key"
echo "     - Verify DOMAIN and URLs"
echo "  3. Deploy:          cd $APP_DIR && docker compose -f docker-compose.prod.yml up -d --build"
echo "  4. Run migrations:  docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy"
echo "  5. Verify:          curl https://$DOMAIN/api/health"
echo ""
echo "Useful commands:"
echo "  Logs:     docker compose -f docker-compose.prod.yml logs -f"
echo "  Backend:  docker compose -f docker-compose.prod.yml logs -f backend"
echo "  Restart:  docker compose -f docker-compose.prod.yml restart"
echo "  Stop:     docker compose -f docker-compose.prod.yml down"
echo ""
