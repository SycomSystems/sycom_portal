import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { getMobileSession } from "@/lib/mobile-session"
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getMobileSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u      = session.user as any
  const userId = u['id'] as string
  const role   = u['role'] as string

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: any = {}

  if (role === 'CLIENT' || role === 'CLIENT_MANAGER') {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    if (me?.clientId) { base.clientId    = me.clientId }
    else              { base.createdById = userId      }
  } else if (role === 'AGENT') {
    base.assigneeId = userId
  }

  const inactive = { notIn: ['RESOLVED', 'CLOSED'] as const }

  const [open, high, medium, low] = await Promise.all([
    prisma.ticket.count({ where: { ...base, status: { in: ['OPEN','IN_PROGRESS','WAITING'] } } }),
    prisma.ticket.count({ where: { ...base, status: inactive, priority: 'HIGH'   } }),
    prisma.ticket.count({ where: { ...base, status: inactive, priority: 'MEDIUM' } }),
    prisma.ticket.count({ where: { ...base, status: inactive, priority: 'LOW'    } }),
  ])

  return NextResponse.json({ open, high, medium, low })
}
