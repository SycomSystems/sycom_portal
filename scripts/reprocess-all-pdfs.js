'use strict'
const { PrismaClient } = require('@prisma/client')
const pdfParse = require('pdf-parse')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()
const INVOICES_DIR = path.join(__dirname, '..', 'public', 'uploads', 'invoices')
const PRICE_IN = 0.15 / 1_000_000
const PRICE_OUT = 0.60 / 1_000_000

function cleanIco(raw) {
  if (!raw) return null
  const d = String(raw).replace(/\D/g, '')
  return d.length >= 6 && d.length <= 12 ? d : null
}

async function extractText(buffer) {
  try { const d = await pdfParse(buffer); return d.text || '' }
  catch { return '' }
}

async function callOpenAI(text, apiKey) {
  const prompt = [
    'Extrahuj z textu faktúry tieto polia ako JSON:',
    'supplierName, supplierIco, customerName, customerIco,',
    'invoiceNumber, variableSymbol (ak chýba použi invoiceNumber),',
    'totalAmount (číslo), issueDate (dátum vystavenia DD.MM.YYYY), dueDate (dátum splatnosti DD.MM.YYYY),',
    'items [{name, qty, unit, unit_price, total}].',
    'IČO = 6-8 číslic. Chýbajúce pole = null. Iba JSON.',
    '', 'TEXT:', text.slice(0, 4000),
  ].join('\n')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 30000)
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini', temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: ctrl.signal,
    })
    const data = await resp.json()
    const usage = data.usage || {}
    const content = data.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    parsed.supplierIco = cleanIco(parsed.supplierIco)
    parsed.customerIco = cleanIco(parsed.customerIco)
    if (!parsed.variableSymbol && parsed.invoiceNumber) parsed.variableSymbol = parsed.invoiceNumber
    return {
      parsed,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      cost: ((usage.prompt_tokens || 0) * PRICE_IN + (usage.completion_tokens || 0) * PRICE_OUT),
    }
  } finally { clearTimeout(t) }
}

async function detectDirection(parsed, ownCompanies) {
  const sIco  = (parsed.supplierIco  || '').trim()
  const sName = (parsed.supplierName || '').toLowerCase()
  for (const c of ownCompanies) {
    if (sIco && c.ico === sIco) return 'odberatel'
    if (sName && sName.includes(c.name.toLowerCase().split(' ')[0])) return 'odberatel'
  }
  return 'dodavatel'
}

async function findDuplicate(parsed) {
  const vs = (parsed.variableSymbol || parsed.invoiceNumber || '').trim()
  const amount = parsed.totalAmount
  if (!vs || amount == null) return null
  const where = { variableSymbol: vs, totalAmount: amount, isDuplicate: false }
  const sIco = (parsed.supplierIco || '').trim()
  const sName = (parsed.supplierName || '').trim()
  if (sIco) {
    const h = await prisma.invoiceOcrResult.findFirst({ where: { ...where, supplierIco: sIco } })
    if (h) return h
  }
  if (sName) {
    const h = await prisma.invoiceOcrResult.findFirst({ where: { ...where, supplierName: { equals: sName } } })
    if (h) return h
  }
  return null
}

async function main() {
  const settingRows = await prisma.setting.findMany({
    where: { key: { in: ['openai_api_key'] } }
  })
  const settings = {}
  settingRows.forEach(r => settings[r.key] = r.value)
  const apiKey = settings['openai_api_key']
  if (!apiKey) { console.error('Chýba openai_api_key'); process.exit(1) }

  const ownCompanies = await prisma.ownCompany.findMany()
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { id: 'asc' } })

  const files = fs.readdirSync(INVOICES_DIR).filter(f => f.endsWith('.pdf')).sort()
  console.log(`Spracovávam ${files.length} PDF súborov...`)

  let processed = 0, duplicates = 0, errors = 0, totalCost = 0

  for (const filename of files) {
    const filePath = `/uploads/invoices/${filename}`
    const fullPath = path.join(INVOICES_DIR, filename)
    process.stdout.write(`  ${filename}: `)

    try {
      const buffer = fs.readFileSync(fullPath)
      const text = await extractText(buffer)
      const ai = await callOpenAI(text, apiKey)
      const pdata = ai.parsed
      totalCost += ai.cost

      const direction = await detectDirection(pdata, ownCompanies)
      const duplicate = await findDuplicate(pdata)
      const isDuplicate = !!duplicate
      const stockStatus = isDuplicate ? 'na' : direction === 'dodavatel' ? 'pending' : 'na'

      await prisma.invoiceOcrResult.create({
        data: {
          direction,
          supplierName: pdata.supplierName || null,
          supplierIco:  pdata.supplierIco  || null,
          customerName: pdata.customerName || null,
          customerIco:  pdata.customerIco  || null,
          invoiceNumber:  pdata.invoiceNumber  || null,
          variableSymbol: pdata.variableSymbol || null,
          totalAmount: pdata.totalAmount ?? null,
          issueDate:   pdata.issueDate  || null,
          dueDate:     pdata.dueDate    || null,
          items: pdata.items?.length ? JSON.stringify(pdata.items) : null,
          sourceEmail: null,
          filename,
          filePath,
          recognitionMethod: 'openai',
          isDuplicate,
          duplicateOfId: duplicate?.id || null,
          stockStatus,
        },
      })

      if (isDuplicate) {
        console.log(`DUPLIKÁT ${pdata.invoiceNumber || '?'} ${pdata.totalAmount}€`)
        duplicates++
      } else {
        console.log(`OK [${direction}] ${pdata.invoiceNumber || '?'} ${pdata.totalAmount}€ vydanie:${pdata.issueDate || '?'}`)
        processed++
      }
    } catch (e) {
      console.log(`CHYBA: ${e.message}`)
      errors++
    }

    // Small delay to avoid OpenAI rate limits
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\nDokončené: ${processed} nových | ${duplicates} duplikátov | ${errors} chýb`)
  console.log(`Celkové náklady OpenAI: $${totalCost.toFixed(4)}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
