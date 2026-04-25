import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const HOURS_TYPES = ['STANDARD', 'STANDARD_MIMO', 'SERVER', 'SERVER_MIMO']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' },
    include: {
      technicians: { include: { user: { select: { id: true, name: true } } } },
      pricing: true,
      _count: { select: { users: true } },
    },
  })
  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, contactPerson, phone, ico, dic, dicDph, address, www, notes, emailAlias, pricing } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  try {
    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        ico: ico?.trim() || null,
        dic: dic?.trim() || null,
        dicDph: dicDph?.trim() || null,
        address: address?.trim() || null,
        www: www?.trim() || null,
        notes: notes?.trim() || null,
          emailAlias: emailAlias?.trim() || null,
        pricing: {
          create: HOURS_TYPES.map(hoursType => ({
            hoursType,
            pricePerHour: pricing?.[hoursType] ?? 0,
          })),
        },
      },
      include: { pricing: true, _count: { select: { users: true } } },
    })
    return NextResponse.json(client, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Client name already exists' }, { status: 409 })
  }
}
