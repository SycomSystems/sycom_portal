import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { sendOrderOffer, sendOrderResponse } from '@/lib/email'
import { z } from 'zod'

const patchSchema = z.object({
  status:    z.enum(['DOPYT','PONUKA_ODOSLANA','SCHVALENA','ZAMIETNUTA']).optional(),
  adminNote: z.string().optional(),
  items:     z.array(z.object({ id: z.string(), unitPrice: z.number().min(0) })).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      creator: { select: { id: true, name: true } },
      client:  { select: { id: true, name: true } },
      items:   true,
    },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const role    = (session.user as any).role
  const isStaff = role === 'ADMIN' || role === 'AGENT'
  const userId  = (session.user as any).id

  const order = await prisma.order.findUnique({ where: { id: params.id } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Klient moze len schvalit/zamietnut svoju objednavku vo stave PONUKA_ODOSLANA
  if (!isStaff) {
    const allowed = parsed.data.status === 'SCHVALENA' || parsed.data.status === 'ZAMIETNUTA'
    if (!allowed || order.status !== 'PONUKA_ODOSLANA') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (order.creatorId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: any = {}
  if (parsed.data.status !== undefined)    updates.status    = parsed.data.status
  if (parsed.data.adminNote !== undefined) updates.adminNote = parsed.data.adminNote

  const updated = await prisma.order.update({
    where: { id: params.id },
    data:  updates,
    include: {
      creator: { select: { id: true, name: true } },
      client:  { select: { id: true, name: true } },
      items:   true,
    },
  })

  // Aktualizuj ceny poloziek (len staff)
  if (isStaff && parsed.data.items?.length) {
    for (const item of parsed.data.items) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data:  { unitPrice: item.unitPrice },
      })
    }
    logAudit(userId, 'order', params.id, 'prices_updated', null, `${parsed.data.items.length} poloziek`).catch(() => {})
  }

  // Audit log zmeny stavu
  if (parsed.data.status && parsed.data.status !== order.status) {
    logAudit(userId, 'order', params.id, 'status_changed', order.status, parsed.data.status).catch(() => {})
  }

  // Audit log poznamky
  if (parsed.data.adminNote !== undefined && parsed.data.adminNote !== order.adminNote) {
    logAudit(userId, 'order', params.id, 'note_updated', null, parsed.data.adminNote.substring(0, 200)).catch(() => {})
  }

  // Emaily pri zmene stavu
  if (parsed.data.status && parsed.data.status !== order.status) {
    ;(async () => {
      const fullOrder = await prisma.order.findUnique({
        where: { id: params.id },
        include: { creator: { select: { email: true, name: true } }, client: true, items: true }
      })
      if (!fullOrder) return
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } })
      const techLinks = fullOrder.clientId
        ? await prisma.clientTechnician.findMany({ where: { clientId: fullOrder.clientId }, include: { user: { select: { email: true } } } })
        : []
      const staffEmails = new Set<string>()
      for (const a of Array.from(admins)) { if (a.email) staffEmails.add(a.email) }
      for (const t of Array.from(techLinks)) { if (t.user?.email) staffEmails.add(t.user.email) }

      if (parsed.data.status === 'PONUKA_ODOSLANA' && fullOrder.creator?.email) {
        const total = fullOrder.items.reduce((s: number, it: any) => s + (it.quantity * (it.unitPrice ?? 0)), 0)
        sendOrderOffer(fullOrder.creator.email, {
          orderNumber: fullOrder.orderNumber,
          recipientName: fullOrder.creator.name ?? '',
          itemCount: fullOrder.items.length,
          total,
          adminNote: fullOrder.adminNote ?? undefined,
        }).catch(() => {})
      }
      if (parsed.data.status === 'SCHVALENA' || parsed.data.status === 'ZAMIETNUTA') {
        const responder = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
        for (const email of Array.from(staffEmails)) {
          sendOrderResponse(email, {
            orderNumber: fullOrder.orderNumber,
            status: parsed.data.status as 'SCHVALENA' | 'ZAMIETNUTA',
            responderName: responder?.name ?? '',
          }).catch(() => {})
        }
      }
    })().catch(() => {})
  }
    return NextResponse.json(updated)
}
