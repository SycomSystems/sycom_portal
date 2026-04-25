/**
 * email-poller.js
 * Runs as a PM2 process. Every 2 minutes it:
 *   1. Reads IMAP settings from the DB
 *   2. Connects to the Exchange mailbox via IMAP
 *   3. For each UNSEEN email:
 *      - Resolves the CREATOR from the sender (From:) email address:
 *          a) Sender email matches an existing User → use that user
 *          b) Not found → check AllowedDomain whitelist
 *             - Domain NOT in whitelist → skip (log + mark seen)
 *             - Domain in whitelist → auto-create Client + User,
 *               send welcome email to new user, notify admin
 *      - Resolves the CLIENT from emailAlias (To: address) or creator's clientId
 *      - Auto-assigns technician from ClientTechnician if available
 *      - Creates a ticket (HIGH if subject contains "urgent", otherwise MEDIUM)
 *      - Saves attachments to /opt/sycom-portal/public/uploads/attachments/
 *      - Marks the email as SEEN
 *
 * Install deps (once):
 *   cd /opt/sycom-portal
 *   npm install imapflow mailparser nodemailer bcryptjs
 *
 * Start with PM2:
 *   pm2 start scripts/email-poller.js --name email-poller
 *   pm2 save
 */

'use strict'

const { ImapFlow }     = require('imapflow')
const { simpleParser } = require('mailparser')
const { PrismaClient } = require('@prisma/client')
const nodemailer       = require('nodemailer')
const fs               = require('fs')
const path             = require('path')
const crypto           = require('crypto')
const bcrypt           = require('bcryptjs')

const prisma = new PrismaClient()
const POLL_INTERVAL   = 2 * 60 * 1000
const ATTACHMENTS_DIR = '/opt/sycom-portal/public/uploads/attachments'
const PORTAL_URL      = process.env.NEXTAUTH_URL || 'https://portal.sycom.sk'

// ─── SLA helper ──────────────────────────────────────────────────────────────
function slaDeadline(priority) {
  const hours = { LOW: 24, MEDIUM: 8, HIGH: 4, CRITICAL: 2 }
  return new Date(Date.now() + (hours[priority] ?? 8) * 60 * 60 * 1000)
}

// ─── Load IMAP settings from DB ──────────────────────────────────────────────
async function loadSettings() {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          'email_imap_host', 'email_imap_port', 'email_imap_secure',
          'email_imap_user', 'email_imap_pass', 'email_imap_enabled',
        ],
      },
    },
  })
  const s = {}
  for (const r of rows) s[r.key] = r.value
  return s
}

// ─── Nodemailer transporter from env vars ────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

// ─── Welcome email to auto-created user ──────────────────────────────────────
async function sendWelcomeEmail(email, plainPassword) {
  if (!process.env.SMTP_HOST) {
    console.log(`[poller] SMTP not configured — skipping welcome email to ${email}`)
    return
  }
  try {
    const transporter = createTransporter()
    await transporter.sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to:      email,
      subject: 'Váš prístup do Sycom IT Portálu',
      text: [
        'Dobrý deň,',
        '',
        'Váš email bol zaznamenaný v našom systéme a bol Vám automaticky vytvorený prístup do Sycom IT Portálu.',
        '',
        `Portál:             ${PORTAL_URL}`,
        `Prihlasovacie meno: ${email}`,
        `Heslo:              ${plainPassword}`,
        '',
        'Po prvom prihlásení si odporúčame heslo zmeniť v nastaveniach profilu.',
        '',
        'S pozdravom,',
        'Sycom Systems',
      ].join('\n'),
    })
    console.log(`[poller] Welcome email sent to ${email}`)
  } catch (err) {
    console.error(`[poller] Failed to send welcome email to ${email}:`, err.message)
  }
}

