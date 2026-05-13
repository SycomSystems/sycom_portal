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
