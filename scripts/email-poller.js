'use strict'
const { ImapFlow }     = require('imapflow')
const { simpleParser } = require('mailparser')
const { PrismaClient } = require('@prisma/client')
const fs   = require('fs')
const path = require('path')
const zlib = require('zlib')

const prisma        = new PrismaClient()
const POLL_INTERVAL = 2 * 60 * 1000
const ATT_DIR       = '/opt/sycom-portal/public/uploads/attachments'
const LOG_DIR       = '/opt/sycom-portal/logs'

// ── Logging ────────────────────────────────────────────────────────────────
function log(level, msg) {
  const ts  = new Date().toISOString()
  const tag = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '\x1b[36m'
  console.log(`${tag}[poller][${level}]\x1b[0m ${msg}`)
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
    const ym  = ts.substring(0, 7)
    const file = path.join(LOG_DIR, `poller-${ym}.jsonl`)
    fs.appendFileSync(file, JSON.stringify({ ts, level, msg }) + '\n')
  } catch (e) { console.error('log write error:', e.message) }
}

// ── Monthly compression + 365-day cleanup ─────────────────────────────────
function maintainLogs() {
  try {
    if (!fs.existsSync(LOG_DIR)) return
    const now       = new Date()
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const cutoff    = new Date(Date.now() - 365 * 24 * 3600 * 1000)

    for (const file of fs.readdirSync(LOG_DIR)) {
      const filePath = path.join(LOG_DIR, file)
      const match    = file.match(/poller-(\d{4}-\d{2})/)
      if (!match) continue
      const ym       = match[1]
      const fileDate = new Date(ym + '-01')

      // delete anything older than 365 days (both .jsonl and .jsonl.gz)
      if (fileDate < cutoff) {
        fs.unlinkSync(filePath)
        log('info', `Deleted old log: ${file}`)
        continue
      }

      // compress previous months that are still uncompressed
      if (file.endsWith('.jsonl') && ym !== currentYm) {
        const gzPath = filePath + '.gz'
        if (!fs.existsSync(gzPath)) {
          const compressed = zlib.gzipSync(fs.readFileSync(filePath))
          fs.writeFileSync(gzPath, compressed)
          fs.unlinkSync(filePath)
          log('info', `Compressed ${file}`)
        }
      }
    }
  } catch (e) { log('warn', 'Log maintenance error: ' + e.message) }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function sla(p) {
  return new Date(Date.now() + ({ LOW: 24, MEDIUM: 8, HIGH: 4, CRITICAL: 2 }[p] ?? 8) * 3600000)
}

async function loadSettings() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['email_imap_host','email_imap_port','email_imap_secure','email_imap_user','email_imap_pass','email_imap_enabled'] } }
  })
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

// ── Process one email ──────────────────────────────────────────────────────
async function processMessage(imap, msg) {
  const p     = await simpleParser(msg.source)
  const addrs = [p.to?.value ?? []].flat().map(a => a.address?.toLowerCase()).filter(Boolean)
  log('info', `Processing email — To: [${addrs.join(', ')}], Subject: "${p.subject || '(none)'}"`)

  let client = null
  for (const a of addrs) {
    client = await prisma.client.findFirst({ where: { emailAlias: a } })
    if (client) break
  }

  if (!client) {
    log('warn', `No alias match for [${addrs.join(', ')}] — skipping`)
    await imap.messageFlagsAdd(msg.seq, ['\\Seen'])
    return
  }

  let creator = await prisma.user.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: 'asc' } })
  if (!creator) {
    log('warn', `No user for client "${client.name}" — falling back to admin`)
    creator = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } })
  }
  if (!creator) {
    log('warn', 'No admin user found — skipping')
    await imap.messageFlagsAdd(msg.seq, ['\\Seen'])
    return
  }

  const subject  = (p.subject || '(bez predmetu)').substring(0, 200)
  const priority = subject.toLowerCase().includes('urgent') ? 'HIGH' : 'MEDIUM'
  let   desc     = (p.text || '').trim() || (p.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '(bez obsahu)'

  const ticket = await prisma.ticket.create({
    data: { subject, description: desc, priority, category: 'EMAIL', clientId: client.id, creatorId: creator.id, slaDeadline: sla(priority) }
  })
  log('info', `✓ Created ticket #${ticket.ticketNumber} — "${subject}" for "${client.name}"`)

  if (p.attachments?.length) {
    if (!fs.existsSync(ATT_DIR)) fs.mkdirSync(ATT_DIR, { recursive: true })
    for (const a of p.attachments) {
      try {
        const fn = `${ticket.id}-${Date.now()}-${(a.filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`
        fs.writeFileSync(path.join(ATT_DIR, fn), a.content)
        await prisma.attachment.create({
          data: { ticketId: ticket.id, filename: a.filename || 'file', fileUrl: `/uploads/attachments/${fn}`, fileSize: a.size ?? a.content.length, mimeType: a.contentType || 'application/octet-stream' }
        })
        log('info', `  + attachment saved: ${fn}`)
      } catch (e) { log('error', 'Attachment save failed: ' + e.message) }
    }
  }

  await imap.messageFlagsAdd(msg.seq, ['\\Seen'])
}

// ── Poll cycle ─────────────────────────────────────────────────────────────
async function poll() {
  const s = await loadSettings()
  if (s.email_imap_enabled !== 'true') { log('info', 'Poller disabled — skipping'); return }

  const imap = new ImapFlow({
    host: s.email_imap_host, port: +s.email_imap_port || 993,
    secure: s.email_imap_secure === 'true',
    auth: { user: s.email_imap_user, pass: s.email_imap_pass },
    logger: false
  })

  try {
    await imap.connect()
    log('info', `Connected to IMAP (${s.email_imap_host})`)
    const lock = await imap.getMailboxLock('INBOX')
    try {
      const uids = await imap.search({ seen: false })
      log('info', `Found ${uids.length} unseen message(s)`)
      if (uids.length) {
        // Collect all messages first — modifying flags inside fetch loop corrupts the stream
        const messages = []
        for await (const msg of imap.fetch(uids, { source: true })) {
          messages.push({ seq: msg.seq, source: msg.source })
        }
        log('info', `Collected ${messages.length} message(s) — processing...`)
        for (const msg of messages) {
          try { await processMessage(imap, msg) } catch (e) { log('error', 'Message error: ' + e.message) }
        }
      }
    } finally { lock.release() }
    await imap.logout()
    log('info', 'Disconnected from IMAP')
  } catch (e) {
    log('error', 'IMAP connection error: ' + e.message)
    try { await imap.logout() } catch {}
  }

  maintainLogs()
}

// ── Entry point ────────────────────────────────────────────────────────────
async function main() {
  log('info', `Poller started — interval: ${POLL_INTERVAL / 1000}s`)
  if (!fs.existsSync(ATT_DIR)) fs.mkdirSync(ATT_DIR, { recursive: true })
  await poll()
  setInterval(() => poll().catch(e => log('error', 'Unhandled: ' + e.message)), POLL_INTERVAL)
}
main().catch(e => { log('error', 'Fatal: ' + e.message); process.exit(1) })
