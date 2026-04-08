// src/app/api/stock/supplier-prices/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/stock/supplier-prices?stockItemId=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const stockItemId = searchParams.get('stockItemId')
  const supplierId  = searchParams.get('supplierId')

  const where: any = {}
  if (stockItemId) where.stockItemId = stockItemId
  if (supplierId)  where.supplierId  = supplierId

  const prices = await prisma.supplierPrice.findMany({
    where,
    include: {
      supplier:  { select: { id: true, name: true, email: true, phone: true } },
      stockItem: { select: { id: true, name: true, sku: true, unit: true } },
    },
    orderBy: [{ isPreferred: 'desc' }, { price: 'asc' }],
  })

  return NextResponse.json(prices)
}

// POST - add/update supplier price for an item
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { stockItemId, supplierId, price, currency, isPreferred,
          minOrderQty, leadTimeDays, supplierSku, note, validTo } = body

  if (!stockItemId || !supplierId || price === undefined)
    return NextResponse.json({ error: 'stockItemId, supplierId, price sú povinné' }, { status: 400 })

  // If setting as preferred, unset others first
  if (isPreferred) {
    await prisma.supplierPrice.updateMany({
      where: { stockItemId, isPreferred: true },
      data:  { isPreferred: false },
    })
  }

  const sp = await prisma.supplierPrice.upsert({
    where:  { stockItemId_supplierId: { stockItemId, supplierId } },
    update: {
      price:        Number(price),
      currency:     currency || 'EUR',
      isPreferred:  Boolean(isPreferred),
      minOrderQty:  minOrderQty ? Number(minOrderQty) : null,
      leadTimeDays: leadTimeDays ? Number(leadTimeDays) : null,
      supplierSku:  supplierSku?.trim() || null,
      note:         note?.trim() || null,
      validTo:      validTo ? new Date(validTo) : null,
      lastUpdated:  new Date(),
    },
    create: {
      stockItemId,
      supplierId,
      price:        Number(price),
      currency:     currency || 'EUR',
      isPreferred:  Boolean(isPreferred),
      minOrderQty:  minOrderQty ? Number(minOrderQty) : null,
      leadTimeDays: leadTimeDays ? Number(leadTimeDays) : null,
      supplierSku:  supplierSku?.trim() || null,
      note:         note?.trim() || null,
      validTo:      validTo ? new Date(validTo) : null,
    },
    include: {
      supplier:  { select: { id: true, name: true } },
      stockItem: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(sp, { status: 201 })
}

// DELETE /api/stock/supplier-prices?id=xxx
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (!['ADMIN', 'AGENT'].includes(role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.supplierPrice.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
