import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const HOURS_TYPES = ['STANDARD', 'STANDARD_MIMO', 'SERVER', 'SERVER_MIMO']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, contactPerson, phone, ico, dic, dicDph, address, www, notes, emailAlias, pricing, technicianIds } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  try {
    await prisma.client.update({
      where: { id: params.id },
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
      },
    })

    if (pricing) {
      await Promise.all(
        HOURS_TYPES.map(hoursType =>
          prisma.clientPricing.upsert({
            where: { clientId_hoursType: { clientId: params.id, hoursType } },
            create: { clientId: params.id, hoursType, pricePerHour: pricing[hoursType] ?? 0 },
            update: { pricePerHour: pricing[hoursType] ?? 0 },
          })
        )
      )
    }

    const updated = await prisma.client.findUnique({
      where: { id: params.id },
      include: { pricing: true, _count: { select: { users: true } } },
    })
    if (Array.isArray(technicianIds)) {
      await prisma.clientTechnician.deleteMany({ where: { clientId: params.id } })
      if (technicianIds.length > 0)
        await prisma.clientTechnician.createMany({ data: technicianIds.map((uid: string) => ({ clientId: params.id, userId: uid })) })
    }
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Client not found or name already exists' }, { status: 409 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.client.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
