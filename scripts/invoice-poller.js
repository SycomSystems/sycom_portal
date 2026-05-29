/**
 * invoice-poller.js
 * PM2 process — every 5 minutes:
 *   1. Reads invoice_imap_* settings from DB
 *   2. Connects via IMAP, fetches UNSEEN emails with PDF attachments
 *   3. Extracts text via pdf-parse
 *   4. Parses with regex; falls back to GPT-4o-mini if incomplete
 *   5. Duplicate check (variable_symbol + total_amount + supplier)
 *   6. Saves InvoiceOcrResult, ReceivedInvoiceLog, AiApiLog
 *   7. If dodavatel: creates StockMovement(BUY) + StockItem if needed
 *
 * Start:
 *   pm2 start scripts/invoice-poller.js --name invoice-poller
 *   pm2 save
 */

'use strict'

const { ImapFlow }     = require('imapflow')
const { simpleParser } = require('mailparser')
const { PrismaClient } = require('@prisma/client')
const pdfParse         = require('pdf-parse')
const fs               = require('fs')
const path             = require('path')

const prisma        = new PrismaClient()
const POLL_INTERVAL = 5 * 60 * 1000
const LOG_DIR       = '/opt/sycom-portal/logs'
const PRICE_IN      = 0.15 / 1_000_000
const PRICE_OUT     = 0.60 / 1_000_000

// ── Logging ────────────────────────────────────────────────────────────────────
function log(level, msg) {
  const ts    = new Date().toISOString()
  const entry = JSON.stringify({ ts, level, msg })
  if (level === 'error') console.error(msg)
  else console.log(msg)
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
    log('warn', `[invoice] pdf-parse error: ${e.message}`)
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

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30000),
  })

  const data = await resp.json()
  const usage   = data.usage || {}
  const pt      = usage.prompt_tokens || 0
  const ct      = usage.completion_tokens || 0
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
  if (companyIco  && companyIco === supplierIco)                 return 'odberatel'
  if (companyIco  && supplierName.includes(companyIco))          return 'odberatel'
  if (companyName && supplierName.includes(companyName.toLowerCase())) return 'odberatel'
  return 'dodavatel'
}

// ── Duplicate check ────────────────────────────────────────────────────────────
async function findDuplicate(parsed, excludeId) {
  const vs     = (parsed.variableSymbol || parsed.invoiceNumber || '').trim()
  const amount = parsed.totalAmount
  if (!vs || amount == null) return null

  const where = {
    variableSymbol: vs,
    totalAmount: amount,
    isDuplicate: false,
  }
  if (excludeId) where.id = { not: excludeId }

  const supplierIco  = (parsed.supplierIco  || '').trim()
  const supplierName = (parsed.supplierName || '').trim()

  if (supplierIco) {
    const byIco = await prisma.invoiceOcrResult.findFirst({ where: { ...where, supplierIco } })
    if (byIco) return byIco
  }
  if (supplierName) {
    const byName = await prisma.invoiceOcrResult.findFirst({
      where: { ...where, supplierName: { equals: supplierName, mode: 'insensitive' } },
    })
    if (byName) return byName
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
    const unitRaw  = (item.unit || 'ks').toLowerCase().trim()
    const unit     = UNIT_MAP[unitRaw] || 'ks'
    const price    = parseFloat(item.unit_price) || 0

    let stockItem = await prisma.stockItem.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    })

    if (!stockItem) {
      stockItem = await prisma.stockItem.create({
        data: { name, unit, lastPurchasePrice: price, avgPurchasePrice: price },
      })
      log('info', `[invoice] Created StockItem: ${name}`)
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
        lastPurchasePrice: price > 0 ? price : undefined,
      },
    })
    added++
  }
  return added
}

