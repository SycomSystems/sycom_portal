import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const HOURS_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  STANDARD_MIMO: 'Standard mimo prac. casu',
  SERVER: 'Server',
  SERVER_MIMO: 'Server mimo prac. casu',
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN' && role !== 'AGENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const clientId = searchParams.get('clientId')

  const dateFrom = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const dateTo = to ? new Date(to) : new Date()
  dateTo.setHours(23, 59, 59, 999)

  const commentWhere: any = { workedHours: { gt: 0 }, createdAt: { gte: dateFrom, lte: dateTo } }
  if (clientId) commentWhere.ticket = { clientId }

  const comments = await prisma.comment.findMany({
    where: commentWhere,
    include: {
      ticket: { select: { id: true, ticketNumber: true, subject: true, clientId: true, client: { select: { id: true, name: true } } } },
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const movementWhere: any = { type: 'SELL', date: { gte: dateFrom, lte: dateTo } }
  if (clientId) movementWhere.clientId = clientId

  const movements = await prisma.stockMovement.findMany({
    where: movementWhere,
    include: { stockItem: true, addedBy: { select: { id: true, name: true } }, client: { select: { id: true, name: true } } },
    orderBy: { date: 'asc' },
  })

  let clientPricing: any[] = clientId
    ? await prisma.clientPricing.findMany({ where: { clientId } })
    : await prisma.clientPricing.findMany()

  const pricingMap: Record<string, Record<string, number>> = {}
  for (const p of clientPricing) {
    if (!pricingMap[p.clientId]) pricingMap[p.clientId] = {}
    pricingMap[p.clientId][p.hoursType] = p.pricePerHour
  }

  const hourRows = comments.map(c => {
    const hoursType = c.hoursType ?? 'STANDARD'
    const clientPrices = c.ticket.client?.id ? pricingMap[c.ticket.client.id] ?? {} : {}
    const pricePerHour = clientPrices[hoursType] ?? 0
    return {
      rowType: 'hours',
      date: c.createdAt,
      ticketId: c.ticket.id,
      ticketNumber: c.ticket.ticketNumber,
      ticketSubject: c.ticket.subject,
      hoursType,
      hoursTypeLabel: HOURS_LABELS[hoursType] ?? hoursType,
      hours: c.workedHours,
      pricePerHour,
      totalPrice: Math.round(c.workedHours * pricePerHour * 100) / 100,
      addedBy: c.author.name,
      client: c.ticket.client,
    }
  })

  const goodsRows = movements.map(m => ({
    rowType: 'goods',
    date: m.date,
    itemName: m.stockItem.name,
    quantity: m.quantity,
    pricePerUnit: m.pricePerUnit,
    totalPrice: m.totalPrice,
    vatRate: m.vatRate,
    addedBy: m.addedBy.name,
    client: m.client,
  }))

  const hoursByType: Record<string, number> = {}
  let totalHoursPrice = 0
  for (const r of hourRows) {
    hoursByType[r.hoursTypeLabel] = (hoursByType[r.hoursTypeLabel] ?? 0) + r.hours
    totalHoursPrice += r.totalPrice
  }
  const totalGoodsPrice = goodsRows.reduce((s, r) => s + r.totalPrice, 0)

  return NextResponse.json({
    hourRows,
    goodsRows,
    summary: {
      hoursByType,
      totalHoursPrice: Math.round(totalHoursPrice * 100) / 100,
      totalGoodsPrice: Math.round(totalGoodsPrice * 100) / 100,
      totalPrice: Math.round((totalHoursPrice + totalGoodsPrice) * 100) / 100,
    },
  })
}
