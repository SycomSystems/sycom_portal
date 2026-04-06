// src/app/api/tickets/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  status:     z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
  priority:   z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assigneeId: z.string().optional().nullable(),
  teamId:     z.string().optional().nullable(),
  comment:    z.string().optional(),
  isInternal: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: {
      creator:  { select: { id: true, name: true, email: true, client: { select: { id: true, name: true } } } },
      assignee: { select: { id: true, name: true } },
      team:     { select: { id: true, name: true } },
      comments: {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
      attachments: true,
    },
  })

  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role   = (session.user as any).role
  const userId = (session.user as any).id

  if (role === 'CLIENT' && ticket.creatorId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (role === 'CLIENT_MANAGER') {
    const me      = await prisma.user.findUnique({ where: { id: userId },           select: { clientId: true } })
    const creator = await prisma.user.findUnique({ where: { id: ticket.creatorId }, select: { clientId: true } })
    if (!me?.clientId || me.clientId !== creator?.clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return NextResponse.json(ticket)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { status, priority, assigneeId, teamId, comment, isInternal } = parsed.data
  const userId = (session.user as any).id

  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (comment) {
    await prisma.comment.create({
      data: {
        body:       comment,
        isInternal: isInternal ?? false,
        ticketId:   ticket.id,
        authorId:   userId,
      },
    })
  }

  const updates: any = {}
  if (status)                   updates.status     = status
  if (priority)                 updates.priority   = priority
  if (assigneeId !== undefined) updates.assigneeId = assigneeId
  if (teamId     !== undefined) updates.teamId     = teamId
  if (status === 'RESOLVED')    updates.resolvedAt = new Date()

  const updated = await prisma.ticket.update({
    where: { id: params.id },
    data: updates,
    include: {
      creator:  { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      team:     { select: { id: true, name: true } },
    },
  })

  // Fire-and-forget email notifications — never block the response
  import('@/lib/email').then(({ sendTicketAssigned, sendTicketResolved }) => {
    if (assigneeId && assigneeId !== ticket.assigneeId && updated.assignee?.email) {
      sendTicketAssigned(updated.assignee.email, {
        ticketNumber: updated.ticketNumber,
        subject:      updated.subject,
        agentName:    updated.assignee.name ?? '',
      }).catch(() => {})
    }
    if (status === 'RESOLVED' && ticket.status !== 'RESOLVED' && updated.creator?.email) {
      sendTicketResolved(updated.creator.email, {
        ticketNumber: updated.ticketNumber,
        subject:      updated.subject,
      }).catch(() => {})
    }
  }).catch(() => {})

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'ADMIN' && role !== 'AGENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.ticket.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
