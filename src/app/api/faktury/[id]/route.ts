import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const {
    direction, supplierName, supplierIco, customerName, customerIco,
    invoiceNumber, variableSymbol, totalAmount, dueDate,
  } = body

  const updated = await prisma.invoiceOcrResult.update({
    where: { id: params.id },
    data: {
      ...(direction      !== undefined && { direction }),
      ...(supplierName   !== undefined && { supplierName:   supplierName   || null }),
      ...(supplierIco    !== undefined && { supplierIco:    supplierIco    || null }),
      ...(customerName   !== undefined && { customerName:   customerName   || null }),
      ...(customerIco    !== undefined && { customerIco:    customerIco    || null }),
      ...(invoiceNumber  !== undefined && { invoiceNumber:  invoiceNumber  || null }),
      ...(variableSymbol !== undefined && { variableSymbol: variableSymbol || null }),
      ...(totalAmount    !== undefined && { totalAmount:    totalAmount != null ? Number(totalAmount) : null }),
      ...(dueDate        !== undefined && { dueDate:        dueDate        || null }),
      ...(body.stockStatus !== undefined && { stockStatus: body.stockStatus }),
    },
  })

  // Auto-learning: when customerName is corrected, save supplier hint
  const supplier = updated.supplierName
  if (supplier && (body.customerName !== undefined || body.customerIco !== undefined)) {
    const custName = updated.customerName
    const custIco  = updated.customerIco
    if (custName || custIco) {
      const newHint = `Opraveny odberatel: ${custName || ''}${custIco ? ` (ICO: ${custIco})` : ''}. V PDF texte moze byt meno odberatela pred labelom "Odberatel:" — hladaj firemny nazov v adresnom bloku pred tymto labelom.`
      try {
        const existing = await prisma.supplierHint.findFirst({ where: { supplierName: supplier } })
        if (existing) {
          if (!existing.hint.includes(custName || '') || !existing.hint.includes('adresnom')) {
            await prisma.supplierHint.update({
              where: { id: existing.id },
              data: { hint: (existing.hint + '\n' + newHint).slice(0, 1000) }
            })
          }
        } else {
          await prisma.supplierHint.create({ data: { supplierName: supplier, hint: newHint } })
        }
      } catch (_) {}
    }
  }

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.invoiceOcrResult.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
