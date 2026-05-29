/**
 * invoice-poller.js
 * PM2 process — každých 5 minút skenuje INBOX na PDF prílohy a OCR-uje faktúry.
 *
 * Koexistencia s email-pollerom:
 *   - Používa ROVNAKÉ IMAP nastavenia (email_imap_*) — jeden účet, jeden INBOX
 *   - email-poller označuje maily ako Seen a vytvára tikety
 *   - invoice-poller NEOZNAČUJE maily ako Seen — sleduje spracované cez Message-ID
 *   - Každý mail s PDF prílohou sa skúsi OCR-ovať bez ohľadu na Seen/Unseen stav
 *   - Limit: posledných 30 dní aby sa neprehľadával celý archív
 *
 * Sklad sa NEPLNÍ automaticky — admin/agent schváli v sekcii Faktúry.
 *
 * Spustenie:
 *   pm2 start scripts/invoice-poller.js --name invoice-poller --cwd /opt/sycom-portal
 *   pm2 save
 */

'use strict'

const { ImapFlow }     = require('imapflow')
const { simpleParser } = require('mailparser')
const { PrismaClient } = require('@prisma/client')
const pdfParse         = require('pdf-parse')  // verzia 1.1.1
const fs               = require('fs')
const path             = require('path')

const prisma        = new PrismaClient()
const POLL_INTERVAL = 5 * 60 * 1000
const PRICE_IN      = 0.15 / 1_000_000
const PRICE_OUT     = 0.60 / 1_000_000
const LOG_DIR       = path.join(__dirname, '..', 'logs')
const PROCESSED_FILE = path.join(LOG_DIR, 'processed-invoices.json')

// ── Message-ID tracking ────────────────────────────────────────────────────────
function loadProcessed() {
  try { return new Set(JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'))) }
  catch { return new Set() }
}
function saveProcessed(set) {
  const arr = Array.from(set)
  if (arr.length > 10000) arr.splice(0, arr.length - 10000)
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(arr))
}

// ── Logging ────────────────────────────────────────────────────────────────────
function log(level, msg) {
  const ts = new Date().toISOString()
  if (level === 'error') console.error(`[invoice] ${msg}`)
  else console.log(`[invoice] ${msg}`)
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
    fs.appendFileSync(
      path.join(LOG_DIR, `invoice-poller-${ts.slice(0, 7)}.json`),
      JSON.stringify({ ts, level, msg }) + '\n'
    )
  } catch (_) {}
}

// ── Settings — zdieľa nastavenia s email-pollerom ──────────────────────────────
async function loadSettings() {
  const keys = [
    'email_imap_host', 'email_imap_port', 'email_imap_user',
    'email_imap_pass', 'email_imap_secure',
    'openai_api_key', 'invoice_ocr_enabled',
    'company_ico', 'company_name',
  ]
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } })
  const s = {}
  for (const r of rows) s[r.key] = r.value
  return s
}

// ── PDF → text ─────────────────────────────────────────────────────────────────
async function extractText(buffer) {
  try {
    const data = await pdfParse(buffer)
    return data.text || ''
  } catch (e) {
    log('warn', `pdf-parse: ${e.message}`)
    return ''
  }
}

// ── IČO helper ─────────────────────────────────────────────────────────────────
function cleanIco(raw) {
  if (!raw) return null
  const d = String(raw).replace(/\D/g, '')
  return d.length >= 6 && d.length <= 12 ? d : null
}

// ── Regex parser ───────────────────────────────────────────────────────────────
function parseRegex(text) {
  const r = {
    supplierName: null, supplierIco: null,
    customerName: null, customerIco: null,
    invoiceNumber: null, variableSymbol: null,
    totalAmount: null, dueDate: null, items: [],
  }
  let m
  m = text.match(/(?:číslo faktúry|faktura č\.?|invoice no\.?|č\.\s*faktúry)[:\s]+([A-Z0-9\/\-]+)/i)
  if (m) r.invoiceNumber = m[1].trim()
  m = text.match(/(?:variabilný symbol|variable symbol|VS)[:\s]+([\d\/\-]+)/i)
  r.variableSymbol = m ? m[1].trim() : r.invoiceNumber
  m = text.match(/(?:celkom|spolu|total|suma celkom|k úhrade)[:\s]+([\d\s]+[.,]\d{2})\s*(?:EUR|€)?/i)
  if (m) { const n = parseFloat(m[1].replace(/\s/g, '').replace(',', '.')); if (!isNaN(n)) r.totalAmount = n }
  m = text.match(/(?:dátum splatnosti|splatné do|due date)[:\s]+(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4})/i)
  if (m) r.dueDate = m[1].trim()
  m = text.match(/(?:dodávateľ|predávajúci|supplier)[:\s]*\n?([^\n]{3,80})/i)
  if (m) r.supplierName = m[1].trim()
  m = text.match(/(?:odberateľ|kupujúci|customer|buyer)[:\s]*\n?([^\n]{3,80})/i)
  if (m) r.customerName = m[1].trim()
  m = text.match(/IČO[:\s]+(\d{6,12})/i)
  if (m) r.supplierIco = cleanIco(m[1])
  const filled = ['supplierName','customerName','invoiceNumber','totalAmount','dueDate'].filter(k => r[k] != null).length
  r._complete = filled >= 3
  return r
}

