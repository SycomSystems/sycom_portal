import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN' && role !== 'AGENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const items = await prisma.stockItem.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN' && role !== 'AGENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { name, sku, category, unit, vatRate, minStock } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const item = await prisma.stockItem.create({
    data: {
      name: name.trim(),
      sku: sku?.trim() || null,
      category: category?.trim() || null,
      unit: unit || 'ks',
      vatRate: vatRate ?? 20,
      minStock: minStock ?? 0,
    },
  })
  return NextResponse.json(item, { status: 201 })
}
