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

  // 1. Ticket comments with worked hours
  const commentWhere: any = { workedHours: { gt: 0 }, createdAt: { gte: dateFrom, lte: dateTo } }
  if (clientId) commentWhere.ticket = { clientId }
  let agentClientIds: string[] = []
  if (role === 'AGENT') {
    const a = await prisma.clientTechnician.findMany({ where: { userId: (session.user as any).id }, select: { clientId: true } })
    agentClientIds = a.map(x => x.clientId)
    if (!clientId) commentWhere.ticket = { clientId: { in: agentClientIds } }
  }
  const comments = await prisma.comment.findMany({
    where: commentWhere,
    include: {
      ticket: { select: { id: true, ticketNumber: true, subject: true, clientId: true, client: { select: { id: true, name: true } } } },
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // 2. Manual hours entries
  const manualWhere: any = { date: { gte: dateFrom, lte: dateTo } }
  if (clientId) manualWhere.clientId = clientId
  if (role === 'AGENT' && !clientId) manualWhere.clientId = { in: agentClientIds }
  const manualHours = await prisma.manualHours.findMany({
    where: manualWhere,
    include: {
      user: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
    },
    orderBy: { date: 'asc' },
  })

  // 3. Stock SELL movements
  const movementWhere: any = { type: 'SELL', date: { gte: dateFrom, lte: dateTo } }
  if (clientId) movementWhere.clientId = clientId
  const movements = await prisma.stockMovement.findMany({
    where: movementWhere,
    include: { stockItem: true, addedBy: { select: { id: true, name: true } }, client: { select: { id: true, name: true } } },
    orderBy: { date: 'asc' },
  })

  // 3b. TicketStockUsage — materiál z tiketov
  const usageWhere: any = { createdAt: { gte: dateFrom, lte: dateTo } }
  if (clientId) usageWhere.ticket = { clientId }
  if (role === 'AGENT' && !clientId) usageWhere.ticket = { clientId: { in: agentClientIds } }
  const ticketUsages = await prisma.ticketStockUsage.findMany({
    where: usageWhere,
    include: {
      stockItem: true,
      ticket: { select: { id: true, ticketNumber: true, subject: true, clientId: true, client: { select: { id: true, name: true } } } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // 4. Client pricing map
  const clientPricing = clientId
    ? await prisma.clientPricing.findMany({ where: { clientId } })
    : await prisma.clientPricing.findMany()
  const pricingMap: Record<string, Record<string, number>> = {}
  for (const p of clientPricing) {
    if (!pricingMap[p.clientId]) pricingMap[p.clientId] = {}
    pricingMap[p.clientId][p.hoursType] = p.pricePerHour
  }

  // 5. Build ticket hour rows
  const ticketHourRows = comments.map(c => {
    const hoursType = c.hoursType ?? 'STANDARD'
    const clientPrices = c.ticket.client?.id ? pricingMap[c.ticket.client.id] ?? {} : {}
    const pricePerHour = clientPrices[hoursType] ?? 0
    return {
      source: 'ticket',
      date: c.createdAt,
      name: c.ticket.subject,
      hoursType,
      hoursTypeLabel: HOURS_LABELS[hoursType] ?? hoursType,
      hours: c.workedHours,
      pricePerHour,
      totalPrice: Math.round(c.workedHours * pricePerHour * 100) / 100,
      addedBy: c.author.name,
      client: c.ticket.client,
      ticketId: c.ticket.id,
      ticketNumber: c.ticket.ticketNumber,
    }
  })

  // 6. Build manual hour rows
  const manualHourRows = manualHours.map(m => {
    const clientPrices = m.clientId ? pricingMap[m.clientId] ?? {} : {}
    const pricePerHour = clientPrices[m.hoursType] ?? 0
    return {
      source: 'manual',
      date: m.date,
      name: m.name,
      hoursType: m.hoursType,
      hoursTypeLabel: HOURS_LABELS[m.hoursType] ?? m.hoursType,
      hours: m.hours,
      pricePerHour,
      totalPrice: Math.round(m.hours * pricePerHour * 100) / 100,
      addedBy: m.user.name,
      client: m.client,
      manualId: m.id,
    }
  })

  const allHourRows = [...ticketHourRows, ...manualHourRows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // 7. Goods rows
  const sellRows = movements.map(m => ({
    date: m.date,
    itemName: m.stockItem.name,
    sku: m.stockItem.sku,
    quantity: m.quantity,
    pricePerUnit: m.pricePerUnit,
    totalPrice: m.totalPrice,
    vatRate: m.vatRate,
    addedBy: m.addedBy.name,
    client: m.client,
    ticketId: null as string | null,
    ticketNumber: null as number | null,
    note: null as string | null,
  }))
  const usageRows = ticketUsages.map(u => {
    const price = u.stockItem.sellingPrice ?? 0
    return {
      date: u.createdAt,
      itemName: u.stockItem.name,
      sku: u.stockItem.sku,
      quantity: u.qty,
      pricePerUnit: price,
      totalPrice: Math.round(price * u.qty * 100) / 100,
      vatRate: u.stockItem.vatRate,
      addedBy: u.createdBy.name,
      client: u.ticket.client,
      ticketId: u.ticket.id,
      ticketNumber: u.ticket.ticketNumber,
      note: u.note,
    }
  })
  const goodsRows = [...sellRows, ...usageRows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // 8. Summary
  const hoursByType: Record<string, number> = {}
  let totalHoursPrice = 0
  for (const r of allHourRows) {
    hoursByType[r.hoursTypeLabel] = (hoursByType[r.hoursTypeLabel] ?? 0) + r.hours
    totalHoursPrice += r.totalPrice
  }
  const totalGoodsPrice = goodsRows.reduce((s, r) => s + r.totalPrice, 0)

  return NextResponse.json({
    hourRows: allHourRows,
    goodsRows,
    summary: {
      hoursByType,
      totalHoursPrice: Math.round(totalHoursPrice * 100) / 100,
      totalGoodsPrice: Math.round(totalGoodsPrice * 100) / 100,
      totalPrice: Math.round((totalHoursPrice + totalGoodsPrice) * 100) / 100,
    },
  })
}
