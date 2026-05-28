import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { getMobileSession } from "@/lib/mobile-session"
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  // Podpora pre cookie-based session (web) aj header-based (mobile)
  const session = await getMobileSession()

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true, role: true },
    })
    if (user) return NextResponse.json(user)
  }

  // Fallback: mobile session token z Cookie headera
  const cookieHeader = req.headers.get('cookie') || ''
  const tokenMatch = cookieHeader.match(/next-auth\.session-token=([^;]+)/)
  if (tokenMatch) {
    const sessionToken = tokenMatch[1]
    const dbSession = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    })
    if (dbSession && dbSession.expires > new Date()) {
      return NextResponse.json(dbSession.user)
    }
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function PATCH(req: NextRequest) {
  const session = await getMobileSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Zmena mena
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: 'Meno nesmie byť prázdne.' }, { status: 400 })
    const updated = await prisma.user.update({
      where: { email: session.user.email },
      data: { name: body.name.trim() },
      select: { id: true, name: true, email: true, role: true },
    })
    return NextResponse.json(updated)
  }

  // Zmena hesla
  if (body.oldPassword !== undefined && body.password !== undefined) {
    const bcrypt = await import('bcryptjs')
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, password: true } })
    if (!user?.password) return NextResponse.json({ error: 'Používateľ nemá nastavené heslo.' }, { status: 400 })
    const valid = await bcrypt.compare(body.oldPassword, user.password)
    if (!valid) return NextResponse.json({ error: 'Aktuálne heslo je nesprávne.' }, { status: 400 })
    const hashed = await bcrypt.hash(body.password, 10)
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Neplatná požiadavka.' }, { status: 400 })
}
