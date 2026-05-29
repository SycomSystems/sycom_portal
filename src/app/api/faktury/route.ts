import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN','AGENT'].includes((session.user as any).role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const limit  = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '200'), 500)
  const filter = req.nextUrl.searchParams.get('filter') // all | pending | dodavatel | odberatel
  
  const where: any = {}
  if (filter === 'pending')    where.stockStatus = 'pending'
  if (filter === 'dodavatel')  where.direction   = 'dodavatel'
  if (filter === 'odberatel')  where.direction   = 'odberatel'

  const results = await prisma.invoiceOcrResult.findMany({
    where, orderBy: { createdAt: 'desc' }, take: limit,
  })
  return NextResponse.json(results)
}
