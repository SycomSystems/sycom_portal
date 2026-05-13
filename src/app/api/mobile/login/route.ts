import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { encode } from 'next-auth/jwt'

export async function POST(req: NextRequest) {
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
      return NextResponse.json({ error: 'Nesprávne prihlasovacie údaje' }, { status: 401 })
    }

    // Vytvor platný NextAuth JWT token (rovnaký formát ako web session)
    const sessionToken = await encode({
      token: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        sub:   user.id,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 24 * 60 * 60, // 24 hodín
    })

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
