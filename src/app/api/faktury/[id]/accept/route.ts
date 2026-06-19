import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const UNIT_MAP: Record<string,string> = {
  ks:'ks', pcs:'ks', pc:'ks', kus:'ks', kusov:'ks', kusy:'ks', piece:'ks', pieces:'ks', bal:'ks', balenie:'ks',
  m2:'m2', m3:'m3', m:'m', bm:'m', lm:'m', kg:'kg',
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ocr = await prisma.invoiceOcrResult.findUnique({ where: { id: params.id } })
  if (!ocr)               return NextResponse.json({ error: 'Nenájdené' }, { status: 404 })
  if (ocr.stockStatus !== 'pending') return NextResponse.json({ error: 'Už spracované' }, { status: 400 })

  const userId = (session.user as any).id
  // Accept optional items override from request body
  const body = await req.json().catch(() => ({}))
  const itemsOverride = body.items  // array if user edited items, undefined otherwise
  const items = itemsOverride ?? (ocr.items ? JSON.parse(ocr.items) : [])

  // If items were overridden, save them back to the invoice
  if (itemsOverride !== undefined) {
    await prisma.invoiceOcrResult.update({
      where: { id: params.id },
      data: { items: items.length ? JSON.stringify(items) : null },
    })
  }
  const supplier = ocr.supplierName
    ? await prisma.supplier.findFirst({ where: { name: { equals: ocr.supplierName } } })
    : null

  let added = 0
  for (const item of items) {
    const name = (item.name || '').trim()
    if (!name) continue
    const qty   = parseFloat(item.qty)   || 0; if (qty <= 0) continue
    const price = parseFloat(item.unit_price) || 0
    const unit  = UNIT_MAP[(item.unit || 'ks').toLowerCase().trim()] || 'ks'

    let stockItem = await prisma.stockItem.findFirst({ where: { name: { equals: name } } })
    if (!stockItem) {
      stockItem = await prisma.stockItem.create({
        data: { name, unit, lastPurchasePrice: price, avgPurchasePrice: price },
      })
    }
    await prisma.stockMovement.create({
      data: {
        type: 'BUY', stockItemId: stockItem.id, quantity: qty,
        pricePerUnit: price, totalPrice: qty * price,
        supplierId: supplier?.id, addedById: userId,
        invoiceNumber: ocr.invoiceNumber,
        note: `Faktúra ${ocr.invoiceNumber || ''} — ${ocr.supplierName || ocr.sourceEmail || ''}`,
      },
    })
    await prisma.stockItem.update({
      where: { id: stockItem.id },
      data: { currentStock: { increment: qty }, ...(price > 0 ? { lastPurchasePrice: price } : {}) },
    })
    added++
  }

  await prisma.invoiceOcrResult.update({ where: { id: params.id }, data: { stockStatus: 'accepted' } })
  return NextResponse.json({ ok: true, added })
}
