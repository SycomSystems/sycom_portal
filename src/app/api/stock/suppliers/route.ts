// src/app/api/stock/suppliers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')

  const where: any = {}
  if (search) where.name = { contains: search }

  const suppliers = await prisma.supplier.findMany({
    where,
    include: {
      _count: { select: { stockMovements: true, priceList: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(suppliers)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, contactPerson, phone, email, address, ico, dic, website, note } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Názov je povinný' }, { status: 400 })

  // Check if exists
  const existing = await prisma.supplier.findFirst({ where: { name: { equals: name.trim() } } })
  if (existing) return NextResponse.json(existing)

  const supplier = await prisma.supplier.create({
    data: {
      name:          name.trim(),
      contactPerson: contactPerson?.trim() || null,
      phone:         phone?.trim()         || null,
      email:         email?.trim()         || null,
      address:       address?.trim()       || null,
      ico:           ico?.trim()           || null,
      dic:           dic?.trim()           || null,
      website:       website?.trim()       || null,
      note:          note?.trim()          || null,
    },
  })

  return NextResponse.json(supplier, { status: 201 })
}
