import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const OCR_KEYS  = ['invoice_ocr_enabled', 'openai_api_key', 'openai_credit_threshold', 'openai_credit_notify_users']
const MASKED    = '••••••••'

async function adminOnly(req: NextRequest) {
  const s = await getServerSession(authOptions)
  if (!s || s.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const err = await adminOnly(req); if (err) return err
  const rows = await prisma.setting.findMany({ where: { key: { in: OCR_KEYS } } })
  const s: Record<string, string> = {}
  for (const r of rows) s[r.key] = r.value
  return NextResponse.json({
    invoice_ocr_enabled:        s['invoice_ocr_enabled']        || 'false',
    openai_api_key:             s['openai_api_key']              ? MASKED : '',
    openai_credit_threshold:    s['openai_credit_threshold']     || '',
    openai_credit_notify_users: s['openai_credit_notify_users']  || '',
  })
}

export async function PUT(req: NextRequest) {
  const err = await adminOnly(req); if (err) return err
  const body = await req.json()
  const upserts: Promise<any>[] = []
  for (const key of OCR_KEYS) {
    const value = body[key]
    if (value === undefined) continue
    if (key === 'openai_api_key' && (!value || value === MASKED)) continue
    upserts.push(prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } }))
  }
  await Promise.all(upserts)
  return NextResponse.json({ ok: true })
}
