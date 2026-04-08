// src/app/api/stock/items/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const item = await prisma.stockItem.findUnique({
    where: { id: params.id },
    include: {
      supplierPrices: {
        include: { supplier: true },
        orderBy: [{ isPreferred: 'desc' }, { price: 'asc' }],
      },
      movements: {
        include: {
          supplier: { select: { id: true, name: true } },
          client:   { select: { id: true, name: true } },
          addedBy:  { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        take: 50,
      },
      serialNumbers: {
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { movements: true } },
    },
  })

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, sku, category, description, unit, vatRate, minStock, maxStock,
          location, serialTracking } = body

  const item = await prisma.stockItem.update({
    where: { id: params.id },
    data: {
      ...(name        !== undefined && { name:           name.trim() }),
      ...(sku         !== undefined && { sku:            sku?.trim() || null }),
      ...(category    !== undefined && { category:       category?.trim() || null }),
      ...(description !== undefined && { description:    description?.trim() || null }),
      ...(unit        !== undefined && { unit }),
      ...(vatRate     !== undefined && { vatRate:        Number(vatRate) }),
      ...(minStock    !== undefined && { minStock:       Number(minStock) }),
      ...(maxStock    !== undefined && { maxStock:       Number(maxStock) }),
      ...(location    !== undefined && { location:       location?.trim() || null }),
      ...(serialTracking !== undefined && { serialTracking: Boolean(serialTracking) }),
    },
  })

  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Check if any movements exist
  const count = await prisma.stockMovement.count({ where: { stockItemId: params.id } })
  if (count > 0) return NextResponse.json(
    { error: `Tovar má ${count} pohybov. Najprv zmažte pohyby.` }, { status: 409 }
  )

  await prisma.stockItem.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
