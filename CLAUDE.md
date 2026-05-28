# Sycom Portal — Project Handoff Document

Posledná aktualizácia: 2026-05-12 | Aktuálna verzia: **v3.12.0**

---

## PRAVIDLO: VŠETKY ZMENY IDE CEZ STAGING

Žiadna zmena nejde priamo na produkciu. Každá nová funkcia alebo oprava sa najprv nasadí na staging, otestuje, a až po výslovnom schválení sa pošle na ostré prostredie.

develop branch  →  portal-staging.sycom.sk  (vývoj + testovanie)
      ↓  "nasaď na produkciu" (výslovný príkaz)
main branch     →  portal.sycom.sk           (ostrá verzia)

---

## Repository

- GitHub: https://github.com/SycomSystems/sycom_portal
- Branch develop — sem idú všetky zmeny (staging)
- Branch main — iba po schválení (produkcia)
- GitHub user: krizek@sycom.sk

---

## Produkcia

- URL: https://portal.sycom.sk
- VPS: root@ubuntu-8gb-nbg1-1
- Adresár: /opt/sycom-portal
- Branch: main
- PM2 proces: sycom-portal (port 3000)
- Email poller: email-poller
- DB: MySQL sycom_portal @ localhost:3306
- DB user: sycom_user
- Nginx config: 1Panel OpenResty: /opt/1panel/apps/openresty/openresty/conf/conf.d/portal.sycom.sk.conf
- Logy: /opt/sycom-portal/logs/

---

## Staging

- URL: https://portal-staging.sycom.sk
- VPS: root@ubuntu-8gb-nbg1-1 (rovnaký server)
- Adresár: /opt/sycom-portal-staging
- Branch: develop
- PM2 proces: sycom-portal-staging (port 3001)
- DB: MySQL sycom_portal_staging @ localhost:3306
- DB user: sycom_staging
- Nginx config: 1Panel OpenResty: /opt/1panel/apps/openresty/openresty/conf/conf.d/portal-staging.sycom.sk.conf
- Test admin: stanislav.krizek@sycom.sk / testadmin

---

## Deploy príkazy

### Staging (develop branch) — každodenný vývoj

  cd /opt/sycom-portal-staging
  git pull origin develop
  npm run build && pm2 restart sycom-portal-staging

  Ak sa zmenila schema.prisma:
  npx prisma db push && npx prisma generate
  npm run build && pm2 restart sycom-portal-staging

### Produkcia (main branch) — iba po schválení

  cd /opt/sycom-portal
  git checkout main
  git merge develop
  git push origin main
  npm run build && pm2 restart sycom-portal

### Git workflow — commit na staging

  cd /opt/sycom-portal-staging
  git add -A
  git commit -m "feat/fix: popis zmeny"
  git push origin develop

---

## Kompletný workflow novej funkcie

1. Všetky zmeny robiť v /opt/sycom-portal-staging (branch: develop)
2. git add -A && git commit -m "..." && git push origin develop
3. Nasadiť na staging: cd /opt/sycom-portal-staging && git pull && npm run build && pm2 restart sycom-portal-staging
4. Otestovať na https://portal-staging.sycom.sk
5. Ak OK → povedať "nasaď na produkciu" alebo "schvaľujem"
6. Merge: cd /opt/sycom-portal && git checkout main && git merge develop && git push origin main
7. Build prod: npm run build && pm2 restart sycom-portal

---

## Dôležité: Termius markdown link injekcia

Termius automaticky konvertuje niektoré vzory na markdown linky!
Príklady: session.user.id sa konvertuje na link, f.read tiež.

Riešenia:
1. base64 — enkódovať skript lokálne: echo "BASE64" | base64 -d | python3
2. sed — pre jednoduché náhrady
3. V TypeScript kóde použiť u['id'] namiesto u.id kde hrozí mangle

---

## Project structure

/opt/sycom-portal/          ← produkcia (main)
/opt/sycom-portal-staging/  ← staging (develop)

src/app/(admin)/admin/
  users/page.tsx          ← generate password + "Odoslať prihlásenie" toggle
  clients/page.tsx        ← assign technicians to clients (ClientTechnician)
  reports/page.tsx
  debug/page.tsx          ← audit log + poller logs, filtrovanie akcia/user/dátum
  sklad/ (page, [id], items/[id], items/new)
  recurring/page.tsx
  recurring-reports/page.tsx
  teams/page.tsx

src/app/(client)/
  dashboard/page.tsx      ← štatistické karty (open/high/medium/low priority)
  tickets/ (page, new, [id])
  orders/ (page, new, [id])
  kb/[slug]/page.tsx
  settings/ (page, profile)

src/app/api/
  users/, tickets/, clients/, comments/, reports/, vykaz/
  manual-hours/, notifications/, orders/, kb/, settings/, admin/, stock/

src/lib/
  auth.ts      ← loguje login_success/login_failed do AuditLog s IP
  prisma.ts
  audit.ts     ← logAudit(userId|null, entityType, entityId, action, old, new, ip?)
  utils.ts     ← addWorkingDays(), getSlaDeadline(), priorityLabels
  email.ts     ← getSmtpConfig() z DB, sendTicketCreated/Assigned/Resolved/NewComment

scripts/
  email-poller.js           ← IMAP poller, Message-ID dedup, reply→comment
  recurring-ticket-runner.js

