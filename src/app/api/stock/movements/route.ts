import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN' && role !== 'AGENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const supplierId = searchParams.get('supplierId')
  const clientId = searchParams.get('clientId')
  const type = searchParams.get('type')

  const where: any = {}
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); where.date.lte = d }
  }
  if (supplierId) where.supplierId = supplierId
  if (clientId) where.clientId = clientId
  if (type) where.type = type

  const movements = await prisma.stockMovement.findMany({
    where,
    include: {
      stockItem: true,
      supplier: true,
      client: { select: { id: true, name: true } },
      addedBy: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(movements)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN' && role !== 'AGENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const userId = (session.user as any).id
  const { type, stockItemId, quantity, pricePerUnit, vatRate, supplierId, clientId, note, date, newSupplierName } = await req.json()

  if (!type || !stockItemId || !quantity) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const qty = parseFloat(quantity)
  const ppu = parseFloat(pricePerUnit) || 0
  const total = Math.round(qty * ppu * 100) / 100

  let resolvedSupplierId = supplierId || null
  if (!supplierId && newSupplierName?.trim()) {
    const s = await prisma.supplier.upsert({
      where: { name: newSupplierName.trim() },
      create: { name: newSupplierName.trim() },
      update: {},
    })
    resolvedSupplierId = s.id
  }

  const positiveTypes = ['BUY', 'RETURN_FROM_CUSTOMER', 'CORRECTION']
  const delta = positiveTypes.includes(type) ? qty : -qty

  const [movement] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        type,
        stockItemId,
        quantity: qty,
        pricePerUnit: ppu,
        totalPrice: total,
        vatRate: vatRate ?? 20,
        supplierId: resolvedSupplierId,
        clientId: clientId || null,
        addedById: userId,
        note: note?.trim() || null,
        date: date ? new Date(date) : new Date(),
      },
    }),
    prisma.stockItem.update({
      where: { id: stockItemId },
      data: { currentStock: { increment: delta } },
    }),
  ])

  const full = await prisma.stockMovement.findUnique({
    where: { id: movement.id },
    include: {
      stockItem: true,
      supplier: true,
      client: { select: { id: true, name: true } },
      addedBy: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(full, { status: 201 })
}
