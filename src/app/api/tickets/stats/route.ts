import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id as string
  const role   = session.user.role as string

  let where: Record<string, unknown> = {}

  if (role === 'CLIENT' || role === 'CLIENT_MANAGER') {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    if (me?.clientId) {
      where.client = { id: me.clientId }
    } else {
      where.createdById = userId
    }
  } else if (role === 'AGENT') {
    where.assigneeId = userId
  }

  const [open, high, medium, low] = await Promise.all([
    prisma.ticket.count({ where: { ...where, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] } } }),
    prisma.ticket.count({ where: { ...where, priority: 'HIGH' } }),
    prisma.ticket.count({ where: { ...where, priority: 'MEDIUM' } }),
    prisma.ticket.count({ where: { ...where, priority: 'LOW' } }),
  ])

  return NextResponse.json({ open, high, medium, low })
}
