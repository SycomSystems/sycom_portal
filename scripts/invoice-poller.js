/**
 * invoice-poller.js
 * PM2 process — každých 5 minút:
 *   1. Načíta invoice_imap_* nastavenia z DB
 *   2. Pripojí sa na IMAP, stiahne UNSEEN emaily s PDF prílohami
 *   3. Extrahuje text cez pdf-parse@1.1.1
 *   4. Parsuje regex; fallback na GPT-4o-mini
 *   5. Duplicate check (variableSymbol + totalAmount + supplier)
 *   6. Uloží InvoiceOcrResult, ReceivedInvoiceLog, AiApiLog
 *   7. Ak dodavatel → StockMovement(BUY) + StockItem ak neexistuje
 *
 * DÔLEŽITÉ — koexistencia s email-pollerom:
 *   email-poller.js číta z INBOX a vytvára tikety zo VŠETKÝCH emailov.
 *   invoice-poller číta z INÉHO priečinka (invoice_imap_mailbox, default: INBOX/Faktury).
 *   Na mail serveri (mail.sycom.sk) treba vytvoriť pravidlo:
 *     "Ak príloha je PDF a odosielateľ je dodávateľ → presunúť do INBOX/Faktury"
 *   Tak email-poller nevytvorí tiket z faktúry a invoice-poller ju spracuje.
 *
 * Spustenie:
 *   pm2 start scripts/invoice-poller.js --name invoice-poller --cwd /opt/sycom-portal
 *   pm2 save
 */

'use strict'

const { ImapFlow }     = require('imapflow')
const { simpleParser } = require('mailparser')
const { PrismaClient } = require('@prisma/client')
const pdfParse         = require('pdf-parse')  // musí byť verzia 1.1.1 (nie 2.x)
const fs               = require('fs')
const path             = require('path')

const prisma        = new PrismaClient()
const POLL_INTERVAL = 5 * 60 * 1000
const PRICE_IN      = 0.15 / 1_000_000
const PRICE_OUT     = 0.60 / 1_000_000

// Log do rovnakého adresára ako ostatné pollery
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs')

// ── Logging ────────────────────────────────────────────────────────────────────
function log(level, msg) {
  const ts    = new Date().toISOString()
  const entry = JSON.stringify({ ts, level, msg })
  if (level === 'error') console.error(`[invoice] ${msg}`)
  else console.log(`[invoice] ${msg}`)
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
    const month = ts.slice(0, 7)
    fs.appendFileSync(path.join(LOG_DIR, `invoice-poller-${month}.json`), entry + '\n')
  } catch (_) {}
}

// ── Settings ───────────────────────────────────────────────────────────────────
async function loadSettings() {
  const keys = [
    'invoice_imap_host', 'invoice_imap_port', 'invoice_imap_user',
    'invoice_imap_pass', 'invoice_imap_mailbox', 'invoice_imap_enabled',
    'invoice_imap_secure',
    'openai_api_key', 'openai_credit_threshold', 'openai_credit_notify_users',
    'company_ico', 'company_name',
  ]
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } })
  const s = {}
  for (const r of rows) s[r.key] = r.value
  return s
}

// ── PDF text extraction ────────────────────────────────────────────────────────
async function extractText(buffer) {
  try {
    const data = await pdfParse(buffer)
    return data.text || ''
  } catch (e) {
    log('warn', `pdf-parse chyba: ${e.message}`)
    return ''
  }
}

// ── IČO cleaner ────────────────────────────────────────────────────────────────
function cleanIco(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  return digits.length >= 6 && digits.length <= 12 ? digits : null
}

