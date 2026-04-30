import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'
import { sendOrderCreated } from '@/lib/email'

const itemSchema = z.object({
  name:      z.string().min(1),
  quantity:  z.number().min(0.01),
  unit:      z.string().optional(),
  clientNote: z.string().optional(),
})

const createSchema = z.object({
  clientNote: z.string().optional(),
  clientId:   z.string().optional(),
  items:      z.array(itemSchema).min(1),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role   = (session.user as any).role
  const userId = (session.user as any).id

  const where: any = {}
  if (role === 'CLIENT') {
    where.creatorId = userId
  } else if (role === 'CLIENT_MANAGER') {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    if (me?.clientId) where.clientId = me.clientId
    else where.creatorId = userId
  } else if (role === 'AGENT') {
    const assigned = await prisma.clientTechnician.findMany({ where: { userId }, select: { clientId: true } })
    where.clientId = { in: assigned.map((a: any) => a.clientId) }
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true } },
      client:  { select: { id: true, name: true } },
      items:   true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const userId  = (session.user as any).id
  const role    = (session.user as any).role
  const isStaff = role === 'ADMIN' || role === 'AGENT'

  let resolvedClientId = parsed.data.clientId ?? null
  if (!isStaff) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    resolvedClientId = me?.clientId ?? null
  }

  const order = await prisma.order.create({
    data: {
      clientNote: parsed.data.clientNote ?? null,
      creatorId:  userId,
      clientId:   resolvedClientId,
      items: {
        create: parsed.data.items.map((item: any) => ({
          name:       item.name,
          quantity:   item.quantity,
          unit:       item.unit ?? null,
          clientNote: item.clientNote ?? null,
        })),
      },
    },
    include: {
      creator: { select: { id: true, name: true } },
      client:  { select: { id: true, name: true } },
      items:   true,
    },
  })
  logAudit(userId, 'order', order.id, 'created', null, order.orderNumber.toString()).catch(() => {})
  // Email adminovi + zodpovednemu agentovi
  ;(async () => {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, email: true } })
    const technicianLinks = resolvedClientId
      ? await prisma.clientTechnician.findMany({ where: { clientId: resolvedClientId }, include: { user: { select: { id: true, email: true } } } })
      : []
    const recipients = new Map<string, string>()
    for (const a of Array.from(admins)) { if (a.email) recipients.set(a.email, a.email) }
    for (const t of Array.from(technicianLinks)) { if (t.user?.email) recipients.set(t.user.email, t.user.email) }
    for (const email of Array.from(recipients.values())) {
      sendOrderCreated(email, {
        orderNumber: order.orderNumber,
        creatorName: (order.creator as any)?.name ?? '',
        clientName: (order.client as any)?.name,
        itemCount: order.items.length,
      }).catch(() => {})
    }
  })().catch(() => {})
  return NextResponse.json(order, { status: 201 })
}
