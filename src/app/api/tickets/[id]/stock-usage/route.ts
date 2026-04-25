import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const usages = await prisma.ticketStockUsage.findMany({
    where: { ticketId: params.id },
    include: {
      stockItem: { select: { id: true, name: true, sku: true, unit: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(usages)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN' && role !== 'AGENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { stockItemId, qty, note } = await req.json()
  if (!stockItemId || !qty || qty <= 0) return NextResponse.json({ error: 'Neplatne vstupne data' }, { status: 400 })

  const [item, ticket] = await Promise.all([
    prisma.stockItem.findUnique({ where: { id: stockItemId } }),
    prisma.ticket.findUnique({ where: { id: params.id }, select: { id: true, clientId: true } }),
  ])
  if (!item) return NextResponse.json({ error: 'Polozka nenajdena' }, { status: 404 })
  if (!ticket) return NextResponse.json({ error: 'Tiket nenajdeny' }, { status: 404 })
  if (item.currentStock < qty) return NextResponse.json({ error: `Nedostatok na sklade (dostupne: ${item.currentStock} ${item.unit})` }, { status: 400 })

  const userId = (session.user as any).id
  const sellingPrice = item.sellingPrice ?? 0
  const totalPrice = Math.round(sellingPrice * qty * 100) / 100

  const [usage] = await prisma.$transaction([
    prisma.ticketStockUsage.create({
      data: { ticketId: params.id, stockItemId, qty, note: note || null, createdById: userId },
      include: {
        stockItem: { select: { id: true, name: true, sku: true, unit: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.stockMovement.create({
      data: {
        type: 'SELL',
        stockItemId,
        quantity: qty,
        pricePerUnit: sellingPrice,
        totalPrice,
        vatRate: item.vatRate,
        addedById: userId,
        clientId: ticket.clientId ?? null,
        note: `Tiket #${params.id}${note ? ' — ' + note : ''}`,
        date: new Date(),
      },
    }),
    prisma.stockItem.update({
      where: { id: stockItemId },
      data: {
        currentStock: { decrement: qty },
        lastSalePrice: sellingPrice,
        sellingPrice: sellingPrice,
      },
    }),
  ])
  return NextResponse.json(usage, { status: 201 })
}
