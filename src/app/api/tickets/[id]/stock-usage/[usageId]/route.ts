import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; usageId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const usage = await prisma.ticketStockUsage.findUnique({ where: { id: params.usageId } })
  if (!usage) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.$transaction([
    prisma.ticketStockUsage.delete({ where: { id: params.usageId } }),
    prisma.stockItem.update({
      where: { id: usage.stockItemId },
      data: { currentStock: { increment: usage.qty } },
    }),
  ])

  return NextResponse.json({ ok: true })
}
