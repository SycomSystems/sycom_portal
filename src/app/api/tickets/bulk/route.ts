import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN' && role !== 'AGENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action, ids, status, assigneeId } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'No ids' }, { status: 400 })

  if (action === 'delete') {
    if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await prisma.ticket.deleteMany({ where: { id: { in: ids } } })
  } else if (action === 'status') {
    await prisma.ticket.updateMany({ where: { id: { in: ids } }, data: { status } })
  } else if (action === 'assign') {
    await prisma.ticket.updateMany({ where: { id: { in: ids } }, data: { assigneeId: assigneeId || null } })
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  return NextResponse.json({ success: true, count: ids.length })
}
