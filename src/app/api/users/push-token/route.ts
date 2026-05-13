import { NextResponse } from 'next/server'
import { getMobileSession } from '@/lib/mobile-session'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getMobileSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  await prisma.user.update({ where: { id: session.user.id }, data: { expoPushToken: token } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await getMobileSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.user.update({ where: { id: session.user.id }, data: { expoPushToken: null } })
  return NextResponse.json({ ok: true })
}
