import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const KEYS = [
  'invoice_imap_host', 'invoice_imap_port', 'invoice_imap_user',
  'invoice_imap_pass', 'invoice_imap_mailbox', 'invoice_imap_enabled',
  'openai_api_key', 'openai_credit_threshold', 'openai_credit_notify_users',
]
const MASKED = '••••••••'

async function adminOnly(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const denied = await adminOnly(req)
  if (denied) return denied

  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } })
  const s: Record<string, string> = {}
  for (const r of rows) s[r.key] = r.value

  return NextResponse.json({
    invoice_imap_host:              s['invoice_imap_host']              || '',
    invoice_imap_port:              s['invoice_imap_port']              || '993',
    invoice_imap_user:              s['invoice_imap_user']              || '',
    invoice_imap_pass:              s['invoice_imap_pass'] ? MASKED : '',
    invoice_imap_mailbox:           s['invoice_imap_mailbox']           || 'INBOX',
    invoice_imap_enabled:           s['invoice_imap_enabled']           || 'false',
    openai_api_key:                 s['openai_api_key'] ? MASKED : '',
    openai_credit_threshold:        s['openai_credit_threshold']        || '',
    openai_credit_notify_users:     s['openai_credit_notify_users']     || '',
  })
}

export async function PUT(req: NextRequest) {
  const denied = await adminOnly(req)
  if (denied) return denied

  const body = await req.json()
  const upserts: Promise<any>[] = []

  for (const key of KEYS) {
    const value = body[key]
    // Skip masked placeholders and undefined
    if (value === undefined) continue
    if ((key === 'invoice_imap_pass' || key === 'openai_api_key') && (!value || value === MASKED)) continue

    upserts.push(
      prisma.setting.upsert({
        where:  { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    )
  }

  await Promise.all(upserts)
  return NextResponse.json({ ok: true })
}
