import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { isPaid } = await req.json()
  const updated = await prisma.invoiceOcrResult.update({
    where: { id: params.id },
    data: { isPaid: !!isPaid, paidAt: isPaid ? new Date() : null },
  })
  return NextResponse.json({ ok: true, isPaid: updated.isPaid, paidAt: updated.paidAt })
}