// ── Regex parser ───────────────────────────────────────────────────────────────
function parseRegex(text) {
  const result = {
    supplierName: null, supplierIco: null,
    customerName: null, customerIco: null,
    invoiceNumber: null, variableSymbol: null,
    totalAmount: null, dueDate: null, items: [],
  }

  let m
  m = text.match(/(?:číslo faktúry|faktura č\.?|invoice no\.?|č\.\s*faktúry)[:\s]+([A-Z0-9\/\-]+)/i)
  if (m) result.invoiceNumber = m[1].trim()

  m = text.match(/(?:variabilný symbol|variable symbol|VS)[:\s]+([\d\/\-]+)/i)
  if (m) result.variableSymbol = m[1].trim()
  if (!result.variableSymbol && result.invoiceNumber) result.variableSymbol = result.invoiceNumber

  m = text.match(/(?:celkom|spolu|total|suma celkom|k úhrade)[:\s]+([\d\s]+[.,]\d{2})\s*(?:EUR|€)?/i)
  if (m) {
    const raw = m[1].replace(/\s/g, '').replace(',', '.')
    const n = parseFloat(raw)
    if (!isNaN(n)) result.totalAmount = n
  }

  m = text.match(/(?:dátum splatnosti|splatné do|due date)[:\s]+(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4})/i)
  if (m) result.dueDate = m[1].trim()

  m = text.match(/(?:dodávateľ|predávajúci|supplier)[:\s]*\n?([^\n]{3,80})/i)
  if (m) result.supplierName = m[1].trim()

  m = text.match(/(?:odberateľ|kupujúci|customer|buyer)[:\s]*\n?([^\n]{3,80})/i)
  if (m) result.customerName = m[1].trim()

  m = text.match(/IČO[:\s]+(\d{6,12})/i)
  if (m) result.supplierIco = cleanIco(m[1])

  const filled = ['supplierName','customerName','invoiceNumber','totalAmount','dueDate']
    .filter(k => result[k] != null).length
  result._complete = filled >= 3
  return result
}

// ── OpenAI parser ──────────────────────────────────────────────────────────────
async function parseOpenAI(text, apiKey) {
  const prompt = [
    'Extrahuj z nasledujúceho textu faktúry tieto polia ako JSON objekt:',
    'supplierName, supplierIco, customerName, customerIco,',
    'invoiceNumber, variableSymbol (variabilný symbol pre platbu, ak chýba použi invoiceNumber),',
    'totalAmount (číslo bez meny), dueDate (string DD.MM.YYYY),',
    'items (pole objektov: name, qty, unit, unit_price, total).',
    'IČO je 6-8 miestne číslo. Ak pole nenájdeš, nastav null. Vráť IBA JSON.',
    '',
    'TEXT:',
    text.slice(0, 4000),
  ].join('\n')

  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), 30000)

  let resp
  try {
    resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model:           'gpt-4o-mini',
        temperature:     0,
        response_format: { type: 'json_object' },
        messages:        [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  const data    = await resp.json()
  const usage   = data.usage || {}
  const pt      = usage.prompt_tokens      || 0
  const ct      = usage.completion_tokens  || 0
  const costUsd = pt * PRICE_IN + ct * PRICE_OUT
  const content = data.choices?.[0]?.message?.content || '{}'
  const parsed  = JSON.parse(content)

  parsed.supplierIco = cleanIco(parsed.supplierIco)
  parsed.customerIco = cleanIco(parsed.customerIco)
  if (!parsed.variableSymbol && parsed.invoiceNumber) parsed.variableSymbol = parsed.invoiceNumber
  parsed._complete = true

  return { parsed, promptTokens: pt, completionTokens: ct, costUsd, requestPreview: prompt.slice(0, 1000), responsePreview: content.slice(0, 1000) }
}

// ── Detect direction ───────────────────────────────────────────────────────────
function detectDirection(parsed, companyIco, companyName) {
  const supplierIco  = (parsed.supplierIco  || '').trim()
  const supplierName = (parsed.supplierName || '').toLowerCase()
  if (companyIco  && companyIco === supplierIco)                        return 'odberatel'
  if (companyIco  && supplierName.includes(companyIco))                 return 'odberatel'
  if (companyName && supplierName.includes(companyName.toLowerCase()))  return 'odberatel'
  return 'dodavatel'
}

// ── Duplicate check ────────────────────────────────────────────────────────────
async function findDuplicate(parsed, excludeId) {
  const vs     = (parsed.variableSymbol || parsed.invoiceNumber || '').trim()
  const amount = parsed.totalAmount
  if (!vs || amount == null) return null

  const baseWhere = { variableSymbol: vs, totalAmount: amount, isDuplicate: false }
  if (excludeId) baseWhere.id = { not: excludeId }

  const supplierIco  = (parsed.supplierIco  || '').trim()
  const supplierName = (parsed.supplierName || '').trim()

  if (supplierIco) {
    const hit = await prisma.invoiceOcrResult.findFirst({ where: { ...baseWhere, supplierIco } })
    if (hit) return hit
  }
  if (supplierName) {
    const hit = await prisma.invoiceOcrResult.findFirst({
      where: { ...baseWhere, supplierName: { equals: supplierName, mode: 'insensitive' } },
    })
    if (hit) return hit
  }
  return null
}

// ── Stock import ───────────────────────────────────────────────────────────────
const UNIT_MAP = {
  ks: 'ks', pcs: 'ks', pc: 'ks', kus: 'ks', kusov: 'ks', kusy: 'ks',
  piece: 'ks', pieces: 'ks', bal: 'ks', balenie: 'ks',
  m2: 'm2', 'm²': 'm2', m3: 'm3', 'm³': 'm3',
  m: 'm', bm: 'm', lm: 'm', kg: 'kg',
}

async function addItemsToStock(ocr, adminId) {
  if (!ocr.items) return 0
  let items
  try { items = JSON.parse(ocr.items) } catch { return 0 }

  const supplier = ocr.supplierName
    ? await prisma.supplier.findFirst({ where: { name: { equals: ocr.supplierName, mode: 'insensitive' } } })
    : null

  let added = 0
  for (const item of items) {
    const name = (item.name || '').trim()
    if (!name) continue
    const qty = parseFloat(item.qty) || 0
    if (qty <= 0) continue
    const unit  = UNIT_MAP[(item.unit || 'ks').toLowerCase().trim()] || 'ks'
    const price = parseFloat(item.unit_price) || 0

    let stockItem = await prisma.stockItem.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    })
    if (!stockItem) {
      stockItem = await prisma.stockItem.create({
        data: { name, unit, lastPurchasePrice: price, avgPurchasePrice: price },
      })
      log('info', `Vytvorený StockItem: ${name}`)
    }

    await prisma.stockMovement.create({
      data: {
        type:          'BUY',
        stockItemId:   stockItem.id,
        quantity:      qty,
        pricePerUnit:  price,
        totalPrice:    qty * price,
        supplierId:    supplier?.id ?? undefined,
        addedById:     adminId,
        invoiceNumber: ocr.invoiceNumber,
        note: `Auto-príjem z faktúry ${ocr.invoiceNumber || ''} (${ocr.supplierName || ocr.sourceEmail || ''})`,
      },
    })

    await prisma.stockItem.update({
      where: { id: stockItem.id },
      data: {
        currentStock:      { increment: qty },
        ...(price > 0 ? { lastPurchasePrice: price } : {}),
      },
    })
    added++
  }
  return added
}