// ─── Admin notification about auto-created user ───────────────────────────────
async function sendAdminNotification(newUserEmail, clientName) {
  if (!process.env.SMTP_HOST) return
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { email: true },
    })
    if (admins.length === 0) return

    const transporter = createTransporter()
    await transporter.sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to:      admins.map(a => a.email).join(', '),
      subject: `[Portál] Nový auto-vytvorený používateľ: ${newUserEmail}`,
      text: [
        'Dobrý deň,',
        '',
        'Z prichádzajúceho emailu bol automaticky vytvorený nový používateľ a klient:',
        '',
        `Používateľ: ${newUserEmail}`,
        `Klient:     ${clientName}`,
        '',
        'Používateľ ešte nemá priradeného zodpovedného technika.',
        'Skontrolujte a priraďte ho v admin sekcii:',
        `${PORTAL_URL}/admin/clients`,
        '',
        'Sycom Portal',
      ].join('\n'),
    })
    console.log(`[poller] Admin notified about new user ${newUserEmail}`)
  } catch (err) {
    console.error('[poller] Failed to send admin notification:', err.message)
  }
}

// ─── Extract To: addresses ────────────────────────────────────────────────────
function toAddresses(parsed) {
  const addrs = []
  const raw = parsed.to
  if (!raw) return addrs
  const values = Array.isArray(raw.value) ? raw.value : [raw.value]
  for (const v of values) {
    if (v && v.address) addrs.push(v.address.toLowerCase().trim())
  }
  return addrs
}

// ─── Extract From: address ────────────────────────────────────────────────────
function getFromAddress(parsed) {
  const raw = parsed.from
  if (!raw) return null
  const values = Array.isArray(raw.value) ? raw.value : [raw.value]
  for (const v of values) {
    if (v && v.address) return v.address.toLowerCase().trim()
  }
  return null
}

// ─── Resolve or auto-create creator from sender email ────────────────────────
// Returns { user } or null if the sender is rejected
async function resolveCreator(senderEmail) {
  // a) Known user?
  const existing = await prisma.user.findFirst({
    where: { email: senderEmail },
    include: { client: true },
  })
  if (existing) {
    console.log(`[poller] Sender ${senderEmail} matched existing user: ${existing.name}`)
    return { user: existing }
  }

  // b) Unknown — check domain whitelist
  const domain = senderEmail.split('@')[1]
  if (!domain) {
    console.log(`[poller] Invalid sender "${senderEmail}" — skipping`)
    return null
  }

  const allowed = await prisma.allowedDomain.findUnique({ where: { domain } })
  if (!allowed) {
    console.log(`[poller] Domain "${domain}" not in whitelist — rejecting ${senderEmail}`)
    return null
  }

  // c) Allowed domain — auto-create Client + User
  console.log(`[poller] Auto-creating account for ${senderEmail} (domain: ${domain})`)

  const plainPassword  = crypto.randomBytes(8).toString('base64url').slice(0, 12)
  const hashedPassword = await bcrypt.hash(plainPassword, 12)

  // Create client from domain name
  const newClient = await prisma.client.create({
    data: { name: domain },
  })

  const newUser = await prisma.user.create({
    data: {
      email:    senderEmail,
      name:     senderEmail,
      password: hashedPassword,
      role:     'CLIENT',
      clientId: newClient.id,
      isActive: true,
    },
    include: { client: true },
  })

  console.log(`[poller] Created user ${newUser.id} + client ${newClient.id} for domain ${domain}`)

  // Fire-and-forget — don't block ticket creation
  sendWelcomeEmail(senderEmail, plainPassword).catch(() => {})
  sendAdminNotification(senderEmail, domain).catch(() => {})

  return { user: newUser }
}

