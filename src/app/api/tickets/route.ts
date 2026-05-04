import { logAudit } from '@/lib/audit'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { z } from 'zod'
import { getSlaDeadline } from '@/lib/utils'

const createSchema = z.object({
  subject:     z.string().min(5).max(200),
  description: z.string().min(10),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH']),
  category:    z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'EMAIL', 'SECURITY', 'CLOUD', 'ONBOARDING', 'OTHER']),
  clientId:    z.string().optional(),
  assigneeId:  z.string().optional(),
  slaDeadline: z.string().optional(),
})


async function generateTicketNumber(): Promise<number> {
  while (true) {
    const n = Math.floor(100000000 + Math.random() * 900000000)
    const existing = await prisma.ticket.findUnique({ where: { ticketNumber: n } })
    if (!existing) return n
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const role     = (session.user as any).role
  const userId   = (session.user as any).id
  const status   = searchParams.get('status')
  const priority = searchParams.get('priority')
  const search   = searchParams.get('search')
  const page     = parseInt(searchParams.get('page') || '1')
  const limit    = parseInt(searchParams.get('limit') || '20')

  const where: any = {}

  if (role === 'CLIENT') {
    where.creatorId = userId
  } else if (role === 'AGENT') {
    const assigned = await prisma.clientTechnician.findMany({ where: { userId }, select: { clientId: true } })
    where.clientId = { in: assigned.map(a => a.clientId) }
  } else if (role === 'CLIENT_MANAGER') {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    if (me?.clientId) {
      where.clientId = me.clientId
    } else {
      where.creatorId = userId
    }
  }

  if (status)   where.status   = status.includes(',') ? { in: status.split(',').map((s: string) => s.toUpperCase()) } : status.toUpperCase()
  if (priority) where.priority = priority.toUpperCase()
  if (search)   where.OR = [
    { subject:     { contains: search } },
    { description: { contains: search } },
  ]

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        creator:  { select: { id: true, name: true, email: true } },
        client:   { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        team:     { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        _count:   { select: { comments: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.ticket.count({ where }),
  ])

  return NextResponse.json({ tickets, total, page, limit })
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
  const { subject, description, priority, category, clientId, assigneeId, slaDeadline } = parsed.data

  // For CLIENT/CLIENT_MANAGER — automatically set clientId from their own profile
  let resolvedClientId = clientId ?? null
  if (!isStaff) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    resolvedClientId = me?.clientId ?? null
  }

  // Auto-assign technician from client if not provided
  let resolvedAssigneeId = assigneeId ?? null
  if (!resolvedAssigneeId && resolvedClientId) {
    const tech = await prisma.clientTechnician.findFirst({
      where: { clientId: resolvedClientId },
      select: { userId: true },
    })
    resolvedAssigneeId = tech?.userId ?? null
  }
  const resolvedSla = slaDeadline ? new Date(slaDeadline) : getSlaDeadline(priority)
  const ticketNumber = await generateTicketNumber()
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      subject,
      description,
      priority,
      category,
      clientId:    resolvedClientId,
      slaDeadline: resolvedSla,
      creatorId:   userId,
      updatedById: userId,
      assigneeId:  resolvedAssigneeId,
    },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      client:  { select: { id: true, name: true } },
    },
  })

  ;(async () => {
    const { sendTicketCreated, sendTicketAssigned } = await import('@/lib/email')
    // Email klientovi (potvrdenie)
    if (ticket.creator?.email) {
      sendTicketCreated(ticket.creator!.email!, {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        priority: ticket.priority,
        category: ticket.category,
        clientName: ticket.client?.name,
      }).catch(() => {})
    }
    // Email agentovi (pridelenie)
    if (resolvedAssigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: resolvedAssigneeId }, select: { email: true, name: true } })
      if (assignee?.email) {
        sendTicketAssigned(assignee.email, { ticketNumber: ticket.ticketNumber, subject: ticket.subject, agentName: assignee.name ?? '' }).catch(() => {})
      }
    }
    // Email adminovi (notifikacia o novom tikete)
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, email: true, name: true } })
    for (const admin of admins) {
      if (admin.email && admin.id !== userId) {
        sendTicketCreated(admin.email, {
          ticketNumber: ticket.ticketNumber,
          subject:      ticket.subject,
          priority:     ticket.priority,
          category:     ticket.category,
        }).catch(() => {})
      }
    }
  })().catch(() => {})

  // In-app notifikacia pre technika
  if (resolvedAssigneeId) {
    createNotification(
      resolvedAssigneeId,
      'NEW_TICKET',
      `Novy tiket #${ticket.ticketNumber}: ${ticket.subject}`,
      ticket.id
    ).catch(() => {})
  }

  await logAudit(userId, 'ticket', ticket.id, 'CREATE', null, { subject: ticket.subject, clientId: ticket.clientId })
    return NextResponse.json(ticket, { status: 201 })
}
