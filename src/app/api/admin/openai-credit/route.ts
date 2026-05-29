import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const row = await prisma.setting.findUnique({ where: { key: 'openai_api_key' } })
  if (!row?.value) return NextResponse.json({ error: 'OpenAI API kľúč nie je nastavený' }, { status: 400 })

  const apiKey = row.value

  const logEntry = async (model: string, req: string, resp: string, error?: string) => {
    try {
      await prisma.aiApiLog.create({ data: { model, requestPreview: req.slice(0, 1000), responsePreview: resp.slice(0, 1000), error } })
    } catch {}
  }

  try {
    const modelsRes = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    })
    const modelsText = await modelsRes.text()

    if (modelsRes.status === 401) {
      await logEntry('key-check', 'GET /v1/models', modelsText, '401 Unauthorized')
      return NextResponse.json({ error: 'Neplatný OpenAI API kľúč (401 Unauthorized)' }, { status: 400 })
    }
    if (modelsRes.status !== 200) {
      await logEntry('key-check', 'GET /v1/models', modelsText, `HTTP ${modelsRes.status}`)
      return NextResponse.json({ error: `OpenAI vrátilo ${modelsRes.status}` }, { status: 502 })
    }
    await logEntry('key-check', 'GET /v1/models', modelsText.slice(0, 500))

    const creditRes  = await fetch('https://api.openai.com/dashboard/billing/credit_grants', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    })
    const creditText = await creditRes.text()
    const creditData = creditRes.status === 200 ? JSON.parse(creditText) : {}
    await logEntry('credit-check', 'GET /dashboard/billing/credit_grants', creditText.slice(0, 500))

    return NextResponse.json({
      key_valid:       true,
      total_available: creditData.total_available ?? null,
      credit_note:     creditData.total_available != null ? null
        : 'Kredit nie je dostupný cez API (pay-as-you-go) — skontroluj platform.openai.com/settings/billing',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