// ── OpenAI parser ──────────────────────────────────────────────────────────────
async function parseOpenAI(text, apiKey) {
  const prompt = [
    'Extrahuj z textu faktúry tieto polia ako JSON:',
    'supplierName, supplierIco, customerName, customerIco,',
    'invoiceNumber, variableSymbol (ak chýba použi invoiceNumber),',
    'totalAmount (číslo), dueDate (DD.MM.YYYY),',
    'items [{name, qty, unit, unit_price, total}].',
    'IČO = 6-8 číslic. Chýbajúce pole = null. Iba JSON.',
    '', 'TEXT:', text.slice(0, 4000),
  ].join('\n')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 30000)
  let resp
  try {
    resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini', temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: ctrl.signal,
    })
  } finally { clearTimeout(t) }

  const data    = await resp.json()
  const usage   = data.usage || {}
  const pt      = usage.prompt_tokens     || 0
  const ct      = usage.completion_tokens || 0
  const content = data.choices?.[0]?.message?.content || '{}'
  const parsed  = JSON.parse(content)
  parsed.supplierIco = cleanIco(parsed.supplierIco)
  parsed.customerIco = cleanIco(parsed.customerIco)
  if (!parsed.variableSymbol && parsed.invoiceNumber) parsed.variableSymbol = parsed.invoiceNumber
  parsed._complete = true
  return { parsed, promptTokens: pt, completionTokens: ct, costUsd: pt * PRICE_IN + ct * PRICE_OUT,
           requestPreview: prompt.slice(0, 1000), responsePreview: content.slice(0, 1000) }
}

// ── Direction ──────────────────────────────────────────────────────────────────
function detectDirection(parsed, companyIco, companyName) {
  const sIco  = (parsed.supplierIco  || '').trim()
  const sName = (parsed.supplierName || '').toLowerCase()
  if (companyIco  && companyIco === sIco)                        return 'odberatel'
  if (companyIco  && sName.includes(companyIco))                 return 'odberatel'
  if (companyName && sName.includes(companyName.toLowerCase()))  return 'odberatel'
  return 'dodavatel'
}

// ── Duplicate check ────────────────────────────────────────────────────────────
async function findDuplicate(parsed) {
  const vs     = (parsed.variableSymbol || parsed.invoiceNumber || '').trim()
  const amount = parsed.totalAmount
  if (!vs || amount == null) return null
  const where = { variableSymbol: vs, totalAmount: amount, isDuplicate: false }
  const sIco  = (parsed.supplierIco  || '').trim()
  const sName = (parsed.supplierName || '').trim()
  if (sIco) {
    const h = await prisma.invoiceOcrResult.findFirst({ where: { ...where, supplierIco: sIco } })
    if (h) return h
  }
  if (sName) {
    const h = await prisma.invoiceOcrResult.findFirst({ where: { ...where, supplierName: { equals: sName, mode: 'insensitive' } } })
    if (h) return h
  }
  return null
}