// ─── Process a single IMAP message ───────────────────────────────────────────
async function processMessage(imap, msg) {
  const parsed   = await simpleParser(msg.source)
  const sender   = getFromAddress(parsed)
  const toAddrs  = toAddresses(parsed)

  // ── 1. Resolve creator ────────────────────────────────────────────────────
  if (!sender) {
    console.log('[poller] No sender address — skipping')
    await imap.messageFlagsAdd(msg.seq, ['\\Seen'])
    return
  }

  const creatorResult = await resolveCreator(sender)
  if (!creatorResult) {
    await imap.messageFlagsAdd(msg.seq, ['\\Seen'])
    return
  }
  const creator = creatorResult.user

  // ── 2. Resolve client ─────────────────────────────────────────────────────
  // Priority: emailAlias match → creator's client
  let matchedClient = null
  for (const addr of toAddrs) {
    matchedClient = await prisma.client.findFirst({ where: { emailAlias: addr } })
    if (matchedClient) break
  }
  if (!matchedClient && creator.clientId) {
    matchedClient = await prisma.client.findUnique({ where: { id: creator.clientId } })
  }

  if (!matchedClient) {
    console.log(`[poller] No client resolved for ${sender} — skipping`)
    await imap.messageFlagsAdd(msg.seq, ['\\Seen'])
    return
  }

  // ── 3. Subject + priority ─────────────────────────────────────────────────
  const subject  = (parsed.subject || '(bez predmetu)').substring(0, 200)
  const priority = subject.toLowerCase().includes('urgent') ? 'HIGH' : 'MEDIUM'

  let description = (parsed.text || '').trim()
  if (!description && parsed.html) {
    description = parsed.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  if (!description) description = '(bez obsahu)'

  // ── 4. Auto-assign technician from ClientTechnician ──────────────────────
  const techAssignment = await prisma.clientTechnician.findFirst({
    where:   { clientId: matchedClient.id },
    orderBy: { userId: 'asc' },
  })

  // ── 5. Create ticket ──────────────────────────────────────────────────────
  const ticket = await prisma.ticket.create({
    data: {
      subject,
      description,
      priority,
      category:    'EMAIL',
      clientId:    matchedClient.id,
      creatorId:   creator.id,
      assigneeId:  techAssignment?.userId ?? null,
      slaDeadline: slaDeadline(priority),
    },
  })

  console.log(`[poller] Ticket #${ticket.ticketNumber} created — "${subject}" | client: ${matchedClient.name} | creator: ${sender}`)

  // ── 6. Save attachments ───────────────────────────────────────────────────
  if (parsed.attachments && parsed.attachments.length > 0) {
    if (!fs.existsSync(ATTACHMENTS_DIR)) {
      fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true })
    }
    for (const att of parsed.attachments) {
      try {
        const safeName = (att.filename || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_')
        const filename = `${ticket.id}-${Date.now()}-${safeName}`
        fs.writeFileSync(path.join(ATTACHMENTS_DIR, filename), att.content)
        await prisma.attachment.create({
          data: {
            ticketId: ticket.id,
            filename: att.filename || 'attachment',
            fileUrl:  `/uploads/attachments/${filename}`,
            fileSize: att.size ?? att.content.length,
            mimeType: att.contentType || 'application/octet-stream',
          },
        })
        console.log(`[poller]   + attachment: ${filename}`)
      } catch (err) {
        console.error('[poller] Failed to save attachment:', err.message)
      }
    }
  }

  // ── 7. Mark as read ───────────────────────────────────────────────────────
  await imap.messageFlagsAdd(msg.seq, ['\\Seen'])
}

// ─── Main poll cycle ──────────────────────────────────────────────────────────
async function poll() {
  const settings = await loadSettings()

  if (settings['email_imap_enabled'] !== 'true') {
    console.log('[poller] Disabled — skipping cycle.')
    return
  }

  const imap = new ImapFlow({
    host:   settings['email_imap_host'],
    port:   parseInt(settings['email_imap_port'] || '993'),
    secure: settings['email_imap_secure'] === 'true',
    auth: {
      user: settings['email_imap_user'],
      pass: settings['email_imap_pass'],
    },
    logger: false,
  })

  try {
    await imap.connect()
    console.log('[poller] Connected to IMAP.')

    const lock = await imap.getMailboxLock('INBOX')
    try {
      const uids = await imap.search({ seen: false })
      console.log(`[poller] Found ${uids.length} unseen message(s).`)

      if (uids.length > 0) {
        for await (const msg of imap.fetch(uids, { source: true, envelope: true })) {
          try {
            await processMessage(imap, msg)
          } catch (err) {
            console.error('[poller] Error processing message:', err.message)
          }
        }
      }
    } finally {
      lock.release()
    }

    await imap.logout()
    console.log('[poller] Disconnected.')
  } catch (err) {
    console.error('[poller] IMAP error:', err.message)
    try { await imap.logout() } catch {}
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────
async function main() {
  console.log('[poller] Starting email → ticket poller.')
  console.log(`[poller] Poll interval: ${POLL_INTERVAL / 1000}s`)

  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true })
  }

  await poll()

  setInterval(async () => {
    try { await poll() } catch (err) {
      console.error('[poller] Unhandled error in poll():', err.message)
    }
  }, POLL_INTERVAL)
}

main().catch((err) => {
  console.error('[poller] Fatal:', err)
  process.exit(1)
})
