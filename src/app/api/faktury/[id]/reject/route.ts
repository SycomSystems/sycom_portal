import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN','AGENT'].includes((session.user as any).role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ocr = await prisma.invoiceOcrResult.findUnique({ where: { id: params.id } })
  if (!ocr)                    return NextResponse.json({ error: 'Nenájdené' }, { status: 404 })
  if (ocr.stockStatus !== 'pending') return NextResponse.json({ error: 'Už spracované' }, { status: 400 })

  await prisma.invoiceOcrResult.update({ where: { id: params.id }, data: { stockStatus: 'rejected' } })
  return NextResponse.json({ ok: true })
}
