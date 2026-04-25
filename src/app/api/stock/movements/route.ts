// src/app/api/stock/movements/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from         = searchParams.get('from')
  const to           = searchParams.get('to')
  const supplierId   = searchParams.get('supplierId')
  const clientId     = searchParams.get('clientId')
  const type         = searchParams.get('type')
  const stockItemId  = searchParams.get('stockItemId')
  const limit        = Number(searchParams.get('limit') || 200)

  const where: any = {}
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to)   where.date.lte = new Date(to + 'T23:59:59')
  }
  if (supplierId)  where.supplierId  = supplierId
  if (clientId)    where.clientId    = clientId
  if (type)        where.type        = type
  if (stockItemId) where.stockItemId = stockItemId

  const movements = await prisma.stockMovement.findMany({
    where,
    include: {
      stockItem: true,
      supplier:  { select: { id: true, name: true } },
      client:    { select: { id: true, name: true } },
      addedBy:   { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
    take: limit,
  })

  return NextResponse.json(movements)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const body   = await req.json()

  const {
    type, stockItemId, quantity, pricePerUnit, vatRate,
    supplierId, clientId, note, date, invoiceNumber,
    newSupplierName, supplierPriceId,
    // New stock item fields (if creating new)
    newItemSku, newItemCategory, newItemUnit, newItemDescription,
    newItemMinStock, newItemLocation,
      newItemSellingPrice,
  } = body

  if (!type || !stockItemId || !quantity)
    return NextResponse.json({ error: 'type, stockItemId, quantity sú povinné' }, { status: 400 })

  let finalStockItemId = stockItemId
  let finalSupplierId  = supplierId || null

  // Create supplier if new
  if (!finalSupplierId && newSupplierName?.trim()) {
    const s = await prisma.supplier.create({ data: { name: newSupplierName.trim() } })
    finalSupplierId = s.id
  }

  // Create stock item if new (id starts with 'NEW:')
  if (stockItemId.startsWith('NEW:')) {
    const name = stockItemId.replace('NEW:', '').trim()
    const item = await prisma.stockItem.create({
      data: {
        name,
        sku:         newItemSku?.trim()      || null,
        category:    newItemCategory?.trim() || null,
        description: newItemDescription?.trim() || null,
        unit:        newItemUnit || 'ks',
        vatRate:     Number(vatRate) || 20,
        minStock:    Number(newItemMinStock) || 0,
        location:    newItemLocation?.trim() || null,
      },
    })
    finalStockItemId = item.id
  }

  const qty   = Number(quantity)
  const price = Number(pricePerUnit) || 0
  const total = qty * price
  const vat   = Number(vatRate) || 20

  // Determine stock direction
  const isInbound  = ['BUY', 'RETURN_FROM_CUSTOMER', 'CORRECTION'].includes(type)
  const isOutbound = ['SELL', 'RETURN_TO_SUPPLIER', 'WRITEOFF'].includes(type)
  const stockDelta = isInbound ? qty : isOutbound ? -qty : 0

  // Validate stock for outbound
  if (isOutbound) {
    const item = await prisma.stockItem.findUnique({ where: { id: finalStockItemId } })
    if (!item) return NextResponse.json({ error: 'Tovar nenájdený' }, { status: 404 })
    if (item.currentStock < qty)
      return NextResponse.json(
        { error: `Nedostatok na sklade. Dostupné: ${item.currentStock} ${item.unit}` },
        { status: 400 }
      )
  }

  // Create movement
  const movement = await prisma.stockMovement.create({
    data: {
      type,
      stockItemId:     finalStockItemId,
      quantity:        qty,
      pricePerUnit:    price,
      totalPrice:      total,
      vatRate:         vat,
      supplierId:      finalSupplierId,
      clientId:        clientId || null,
      addedById:       userId,
      supplierPriceId: supplierPriceId || null,
      invoiceNumber:   invoiceNumber?.trim() || null,
      note:            note?.trim() || null,
      date:            date ? new Date(date) : new Date(),
    },
    include: {
      stockItem: true,
      supplier:  { select: { id: true, name: true } },
      client:    { select: { id: true, name: true } },
      addedBy:   { select: { id: true, name: true } },
    },
  })

  // Update stock item current stock + prices
  const item = await prisma.stockItem.findUnique({ where: { id: finalStockItemId } })
  if (item) {
    const updates: any = {
      currentStock: item.currentStock + stockDelta,
    }

    if (type === 'BUY' && price > 0) {
      // Recalculate weighted average purchase price
      const totalBought = item.currentStock + qty
      if (totalBought > 0) {
        updates.avgPurchasePrice = ((item.avgPurchasePrice * item.currentStock) + (price * qty)) / totalBought
      }
      updates.lastPurchasePrice = price

      // Update supplier price list
      if (finalSupplierId) {
        await prisma.supplierPrice.upsert({
          where:  { stockItemId_supplierId: { stockItemId: finalStockItemId, supplierId: finalSupplierId } },
          update: { price, lastUpdated: new Date() },
          create: { stockItemId: finalStockItemId, supplierId: finalSupplierId, price, lastUpdated: new Date() },
        })
      }
    }

    if (type === 'SELL' && price > 0) {
      updates.lastSalePrice = price
    }

    await prisma.stockItem.update({ where: { id: finalStockItemId }, data: updates })
  }

  return NextResponse.json(movement, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json()
  const { quantity, pricePerUnit, vatRate, note, date, invoiceNumber } = body

  const old = await prisma.stockMovement.findUnique({
    where:   { id },
    include: { stockItem: true },
  })
  if (!old) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newQty   = Number(quantity)   || old.quantity
  const newPrice = Number(pricePerUnit) || old.pricePerUnit
  const newTotal = newQty * newPrice

  const isInbound  = ['BUY', 'RETURN_FROM_CUSTOMER', 'CORRECTION'].includes(old.type)
  const isOutbound = ['SELL', 'RETURN_TO_SUPPLIER', 'WRITEOFF'].includes(old.type)
  const oldDelta = isInbound ? old.quantity : isOutbound ? -old.quantity : 0
  const newDelta = isInbound ? newQty : isOutbound ? -newQty : 0
  const stockAdjust = newDelta - oldDelta

  await prisma.stockMovement.update({
    where: { id },
    data: {
      quantity:      newQty,
      pricePerUnit:  newPrice,
      totalPrice:    newTotal,
      vatRate:       vatRate ? Number(vatRate) : old.vatRate,
      note:          note?.trim() || null,
      invoiceNumber: invoiceNumber?.trim() || null,
      date:          date ? new Date(date) : old.date,
    },
  })

  await prisma.stockItem.update({
    where: { id: old.stockItemId },
    data:  { currentStock: { increment: stockAdjust } },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const movement = await prisma.stockMovement.findUnique({ where: { id } })
  if (!movement) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isInbound  = ['BUY', 'RETURN_FROM_CUSTOMER', 'CORRECTION'].includes(movement.type)
  const isOutbound = ['SELL', 'RETURN_TO_SUPPLIER', 'WRITEOFF'].includes(movement.type)
  const delta = isInbound ? -movement.quantity : isOutbound ? movement.quantity : 0

  await prisma.stockMovement.delete({ where: { id } })
  await prisma.stockItem.update({
    where: { id: movement.stockItemId },
    data:  { currentStock: { increment: delta } },
  })

  return NextResponse.json({ success: true })
}