// ── Process single PDF attachment ──────────────────────────────────────────────
async function processPdfAttachment(att, senderEmail, subject, settings) {
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  const adminId = adminUser?.id

  const receivedLog = await prisma.receivedInvoiceLog.create({
    data: { fromEmail: senderEmail || '', subject: (subject || '').slice(0, 255), filename: att.filename, status: 'processing' },
  })

  try {
    const text   = await extractText(att.content)
    let pdata    = parseRegex(text)
    let method   = 'regex'
    let aiLogId  = null

    if (!pdata._complete) {
      const openaiKey = settings['openai_api_key']
      if (!openaiKey) {
        log('warn', 'OpenAI kľúč nie je nastavený — zostávam pri regex výsledku')
      } else {
        try {
          const ai    = await parseOpenAI(text, openaiKey)
          const aiLog = await prisma.aiApiLog.create({
            data: {
              model: 'gpt-4o-mini',
              promptTokens:     ai.promptTokens,
              completionTokens: ai.completionTokens,
              costUsd:          ai.costUsd,
              requestPreview:   ai.requestPreview,
              responsePreview:  ai.responsePreview,
            },
          })
          aiLogId = aiLog.id
          pdata   = ai.parsed
          method  = 'openai'
        } catch (e) {
          log('error', `OpenAI call zlyhal: ${e.message}`)
          await prisma.aiApiLog.create({ data: { model: 'gpt-4o-mini', error: String(e.message).slice(0, 500) } })
        }
      }
    }

    const direction   = detectDirection(pdata, settings['company_ico'] || '', settings['company_name'] || '')
    const duplicate   = await findDuplicate(pdata, null)
    const isDuplicate = !!duplicate

    const ocrResult = await prisma.invoiceOcrResult.create({
      data: {
        direction,
        supplierName:      pdata.supplierName   || null,
        supplierIco:       pdata.supplierIco    || null,
        customerName:      pdata.customerName   || null,
        customerIco:       pdata.customerIco    || null,
        invoiceNumber:     pdata.invoiceNumber  || null,
        variableSymbol:    pdata.variableSymbol || null,
        totalAmount:       pdata.totalAmount    ?? null,
        dueDate:           pdata.dueDate        || null,
        items:             pdata.items?.length  ? JSON.stringify(pdata.items) : null,
        sourceEmail:       senderEmail,
        filename:          att.filename,
        recognitionMethod: method,
        error:             pdata.error          || null,
        isDuplicate,
        duplicateOfId:     duplicate?.id        || null,
      },
    })

    if (aiLogId) {
      await prisma.aiApiLog.update({ where: { id: aiLogId }, data: { invoiceOcrResultId: ocrResult.id } })
    }

    if (isDuplicate) {
      log('warn', `Duplicitná faktúra: VS=${pdata.variableSymbol} suma=${pdata.totalAmount} (originál: ${duplicate.id})`)
    } else if (direction === 'dodavatel' && !pdata.error && adminId) {
      const added = await addItemsToStock(ocrResult, adminId)
      if (added) log('info', `Pridaných ${added} skladových pohybov`)
    }

    await prisma.receivedInvoiceLog.update({
      where: { id: receivedLog.id },
      data:  { status: pdata.error ? 'error' : 'processed', error: pdata.error || null, invoiceOcrResultId: ocrResult.id },
    })

    log('info', `Spracovaná faktúra: ${pdata.invoiceNumber || '—'} od ${pdata.supplierName || senderEmail} — ${direction}${isDuplicate ? ' [DUPLIKÁT]' : ''}`)

  } catch (e) {
    log('error', `Chyba spracovania ${att.filename}: ${e.message}`)
    await prisma.receivedInvoiceLog.update({
      where: { id: receivedLog.id },
      data:  { status: 'error', error: String(e.message).slice(0, 500) },
    })
  }
}