// ── Process single email ───────────────────────────────────────────────────────
async function processInvoiceEmail(msg, settings) {
  const parsed  = await simpleParser(msg.source)
  const sender  = (() => {
    const raw = parsed.from?.value
    const v   = Array.isArray(raw) ? raw[0] : raw
    return v?.address?.toLowerCase().trim() || null
  })()

  const subject = (parsed.subject || '').trim()

  // Only process emails with PDF attachments
  const pdfs = (parsed.attachments || []).filter(
    a => a.contentType === 'application/pdf' || (a.filename || '').toLowerCase().endsWith('.pdf')
  )
  if (pdfs.length === 0) return

  log('info', `[invoice] Processing "${subject}" from ${sender} — ${pdfs.length} PDF(s)`)

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true }, orderBy: { createdAt: 'asc' } })
  const adminId   = adminUser?.id

  for (const att of pdfs) {
    const receivedLog = await prisma.receivedInvoiceLog.create({
      data: { fromEmail: sender || '', subject: subject.slice(0, 255), filename: att.filename, status: 'processing' },
    })

    let ocrResult = null
    try {
      const text    = await extractText(att.content)
      let   pdata   = parseRegex(text)
      let   method  = 'regex'
      let   aiLogId = null

      if (!pdata._complete) {
        const openaiKey = settings['openai_api_key']
        if (!openaiKey) {
          log('warn', '[invoice] OpenAI kľúč nie je nastavený — zostávam pri regex výsledku')
        } else {
          try {
            const aiResult = await parseOpenAI(text, openaiKey)
            // Ulož AI log bez OCR FK (nastavíme po flush)
            const aiLog = await prisma.aiApiLog.create({
              data: {
                model: 'gpt-4o-mini',
                promptTokens:    aiResult.promptTokens,
                completionTokens: aiResult.completionTokens,
                costUsd:         aiResult.costUsd,
                requestPreview:  aiResult.requestPreview,
                responsePreview: aiResult.responsePreview,
              },
            })
            aiLogId = aiLog.id
            pdata  = aiResult.parsed
            method = 'openai'
          } catch (e) {
            log('error', `[invoice] OpenAI call failed: ${e.message}`)
            await prisma.aiApiLog.create({
              data: { model: 'gpt-4o-mini', error: String(e.message).slice(0, 500) },
            })
          }
        }
      }

      const direction  = detectDirection(pdata, settings['company_ico'] || '', settings['company_name'] || '')
      const duplicate  = await findDuplicate(pdata, null)
      const isDuplicate = !!duplicate

      ocrResult = await prisma.invoiceOcrResult.create({
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
          items:             pdata.items?.length ? JSON.stringify(pdata.items) : null,
          sourceEmail:       sender,
          filename:          att.filename,
          recognitionMethod: method,
          error:             pdata.error || null,
          isDuplicate,
          duplicateOfId:     duplicate?.id || null,
        },
      })

      // Aktualizuj FK na AI log
      if (aiLogId) {
        await prisma.aiApiLog.update({ where: { id: aiLogId }, data: { invoiceOcrResultId: ocrResult.id } })
      }

      if (isDuplicate) {
        log('warn', `[invoice] Duplicitná faktúra: VS=${pdata.variableSymbol} suma=${pdata.totalAmount} (originál: ${duplicate.id})`)
      } else {
        if (direction === 'dodavatel' && !pdata.error && adminId) {
          const added = await addItemsToStock(ocrResult, adminId)
          if (added) log('info', `[invoice] Pridaných ${added} skladových pohybov`)
        }
      }

      await prisma.receivedInvoiceLog.update({
        where: { id: receivedLog.id },
        data: { status: pdata.error ? 'error' : 'processed', error: pdata.error || null, invoiceOcrResultId: ocrResult.id },
      })

    } catch (e) {
      log('error', `[invoice] Chyba spracovania ${att.filename}: ${e.message}`)
      await prisma.receivedInvoiceLog.update({
        where: { id: receivedLog.id },
        data: { status: 'error', error: String(e.message).slice(0, 500) },
      })
    }
  }
}

// ── Main poll cycle ────────────────────────────────────────────────────────────
async function poll() {
  const settings = await loadSettings()

  if (settings['invoice_imap_enabled'] !== 'true') {
    log('info', '[invoice] Disabled — skipping cycle.')
    return
  }

  const imap = new ImapFlow({
    host:   settings['invoice_imap_host'],
    port:   parseInt(settings['invoice_imap_port'] || '993'),
    secure: settings['invoice_imap_secure'] !== 'false',
    auth: {
      user: settings['invoice_imap_user'],
      pass: settings['invoice_imap_pass'],
    },
    logger: false,
  })

  try {
    await imap.connect()
    log('info', '[invoice] Connected to IMAP.')

    const mailbox = settings['invoice_imap_mailbox'] || 'INBOX'
    const lock    = await imap.getMailboxLock(mailbox)
    try {
      const uids = await imap.search({ seen: false })
      log('info', `[invoice] Found ${uids.length} unseen message(s).`)

      for await (const msg of imap.fetch(uids, { source: true })) {
        try {
          await processInvoiceEmail(msg, settings)
        } catch (e) {
          log('error', `[invoice] Error: ${e.message}`)
        }
        await imap.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'])
      }
    } finally {
      lock.release()
    }

    await imap.logout()
    log('info', '[invoice] Disconnected.')
  } catch (e) {
    log('error', `[invoice] IMAP error: ${e.message}`)
    try { await imap.logout() } catch {}
  }
}

async function main() {
  log('info', '[invoice] Starting invoice poller.')
  await poll()
  setInterval(async () => {
    try { await poll() } catch (e) { log('error', `[invoice] Unhandled: ${e.message}`) }
  }, POLL_INTERVAL)
}

main().catch(e => { log('error', `[invoice] Fatal: ${e}`); process.exit(1) })
