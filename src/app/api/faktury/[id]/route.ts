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
    },
  })
  return NextResponse.json(updated)
}
