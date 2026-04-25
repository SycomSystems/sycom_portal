import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const settings = await prisma.smtpSettings.findUnique({ where: { id: 1 } })
  if (!settings) return NextResponse.json({ host: '', port: 587, secure: false, user: '', pass: '', from: '' })
  // Never expose password in full
  return NextResponse.json({ ...settings, pass: settings.pass ? '••••••••' : '' })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { host, port, secure, user, pass, from } = await req.json()
  const data: any = { host, port: Number(port), secure: Boolean(secure), user, from }
  // Only update password if it's not the masked placeholder
  if (pass && pass !== '••••••••') data.pass = pass
  const updated = await prisma.smtpSettings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data, pass: pass || '' },
  })
  return NextResponse.json({ ok: true })
}
