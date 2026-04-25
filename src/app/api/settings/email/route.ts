import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const KEYS = ['email_imap_host','email_imap_port','email_imap_secure','email_imap_user','email_imap_pass','email_imap_enabled']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } })
  const result: Record<string, string> = {}
  for (const r of rows) result[r.key] = r.value
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  await Promise.all(KEYS.filter(k => body[k] !== undefined).map(k =>
    prisma.setting.upsert({ where: { key: k }, update: { value: String(body[k]) }, create: { key: k, value: String(body[k]) } })
  ))
  return NextResponse.json({ success: true })
}
