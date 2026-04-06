# Sycom IT Support Portal

Full-stack IT support portal pre Sycom s.r.o.
**Stack:** Next.js 14 · MariaDB · Prisma · NextAuth · Tailwind CSS · PM2 · Nginx

---

## 🚀 Rýchly štart — lokálny vývoj

### 1. Požiadavky
- Node.js 20+
- MariaDB 10.6+

### 2. Inštalácia

```bash
# Nainštalujte závislosti
npm install

# Skopírujte a upravte .env
cp .env.example .env
# → Upravte DATABASE_URL, NEXTAUTH_SECRET, SMTP nastavenia

# Vygenerujte Prisma klienta
npx prisma generate

# Vytvorte tabuľky v databáze
npx prisma db push

# Naplňte databázu testovacími dátami
npx ts-node --project tsconfig.json prisma/seed.ts

# Spustite vývojový server
npm run dev
```

Portál bude dostupný na: http://localhost:3000

### 3. Testovacie prihlasovacie údaje

| Rola   | Email                    | Heslo              |
|--------|--------------------------|--------------------|
| Admin  | admin@sycom.sk           | Admin@Sycom2024!   |
| Agent  | marek.kovac@sycom.sk     | Agent@Sycom2024!   |
| Klient | jan.novak@firma.sk       | Client@2024!       |

---

## 🖥️ Produkčné nasadenie (VPS)

### 1. Príprava servera

```bash
# Aktualizujte server
sudo apt update && sudo apt upgrade -y

# Nainštalujte Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Nainštalujte MariaDB
sudo apt install -y mariadb-server
sudo systemctl enable --now mariadb
sudo mysql_secure_installation

# Nainštalujte Nginx
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx

# Nainštalujte PM2
sudo npm install -g pm2
```

### 2. Databáza

```sql
-- Prihláste sa do MariaDB
sudo mariadb -u root

-- Vytvorte databázu a používateľa
CREATE DATABASE sycom_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sycom_user'@'localhost' IDENTIFIED BY 'SILNE_HESLO';
GRANT ALL PRIVILEGES ON sycom_portal.* TO 'sycom_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Nasadenie aplikácie

```bash
# Vytvorte priečinok
sudo mkdir -p /var/www/sycom-portal
sudo mkdir -p /var/log/sycom-portal

# Skopírujte projekt na server
scp -r ./sycom-portal/* user@VPS_IP:/var/www/sycom-portal/

# Prihláste sa na server
ssh user@VPS_IP
cd /var/www/sycom-portal

# Nastavte .env
cp .env.example .env
nano .env    # ← upravte všetky hodnoty!

# Vygenerujte NEXTAUTH_SECRET
openssl rand -base64 32   # ← skopírujte výstup do .env

# Inštalujte závislosti a zostavte
npm install
npx prisma generate
npx prisma db push
npx ts-node --project tsconfig.json prisma/seed.ts
npm run build

# Spustite s PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # ← spustite zobrazený príkaz
```

### 4. Nginx

```bash
# Skopírujte konfiguráciu
sudo cp sycom-portal.nginx /etc/nginx/sites-available/sycom-portal
sudo ln -s /etc/nginx/sites-available/sycom-portal /etc/nginx/sites-enabled/

# Otestujte konfiguráciu
sudo nginx -t

# Reloadujte Nginx
sudo systemctl reload nginx
```

### 5. SSL certifikát (Let's Encrypt - zadarmo)

```bash
sudo certbot --nginx -d portal.sycom.sk
# Postupujte podľa pokynov — certbot automaticky aktualizuje Nginx konfiguráciu
```

### 6. Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 📁 Štruktúra projektu

```
sycom-portal/
├── prisma/
│   ├── schema.prisma          ← databázová schéma
│   └── seed.ts                ← testovacie dáta
├── src/
│   ├── app/
│   │   ├── api/               ← API routes
│   │   │   ├── auth/          ← NextAuth
│   │   │   ├── tickets/       ← CRUD tiketov
│   │   │   ├── users/         ← správa používateľov
│   │   │   ├── kb/            ← znalostná báza
│   │   │   └── reports/       ← štatistiky
│   │   ├── (auth)/login/      ← prihlasovacia stránka
│   │   ├── (client)/          ← klientská časť portálu
│   │   │   ├── dashboard/     ← hlavná stránka
│   │   │   ├── tickets/       ← zoznam tiketov
│   │   │   └── kb/            ← znalostná báza
│   │   └── (admin)/           ← admin sekcia
│   │       └── admin/
│   │           ├── users/     ← správa používateľov
│   │           ├── teams/     ← správa tímov
│   │           └── reports/   ← reporty
│   ├── components/
│   │   └── layout/            ← Topbar, Sidebar, PortalLayout
│   └── lib/
│       ├── prisma.ts          ← databázový klient
│       ├── auth.ts            ← NextAuth konfigurácia
│       ├── email.ts           ← emailové notifikácie
│       └── utils.ts           ← pomocné funkcie
├── .env.example               ← šablóna premenných prostredia
├── ecosystem.config.js        ← PM2 konfigurácia
├── sycom-portal.nginx         ← Nginx konfigurácia
└── deploy.sh                  ← skript pre nasadenie
```

---

## 🔧 Správa a údržba

```bash
# Zobrazenie logov
pm2 logs sycom-portal

# Reštart aplikácie
pm2 restart sycom-portal

# Aktualizácia (po zmene kódu)
cd /var/www/sycom-portal
git pull  # alebo scp nové súbory
npm install
npm run build
pm2 restart sycom-portal

# Záloha databázy
mysqldump -u sycom_user -p sycom_portal > backup_$(date +%Y%m%d).sql

# Obnova databázy
mysql -u sycom_user -p sycom_portal < backup_20240101.sql

# Obnovenie SSL certifikátu (automatické cez cron)
sudo certbot renew --dry-run
```

---

## 🔐 Bezpečnosť

- ✅ Heslá hashované cez bcrypt (cost factor 12)
- ✅ JWT session tokeny (NextAuth)
- ✅ Role-based access control (ADMIN / AGENT / CLIENT)
- ✅ Input validácia cez Zod
- ✅ HTTPS + HSTS hlavičky (Nginx)
- ✅ SQL injection ochrana (Prisma ORM)
- ✅ Interné poznámky skryté pred klientmi

---

## 📞 Kontakt

**Sycom s.r.o.**
Hviezdoslavova 1, Senec 90301
Helpdesk: 0948 938 217
Web: sycom.sk