// ── Process one PDF ────────────────────────────────────────────────────────────
async function processPdf(att, sender, subject, settings) {
  const receivedLog = await prisma.receivedInvoiceLog.create({
    data: { fromEmail: sender || '', subject: (subject || '').slice(0, 255), filename: att.filename, status: 'processing' },
  })

  try {
    const text  = await extractText(att.content)
    let pdata   = parseRegex(text)
    let method  = 'regex'
    let aiLogId = null

    if (!pdata._complete && settings['openai_api_key']) {
      try {
        const ai    = await parseOpenAI(text, settings['openai_api_key'])
        const aiLog = await prisma.aiApiLog.create({
          data: { model: 'gpt-4o-mini', promptTokens: ai.promptTokens, completionTokens: ai.completionTokens,
                  costUsd: ai.costUsd, requestPreview: ai.requestPreview, responsePreview: ai.responsePreview },
        })
        aiLogId = aiLog.id
        pdata   = ai.parsed
        method  = 'openai'
      } catch (e) {
        log('error', `OpenAI: ${e.message}`)
        await prisma.aiApiLog.create({ data: { model: 'gpt-4o-mini', error: String(e.message).slice(0, 500) } })
      }
    }

    const direction   = detectDirection(pdata, settings['company_ico'] || '', settings['company_name'] || '')
    const duplicate   = await findDuplicate(pdata)
    const isDuplicate = !!duplicate

    // stockStatus: 'na' pre odberateľa, 'pending' pre dodávateľa, 'na' pre duplicitu
    const stockStatus = isDuplicate ? 'na' : direction === 'dodavatel' ? 'pending' : 'na'

    const ocr = await prisma.invoiceOcrResult.create({
      data: {
        direction, supplierName: pdata.supplierName || null, supplierIco: pdata.supplierIco || null,
        customerName: pdata.customerName || null, customerIco: pdata.customerIco || null,
        invoiceNumber: pdata.invoiceNumber || null, variableSymbol: pdata.variableSymbol || null,
        totalAmount: pdata.totalAmount ?? null, dueDate: pdata.dueDate || null,
        items: pdata.items?.length ? JSON.stringify(pdata.items) : null,
        sourceEmail: sender, filename: att.filename, recognitionMethod: method,
        error: pdata.error || null, isDuplicate, duplicateOfId: duplicate?.id || null,
        stockStatus,
      },
    })

    if (aiLogId) await prisma.aiApiLog.update({ where: { id: aiLogId }, data: { invoiceOcrResultId: ocr.id } })

    await prisma.receivedInvoiceLog.update({
      where: { id: receivedLog.id },
      data: { status: pdata.error ? 'error' : 'processed', error: pdata.error || null, invoiceOcrResultId: ocr.id },
    })

    log('info', `${att.filename}: ${direction}${isDuplicate ? ' [DUPLIKÁT]' : ''} ${pdata.invoiceNumber || '—'} ${pdata.totalAmount ? pdata.totalAmount + '€' : ''}`)
  } catch (e) {
    log('error', `Chyba ${att.filename}: ${e.message}`)
    await prisma.receivedInvoiceLog.update({
      where: { id: receivedLog.id },
      data: { status: 'error', error: String(e.message).slice(0, 500) },
    })
  }
}

// ── Poll ───────────────────────────────────────────────────────────────────────
async function poll() {
  const settings = await loadSettings()
  if (settings['invoice_ocr_enabled'] !== 'true') {
    log('info', 'OCR faktúr nie je aktivované (invoice_ocr_enabled != true)')
    return
  }
  const host = settings['email_imap_host']
  const user = settings['email_imap_user']
  const pass = settings['email_imap_pass']
  if (!host || !user || !pass) {
    log('warn', 'IMAP nie je nakonfigurovaný — nastav email_imap_* nastavenia')
    return
  }

  const imap = new ImapFlow({
    host, port: parseInt(settings['email_imap_port'] || '993'),
    secure: settings['email_imap_secure'] !== 'false',
    auth: { user, pass }, logger: false,
  })

  try {
    await imap.connect()
    const lock = await imap.getMailboxLock('INBOX')
    const processed = loadProcessed()

    try {
      // Hľadáme všetky maily za posledných 30 dní (seen aj unseen)
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const uids  = await imap.search({ since })
      let newCount = 0

      for await (const msg of imap.fetch(uids, { source: true, envelope: true })) {
        const msgId = msg.envelope?.messageId || null
        if (msgId && processed.has(msgId)) continue

        try {
          const parsed = await simpleParser(msg.source)
          const sender = (() => {
            const v = Array.isArray(parsed.from?.value) ? parsed.from.value[0] : parsed.from?.value
            return v?.address?.toLowerCase().trim() || null
          })()
          const subject = (parsed.subject || '').trim()
          const pdfs = (parsed.attachments || []).filter(
            a => a.contentType === 'application/pdf' || (a.filename || '').toLowerCase().endsWith('.pdf')
          )

          if (pdfs.length > 0) {
            log('info', `Mail od ${sender}: ${pdfs.length} PDF — "${subject}"`)
            for (const att of pdfs) await processPdf(att, sender, subject, settings)
            newCount++
          }
        } catch (e) {
          log('error', `Chyba spracovania správy: ${e.message}`)
        }

        if (msgId) { processed.add(msgId); saveProcessed(processed) }
      }

      if (newCount === 0) log('info', 'Žiadne nové PDF prílohy')
      else log('info', `Spracovaných ${newCount} emailov s PDF`)
    } finally {
      lock.release()
    }

    await imap.logout()
  } catch (e) {
    log('error', `IMAP: ${e.message}`)
    try { await imap.logout() } catch {}
  }
}

async function main() {
  log('info', `Invoice OCR poller štartuje. Interval: ${POLL_INTERVAL / 1000}s`)
  await poll()
  setInterval(async () => {
    try { await poll() } catch (e) { log('error', `Unhandled: ${e.message}`) }
  }, POLL_INTERVAL)
}
main().catch(e => { log('error', `Fatal: ${e}`); process.exit(1) })
