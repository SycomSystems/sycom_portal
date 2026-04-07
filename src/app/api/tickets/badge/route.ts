import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ count: 0 })

  const userId = (session.user as any).id
  const role   = (session.user as any).role

  // Only staff (ADMIN/AGENT) have assigned tickets
  if (role !== 'ADMIN' && role !== 'AGENT') {
    return NextResponse.json({ count: 0 })
  }

  const count = await prisma.ticket.count({
    where: {
      assigneeId: userId,
      status: { notIn: ['RESOLVED', 'CLOSED'] },
    },
  })

  return NextResponse.json({ count })
}