logs/
  poller-YYYY-MM.json
  smtp-YYYY-MM.jsonl        ← SMTP audit log
  processed-emails.json

---

## Database models

User (notifyAll Boolean @default(true))
Session, Client, ClientPricing
ClientTechnician  ← many-to-many: Client ↔ User
Team, TeamMember
Ticket (updatedById String?, priority: LOW/MEDIUM/HIGH)
Comment (isInternal Boolean, workedHours Float)
Attachment, Notification, KbArticle, ManualHours
RecurringTicket, RecurringReport
Supplier, StockItem, StockMovement
StockUsage / TicketStockUsage, SupplierPrice, SerialNumber
AllowedDomain     ← whitelist pre email-ingest
SmtpSettings      ← singleton (id=1): host, port, secure, user, pass, from
AuditLog          ← entityType, entityId, action, oldValue, newValue, userId?, ip?, createdAt

Priority enum: LOW | MEDIUM | HIGH (CRITICAL bolo odstránené v3.10)

---

## Roles

- ADMIN — plný prístup, môže mazať tikety, vidí všetky štatistiky
- AGENT — technik, priradzovaný ku tiketom, vidí len svoje tikety
- CLIENT — klient, vidí len tikety svojej spoločnosti
- CLIENT_MANAGER — rovnaké práva ako CLIENT

---

## Environment variables

Produkcia (/opt/sycom-portal/.env):
  DATABASE_URL=mysql://sycom_user:...@localhost:3306/sycom_portal
  NEXTAUTH_SECRET=...
  NEXTAUTH_URL=https://portal.sycom.sk
  SMTP_HOST/PORT/USER/PASS/FROM (fallback, primárne z DB SmtpSettings)

Staging (/opt/sycom-portal-staging/.env):
  DATABASE_URL=mysql://sycom_staging:...@localhost:3306/sycom_portal_staging
  NEXTAUTH_SECRET=... (iný ako prod)
  NEXTAUTH_URL=https://portal-staging.sycom.sk
  PORT=3001

---

## Dôležité pravidlá

1. VŠETKY zmeny najprv na staging (develop branch), až po schválení na produkciu
2. NIKDY pm2 restart pred npm run build — vždy: npm run build && pm2 restart
3. Po zmene prisma/schema.prisma: npx prisma db push && npx prisma generate pred buildom
4. mysql CLI nie je na hoste — DB: docker exec -i 1Panel-mysql-j5sD mysql -u root -pmysql_c7RDtz
5. PortalLayout wraps každú stránku — bez neho sa dizajn rozbije
6. lib/email.ts exportuje len ticket-specific emaily
7. Termius mangle vzory — base64 pre zložitejšie skripty
8. Verzia v package.json → sidebar po builde (NEXT_PUBLIC_APP_VERSION)

---

## Verzie (changelog)

v3.1-3.3: Základný portal, sklad, email-ingest
v3.4: ClientTechnician, SLA auto-calc, password hashing, auto-assign
v3.5: updatedById pri tvorbe tiketu aj email reply
v3.6: "Odoslať prihlásenie" button, klient môže zatvoriť/otvoriť tiket, admin delete
v3.7: Audit log pre login eventy (success + failed + IP)
v3.8: Bulk operácie na tiketoch (delete/status/assign)
v3.9: Multi-status filter, sort by updatedAt, technician phone v sidebar
v3.10: Odstránenie CRITICAL priority, dashboard stats karty
v3.10.1: Audit log: login_success filter + filter podľa používateľa
v3.11: SMTP logging, mobile overflow fix, notifyAll fix, AGENT filter fix
v3.12.0: Verzia v sidebar, staging server, git workflow develop→main

---

## Open TODO

UI fixes:
- Dashboard scroll — stránka pretečie ~136px
- Sidebar — odstrániť "SycomPortal" text
- Topbar — odstrániť "Support Portal" text
- Sklad filter — date range col-span-2

Funkcionality:
- Slovenské sviatky v SLA kalkulácii
- Email technikovi pri novom tikete
- In-app notifikácie
- Confirm dialog pred odoslaním hesla
- Audit log na detaile tiketu
- Audit log CSV export

Reporty:
- SLA breach report
- ManualHours fakturačný report
- Custom report builder

---

## Mobilná aplikácia — plán

Tech: React Native + Expo | iOS: TestFlight | Android: APK/Google Play
Bundle ID: sk.sycom.portal

Repo: sycom_portal_app (treba vytvoriť)
Krok 1: Expo projekt init
Krok 2: Autentifikácia cez NextAuth
Krok 3: Tikety MVP (zoznam, detail, komentár, nový)
Krok 4: Push notifikácie (Expo + Firebase/APNs)
Krok 5: Dashboard stats
Krok 6: TestFlight build (eas build --platform ios)
Krok 7: Android APK

API na dodanie:
  POST /api/push-token  ← uloženie Expo push tokenu
  DELETE /api/push-token ← zmazanie pri logout

---

## Užitočné príkazy

  pm2 status
  pm2 logs sycom-portal --lines 50 --nostream --err
  pm2 logs sycom-portal-staging --lines 50 --nostream --err

  MySQL cez Docker:
  docker exec -i 1Panel-mysql-j5sD mysql -u root -pmysql_c7RDtz -e "SHOW DATABASES;"

  Reload OpenResty:
  docker exec 1Panel-openresty-NMeH openresty -s reload