// ── Main poll cycle ────────────────────────────────────────────────────────────
async function poll() {
  const settings = await loadSettings()

  if (settings['invoice_imap_enabled'] !== 'true') {
    log('info', 'Poller nie je aktivovaný (invoice_imap_enabled != true)')
    return
  }

  const host    = settings['invoice_imap_host']
  const user    = settings['invoice_imap_user']
  const pass    = settings['invoice_imap_pass']
  const mailbox = settings['invoice_imap_mailbox'] || 'INBOX/Faktury'

  if (!host || !user || !pass) {
    log('warn', 'IMAP nie je nakonfigurovaný — chýba host/user/pass')
    return
  }

  const imap = new ImapFlow({
    host,
    port:   parseInt(settings['invoice_imap_port'] || '993'),
    secure: settings['invoice_imap_secure'] !== 'false',
    auth:   { user, pass },
    logger: false,
  })

  try {
    await imap.connect()
    log('info', `Pripojený na IMAP ${host}, priečinok: ${mailbox}`)

    let lock
    try {
      lock = await imap.getMailboxLock(mailbox)
    } catch (e) {
      // Priečinok neexistuje — informuj užívateľa
      log('error', `Priečinok "${mailbox}" neexistuje na IMAP serveri. Vytvor ho alebo zmeň nastavenie invoice_imap_mailbox.`)
      await imap.logout()
      return
    }

    try {
      const uids = await imap.search({ seen: false })
      log('info', `Nové správy: ${uids.length}`)

      for await (const msg of imap.fetch(uids, { source: true })) {
        try {
          const parsed = await simpleParser(msg.source)
          const sender = (() => {
            const raw = parsed.from?.value
            const v   = Array.isArray(raw) ? raw[0] : raw
            return v?.address?.toLowerCase().trim() || null
          })()
          const subject = (parsed.subject || '').trim()

          const pdfs = (parsed.attachments || []).filter(
            a => a.contentType === 'application/pdf' || (a.filename || '').toLowerCase().endsWith('.pdf')
          )

          if (pdfs.length === 0) {
            log('info', `Email bez PDF príloh od ${sender} — preskakujem`)
          } else {
            log('info', `Spracúvam email od ${sender}: "${subject}" — ${pdfs.length} PDF`)
            for (const att of pdfs) {
              await processPdfAttachment(att, sender, subject, settings)
            }
          }
          await imap.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'])
        } catch (e) {
          log('error', `Chyba spracovania správy: ${e.message}`)
        }
      }
    } finally {
      lock.release()
    }

    await imap.logout()
    log('info', 'Odpojený od IMAP.')
  } catch (e) {
    log('error', `IMAP chyba: ${e.message}`)
    try { await imap.logout() } catch {}
  }
}

async function main() {
  log('info', `Invoice poller štartuje. Interval: ${POLL_INTERVAL / 1000}s`)
  await poll()
  setInterval(async () => {
    try { await poll() } catch (e) { log('error', `Unhandled: ${e.message}`) }
  }, POLL_INTERVAL)
}

main().catch(e => { log('error', `Fatal: ${e}`); process.exit(1) })
