import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { encode } from 'next-auth/jwt'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? undefined
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Chýba email alebo heslo' }, { status: 400 })
    }
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true, role: true, password: true, isActive: true },
    })
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Nesprávne prihlasovacie údaje' }, { status: 401 })
    }
    if (!user.isActive) {
      return NextResponse.json({ error: 'Účet je deaktivovaný' }, { status: 403 })
    }
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      logAudit(user.id, 'auth', user.id, 'MOBILE_LOGIN_FAILED', null, { email: user.email, reason: 'wrong_password' }, ip).catch(() => {})
      return NextResponse.json({ error: 'Nesprávne prihlasovacie údaje' }, { status: 401 })
    }
    const sessionToken = await encode({
      token: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        sub:   user.id,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 24 * 60 * 60,
    })
    logAudit(user.id, 'auth', user.id, 'MOBILE_LOGIN', null, { email: user.email, role: user.role }, ip).catch(() => {})
    return NextResponse.json({
      sessionToken,
      user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
    })
  } catch (error) {
    console.error('Mobile login error:', error)
    return NextResponse.json({ error: 'Interná chyba servera' }, { status: 500 })
  }
}
