import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as fs from 'fs'
import * as path from 'path'

const PRICE_IN  = 0.15 / 1_000_000
const PRICE_OUT = 0.60 / 1_000_000

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ocr = await prisma.invoiceOcrResult.findUnique({ where: { id: params.id } })
  if (!ocr) return NextResponse.json({ error: 'Nenájdené' }, { status: 404 })
  if (!ocr.filePath)
    return NextResponse.json({ error: 'PDF nie je uložené — faktúru treba znovu poslať emailom' }, { status: 400 })

  const absPath = path.join(process.cwd(), 'public', ocr.filePath.replace(/^\//, ''))
  if (!fs.existsSync(absPath))
    return NextResponse.json({ error: `Súbor nenájdený: ${ocr.filePath}` }, { status: 404 })

  // Extract text
  let text = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const data = await pdfParse(fs.readFileSync(absPath))
    text = data.text || ''
  } catch (e: any) {
    return NextResponse.json({ error: `PDF parse zlyhal: ${e.message}` }, { status: 500 })
  }

  if (!text.trim())
    return NextResponse.json({ error: 'PDF neobsahuje čitateľný text — je pravdepodobne skenovaný obrázok (nie textový PDF)', extractedText: '' }, { status: 422 })

  const keyRow = await prisma.setting.findUnique({ where: { key: 'openai_api_key' } })
  if (!keyRow?.value) return NextResponse.json({ error: 'OpenAI API kľúč nie je nastavený' }, { status: 400 })

  // Supplier hint
  const hint = ocr.supplierName
    ? await prisma.supplierHint.findUnique({ where: { supplierName: ocr.supplierName } }).catch(() => null)
    : null
  const hintLine = hint?.hint ? `\nDôležité pre tohto dodávateľa: ${hint.hint}` : ''

  const prompt = [
    'Extrahuj z textu slovenskej faktúry nasledujúce polia ako JSON objekt.',
    '',
    'DÔLEŽITÉ — špecifiká slovenských PDF faktúr:',
    '- Text je extrahovaný z PDF, poradie textu NEMUSÍ zodpovedať vizuálnemu rozloženiu faktúry',
    '- Dodávateľ (supplierName) = kto faktúru VYSTAVIL; Odberateľ (customerName) = PRÍJEMCA faktúry',
    '- Blok s adresou odberateľa sa v texte môže objaviť PRED labelom "Odberateľ:" — hľadaj ho aj tam',
    '- Dátum vystavenia hľadaj za: "zo dňa", "vystavené", "dátum vystavenia", "date"',
    '- Dátum splatnosti hľadaj za: "splatnosť", "splatné do", "due date", "uhradiť do"',
    '- IČO má 6-10 číslic, hľadaj za: IČO, IČ, Reg.č.',
    hintLine ? hintLine : null,
    '',
    'Polia (chýbajúce = null, vráť IBA JSON):',
    'supplierName, supplierIco, customerName, customerIco,',
    'invoiceNumber, variableSymbol (VS pre platbu; ak chýba = invoiceNumber),',
    'totalAmount (číslo bez meny), issueDate (DD.MM.YYYY), dueDate (DD.MM.YYYY),',
    'items [{name, qty, unit, unit_price, total}]',
    '',
    'TEXT FAKTÚRY:',
    text.slice(0, 4000),
  ].filter((x): x is string => x !== null).join('\n')

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${keyRow.value}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini', temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    })
    const data    = await resp.json()
    const usage   = data.usage || {}
    const pt      = usage.prompt_tokens || 0
    const ct      = usage.completion_tokens || 0
    const rawJson = data.choices?.[0]?.message?.content || '{}'
    const parsed  = JSON.parse(rawJson)

    await prisma.aiApiLog.create({
      data: {
        model: 'gpt-4o-mini', promptTokens: pt, completionTokens: ct,
        costUsd: pt * PRICE_IN + ct * PRICE_OUT,
        requestPreview: prompt.slice(0, 1000), responsePreview: rawJson.slice(0, 1000),
        invoiceOcrResultId: ocr.id,
      },
    })

    const sIco  = (parsed.supplierIco  || '').replace(/\D/g, '')
    const cIco  = (parsed.customerIco  || '').replace(/\D/g, '')
    const sName = (parsed.supplierName || '').toLowerCase()
    const ownCompanies = await prisma.ownCompany.findMany()
    let direction = 'dodavatel'
    for (const c of ownCompanies) {
      if (sIco && c.ico === sIco) { direction = 'odberatel'; break }
      if (sName && sName.includes(c.name.toLowerCase())) { direction = 'odberatel'; break }
    }

    const updated = await prisma.invoiceOcrResult.update({
      where: { id: params.id },
      data: {
        direction,
        supplierName:     parsed.supplierName   || ocr.supplierName,
        supplierIco:      sIco                  || ocr.supplierIco,
        customerName:     parsed.customerName   || null,
        customerIco:      cIco                  || null,
        invoiceNumber:    parsed.invoiceNumber  || ocr.invoiceNumber,
        variableSymbol:   parsed.variableSymbol || parsed.invoiceNumber || ocr.variableSymbol,
        totalAmount:      parsed.totalAmount != null ? Number(parsed.totalAmount) : ocr.totalAmount,
        issueDate:        parsed.issueDate      || ocr.issueDate,
        dueDate:          parsed.dueDate        || ocr.dueDate,
        items:            parsed.items?.length  ? JSON.stringify(parsed.items) : ocr.items,
        recognitionMethod: 'openai',
        error:            null,
        extractedText:    text.slice(0, 2000),
      },
    })
    return NextResponse.json({ ok: true, updated, extractedText: text.slice(0, 300) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
