// src/app/api/stock/items/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const withPrices = searchParams.get('withPrices') === '1'

  const where: any = {}
  if (search) where.name = { contains: search }

  const items = await prisma.stockItem.findMany({
    where,
    include: {
      supplierPrices: withPrices ? {
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { price: 'asc' },
      } : false,
      _count: { select: { movements: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, sku, category, description, unit, vatRate, minStock, maxStock,
          location, serialTracking } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Názov je povinný' }, { status: 400 })

  const item = await prisma.stockItem.create({
    data: {
      name:           name.trim(),
      sku:            sku?.trim() || null,
      category:       category?.trim() || null,
      description:    description?.trim() || null,
      unit:           unit || 'ks',
      vatRate:        Number(vatRate) || 20,
      minStock:       Number(minStock) || 0,
      maxStock:       Number(maxStock) || 0,
      location:       location?.trim() || null,
      serialTracking: Boolean(serialTracking),
    },
  })

  return NextResponse.json(item, { status: 201 })
}
