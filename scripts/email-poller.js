'use strict'
const { ImapFlow } = require('imapflow')
const { simpleParser } = require('mailparser')
const { PrismaClient } = require('@prisma/client')
const fs = require('fs'), path = require('path')
const prisma = new PrismaClient()
const POLL_INTERVAL = 2 * 60 * 1000
const ATT_DIR = '/opt/sycom-portal/public/uploads/attachments'

function sla(p) { return new Date(Date.now() + ({LOW:24,MEDIUM:8,HIGH:4,CRITICAL:2}[p]??8)*3600000) }

async function settings() {
  const rows = await prisma.setting.findMany({ where:{ key:{ in:['email_imap_host','email_imap_port','email_imap_secure','email_imap_user','email_imap_pass','email_imap_enabled'] } } })
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

async function process(imap, msg) {
  const p = await simpleParser(msg.source)
  const addrs = [p.to?.value ?? []].flat().map(a => a.address?.toLowerCase()).filter(Boolean)
  let client = null
  for (const a of addrs) { client = await prisma.client.findFirst({ where: { emailAlias: a } }); if (client) break }
  if (!client) { await imap.messageFlagsAdd(msg.seq,['\\Seen']); return }
  const creator = await prisma.user.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: 'asc' } })
  if (!creator) { await imap.messageFlagsAdd(msg.seq,['\\Seen']); return }
  const subject = (p.subject||'(bez predmetu)').substring(0,200)
  const priority = subject.toLowerCase().includes('urgent') ? 'HIGH' : 'MEDIUM'
  let desc = (p.text||'').trim() || (p.html||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim() || '(bez obsahu)'
  const ticket = await prisma.ticket.create({ data: { subject, description: desc, priority, category: 'EMAIL', clientId: client.id, creatorId: creator.id, slaDeadline: sla(priority) } })
  console.log(`[poller] ✓ #${ticket.ticketNumber} "${subject}" → ${client.name}`)
  if (p.attachments?.length) {
    if (!fs.existsSync(ATT_DIR)) fs.mkdirSync(ATT_DIR, { recursive: true })
    for (const a of p.attachments) {
      try {
        const fn = `${ticket.id}-${Date.now()}-${(a.filename||'file').replace(/[^a-zA-Z0-9._-]/g,'_')}`
        fs.writeFileSync(path.join(ATT_DIR, fn), a.content)
        await prisma.attachment.create({ data: { ticketId: ticket.id, filename: a.filename||'file', fileUrl: `/uploads/attachments/${fn}`, fileSize: a.size??a.content.length, mimeType: a.contentType||'application/octet-stream' } })
      } catch(e) { console.error('[poller] att error:', e.message) }
    }
  }
  await imap.messageFlagsAdd(msg.seq,['\\Seen'])
}

async function poll() {
  const s = await settings()
  if (s.email_imap_enabled !== 'true') { console.log('[poller] disabled'); return }
  const imap = new ImapFlow({ host: s.email_imap_host, port: +s.email_imap_port||993, secure: s.email_imap_secure==='true', auth: { user: s.email_imap_user, pass: s.email_imap_pass }, logger: false })
  try {
    await imap.connect()
    const lock = await imap.getMailboxLock('INBOX')
    try {
      const uids = await imap.search({ seen: false })
      console.log(`[poller] ${uids.length} unseen`)
      if (uids.length) for await (const msg of imap.fetch(uids, { source: true })) { try { await process(imap, msg) } catch(e) { console.error(e.message) } }
    } finally { lock.release() }
    await imap.logout()
  } catch(e) { console.error('[poller] IMAP:', e.message); try { await imap.logout() } catch {} }
}

async function main() {
  console.log('[poller] starting, interval=2min')
  if (!fs.existsSync(ATT_DIR)) fs.mkdirSync(ATT_DIR, { recursive: true })
  await poll()
  setInterval(() => poll().catch(e => console.error(e.message)), POLL_INTERVAL)
}
main().catch(e => { console.error(e); process.exit(1) })
