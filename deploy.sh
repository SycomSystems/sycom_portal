#!/bin/bash
# ============================================================
#  Sycom IT Support Portal — VPS Deployment Script
#  Run as root or sudo user on Ubuntu 22.04 / 24.04
#  Usage: chmod +x deploy.sh && sudo ./deploy.sh
# ============================================================

set -e

APP_DIR="/var/www/sycom-portal"
APP_USER="sycom"
NODE_VERSION="20"
DB_NAME="sycom_portal"
DB_USER="sycom_user"

echo ""
echo "=========================================="
echo "  🚀 Sycom Portal — VPS Setup"
echo "=========================================="
echo ""

# ── 1. System updates ──────────────────────────────────────
echo "📦 Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Install Node.js 20 ──────────────────────────────────
echo "📦 Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# ── 3. Install MariaDB ──────────────────────────────────────
echo "📦 Installing MariaDB..."
apt-get install -y mariadb-server mariadb-client
systemctl enable --now mariadb

echo ""
echo "⚙️  Creating MariaDB database and user..."
read -s -p "Enter new MariaDB password for '${DB_USER}': " DB_PASS
echo ""

mariadb -u root <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
echo "✅ Database '${DB_NAME}' created."

# ── 4. Install PM2 + PNPM ──────────────────────────────────
echo "📦 Installing PM2 and pnpm..."
npm install -g pm2 pnpm

# ── 5. Install Nginx ────────────────────────────────────────
echo "📦 Installing Nginx..."
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable --now nginx

# ── 6. Create app user ──────────────────────────────────────
id -u ${APP_USER} &>/dev/null || useradd -m -s /bin/bash ${APP_USER}

# ── 7. Clone/Copy app ───────────────────────────────────────
echo ""
echo "📁 Setting up application directory..."
mkdir -p ${APP_DIR}
chown -R ${APP_USER}:${APP_USER} ${APP_DIR}

echo ""
echo "=========================================="
echo "  ⚙️  Manual steps required:"
echo "=========================================="
echo ""
echo "1. Copy your project to: ${APP_DIR}"
echo "   scp -r ./sycom-portal/* user@YOUR_VPS:${APP_DIR}/"
echo ""
echo "2. Create .env file:"
echo "   cp ${APP_DIR}/.env.example ${APP_DIR}/.env"
echo "   nano ${APP_DIR}/.env"
echo ""
echo "   Set these values:"
echo "   DATABASE_URL=mysql://${DB_USER}:YOUR_PASS@localhost:3306/${DB_NAME}"
echo "   NEXTAUTH_SECRET=\$(openssl rand -base64 32)"
echo "   NEXTAUTH_URL=https://portal.sycom.sk"
echo "   SMTP_HOST=mail.sycom.sk"
echo "   SMTP_USER=portal@sycom.sk"
echo "   SMTP_PASSWORD=your_smtp_password"
echo ""
echo "3. Install dependencies and build:"
echo "   cd ${APP_DIR}"
echo "   npm install"
echo "   npx prisma generate"
echo "   npx prisma db push"
echo "   npx ts-node --project tsconfig.json prisma/seed.ts"
echo "   npm run build"
echo ""
echo "4. Start with PM2:"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save && pm2 startup"
echo ""
echo "5. Setup Nginx (config created below)"
echo "6. SSL certificate: certbot --nginx -d portal.sycom.sk"
echo ""
