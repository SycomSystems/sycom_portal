export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit = limitParam === 'all' ? undefined : Math.min(parseInt(limitParam || '200'), 10000)

  const results = await prisma.invoiceOcrResult.findMany({
    orderBy: { createdAt: 'desc' },
    ...(limit ? { take: limit } : {}),
  })
  return NextResponse.json(results)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const created = await prisma.invoiceOcrResult.create({
    data: {
      direction:      body.direction      || 'dodavatel',
      supplierName:   body.supplierName   || null,
      supplierIco:    body.supplierIco    || null,
      customerName:   body.customerName   || null,
      customerIco:    body.customerIco    || null,
      invoiceNumber:  body.invoiceNumber  || null,
      variableSymbol: body.variableSymbol || body.invoiceNumber || null,
      totalAmount:    body.totalAmount != null ? Number(body.totalAmount) : null,
      issueDate:      body.issueDate      || null,
      dueDate:        body.dueDate        || null,
      items:          body.items?.length  ? JSON.stringify(body.items) : null,
      stockStatus:    body.direction === 'dodavatel' ? 'pending' : 'na',
      recognitionMethod: 'manual',
      isDuplicate:    false,
    },
  })
  return NextResponse.json(created, { status: 201 })
}
