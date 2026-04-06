// src/app/api/tickets/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sendTicketAssigned, sendTicketResolved, sendNewComment } from '@/lib/email'

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
    where: { ticketNumber: Number(params.id) },
    include: {
      creator:  { select: { id: true, name: true, email: true, department: true } },
      assignee: { select: { id: true, name: true, email: true } },
      team:     { select: { id: true, name: true } },
      comments: {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
      attachments: true,
    },
  })

  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Clients can only view their own tickets
  const role   = (session.user as any).role
  const userId = (session.user as any).id
  if (role === 'CLIENT' && ticket.creatorId !== userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(ticket)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { comment, isInternal, ...ticketUpdate } = parsed.data
  const userId = (session.user as any).id

  const existing = await prisma.ticket.findUnique({
    where: { ticketNumber: Number(params.id) },
    include: { creator: true, assignee: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Set timestamps
  if (ticketUpdate.status === 'RESOLVED') (ticketUpdate as any).resolvedAt = new Date()
  if (ticketUpdate.status === 'CLOSED')   (ticketUpdate as any).closedAt   = new Date()

  const ticket = await prisma.ticket.update({
    where: { ticketNumber: Number(params.id) },
    data:  ticketUpdate,
    include: { creator: true, assignee: true },
  })

  // Add comment if provided
  if (comment?.trim()) {
    const newComment = await prisma.comment.create({
      data: {
        content:    comment,
        isInternal: isInternal ?? false,
        ticketId:   ticket.id,
        authorId:   userId,
      },
      include: { author: { select: { name: true } } },
    })

    // Notify client of new comment (if not internal)
    if (!isInternal) {
      try {
        await sendNewComment(ticket.creator.email, {
          ticketNumber: ticket.ticketNumber,
          subject:      ticket.subject,
          authorName:   newComment.author.name,
          comment,
        })
      } catch (e) { console.error('Email error:', e) }
    }
  }

  // Email notifications for status/assignee changes
  try {
    if (ticketUpdate.assigneeId && ticketUpdate.assigneeId !== existing.assigneeId) {
      await sendTicketAssigned(ticket.creator.email, {
        ticketNumber: ticket.ticketNumber,
        subject:      ticket.subject,
        agentName:    ticket.assignee?.name ?? 'Technik',
      })
    }
    if (ticketUpdate.status === 'RESOLVED') {
      await sendTicketResolved(ticket.creator.email, {
        ticketNumber: ticket.ticketNumber,
        subject:      ticket.subject,
      })
    }
  } catch (e) { console.error('Email error:', e) }

  return NextResponse.json(ticket)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.ticket.delete({ where: { ticketNumber: Number(params.id) } })
  return NextResponse.json({ success: true })
}
