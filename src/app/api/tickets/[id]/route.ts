import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['OPEN','IN_PROGRESS','WAITING','RESOLVED','CLOSED']).optional(),
  subject: z.string().min(5).max(200).optional(),
  description: z.string().min(10).optional(),
  priority: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  category: z.enum(['HARDWARE','SOFTWARE','NETWORK','EMAIL','SECURITY','CLOUD','ONBOARDING','OTHER']).optional(),
  assigneeId: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  comment: z.string().optional(),
  isInternal: z.boolean().optional(),
  workedHours: z.number().min(0).max(24).optional(),
  hoursType: z.enum(['STANDARD','STANDARD_MIMO','SERVER','SERVER_MIMO']).optional().nullable(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: {
      updatedBy: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      comments: { include: { author: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' } },
      attachments: true,
    },
  })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (session.user as any).role
  const userId = (session.user as any).id
  if (role === 'CLIENT' && ticket.creatorId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (role === 'CLIENT_MANAGER') {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    if (!me?.clientId || me.clientId !== ticket.clientId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const isClientRole = role === 'CLIENT' || role === 'CLIENT_MANAGER'
  const visibleComments = isClientRole
    ? ticket.comments.filter(c => !c.isInternal)
    : ticket.comments
  const totalWorkedHours = Math.round(visibleComments.reduce((sum, c) => sum + (c.workedHours ?? 0), 0) * 100) / 100
  return NextResponse.json({ ...ticket, comments: visibleComments, totalWorkedHours })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { status, subject, description, priority, category, assigneeId, teamId, clientId, comment, isInternal, workedHours, hoursType } = parsed.data
  const userId = (session.user as any).id
  const role = (session.user as any).role
  const isAdmin = role === 'ADMIN'
  const isStaff = role === 'ADMIN' || role === 'AGENT'
  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isResolving = status === 'RESOLVED' && ticket.status !== 'RESOLVED'
  const commentBody = comment?.trim() || (isResolving && isStaff && workedHours ? 'Tiket vyrieseny' : null)
  if (commentBody) {
    await prisma.comment.create({
      data: {
        body: commentBody,
        isInternal: isInternal ?? false,
        workedHours: isStaff ? (workedHours ?? 0) : 0,
        hoursType: isStaff && workedHours ? (hoursType ?? null) : null,
        ticketId: ticket.id,
        authorId: userId,
      },
    })
  }
  const updates: any = {}
  if (status) updates.status = status
  if (assigneeId !== undefined) updates.assigneeId = assigneeId
  if (teamId !== undefined) updates.teamId = teamId
  if (isResolving) updates.resolvedAt = new Date()
  updates.updatedById = userId
  if (isAdmin) {
    if (subject) updates.subject = subject
    if (description) updates.description = description
    if (priority) updates.priority = priority
    if (category) updates.category = category
    if (clientId !== undefined) updates.clientId = clientId ?? null
  }
  const updated = await prisma.ticket.update({
    where: { id: params.id },
    data: updates,
    include: {
      creator: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true } },
    },
  })
  ;(async () => {
    const { sendTicketAssigned, sendTicketResolved, sendTicketStatusChanged, sendNewComment } = await import('@/lib/email')
    const adminUsers = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, email: true, name: true, notifyAll: true } })
    const clientUsers = updated.clientId ? await prisma.user.findMany({
      where: { clientId: updated.clientId, role: { in: ['CLIENT', 'CLIENT_MANAGER'] } },
      select: { id: true, email: true, name: true }
    }) : []
    function getRecipients() {
      const map = new Map<string, { email: string; name: string }>()
      for (const a of adminUsers) {
        if (!a.email || a.id === userId) continue
        // notifyAll:false → only notify if they are assignee or creator
        if (!a.notifyAll) {
          const isAssignee = updated.assignee?.id === a.id
          const isCreator  = updated.creator?.id === a.id
          if (!isAssignee && !isCreator) continue
        }
        map.set(a.email, { email: a.email, name: a.name ?? 'Admin' })
      }
      if (updated.assignee?.email && updated.assignee.id !== userId)
        map.set(updated.assignee.email, { email: updated.assignee.email, name: updated.assignee.name ?? '' })
      if (updated.creator?.email && updated.creator.id !== userId)
        map.set(updated.creator.email, { email: updated.creator.email, name: updated.creator.name ?? '' })
      for (const u of clientUsers) {
        if (u.email && u.id !== userId) map.set(u.email, { email: u.email, name: u.name ?? '' })
      }
      return Array.from(map.values())
    }

    if (assigneeId && assigneeId !== ticket.assigneeId && updated.assignee?.email) {
      sendTicketAssigned(updated.assignee.email, { ticketNumber: updated.ticketNumber, subject: updated.subject, agentName: updated.assignee.name ?? '' }).catch(() => {})
    }
    if (isResolving) {
      for (const r of getRecipients()) {
        sendTicketResolved(r.email, { ticketNumber: updated.ticketNumber, subject: updated.subject }).catch(() => {})
      }
    }
    const statusChanged = status && status !== ticket.status && status !== 'RESOLVED'
    if (statusChanged && (status === 'IN_PROGRESS' || status === 'CLOSED')) {
      for (const r of getRecipients()) {
        sendTicketStatusChanged(r.email, { ticketNumber: updated.ticketNumber, subject: updated.subject, newStatus: status }).catch(() => {})
      }
    }
    if (commentBody && !isInternal) {
      const recipients = getRecipients()
      if (recipients.length > 0) {
        sendNewComment(recipients, {
          ticketNumber: updated.ticketNumber,
          subject: updated.subject,
          commentAuthor: (session.user as any).name ?? 'Neznámy',
          commentText: commentBody,
        }).catch(() => {})
      }
    }
  })().catch(() => {})

  // Audit log
  const auditUserId = userId
  if (status && status !== ticket.status) {
    logAudit(auditUserId, 'ticket', params.id, 'status_changed', ticket.status, status).catch(() => {})
  }
  if (priority && priority !== ticket.priority) {
    logAudit(auditUserId, 'ticket', params.id, 'priority_changed', ticket.priority, priority).catch(() => {})
  }
  if (assigneeId !== undefined && assigneeId !== ticket.assigneeId) {
    logAudit(auditUserId, 'ticket', params.id, 'assignee_changed', ticket.assigneeId ?? null, assigneeId ?? null).catch(() => {})
  }
  if (isAdmin && clientId !== undefined && clientId !== ticket.clientId) {
    logAudit(auditUserId, 'ticket', params.id, 'client_changed', ticket.clientId ?? null, clientId ?? null).catch(() => {})
  }
  if (commentBody) {
    logAudit(auditUserId, 'ticket', params.id, isInternal ? 'internal_comment_added' : 'comment_added', null, commentBody.substring(0, 200)).catch(() => {})
  }

  // In-app notifikacie
  if (commentBody && !isInternal) {
    if (updated.creatorId && updated.creatorId !== userId) {
      createNotification(updated.creatorId, 'TICKET_COMMENT',
        `Novy komentar na tikete #${updated.ticketNumber}: ${updated.subject}`, updated.id).catch(() => {})
    }
    if (updated.assigneeId && updated.assigneeId !== userId) {
      createNotification(updated.assigneeId, 'TICKET_COMMENT',
        `Novy komentar na tikete #${updated.ticketNumber}: ${updated.subject}`, updated.id).catch(() => {})
    }
  }
  if (status && status !== ticket.status) {
    if (updated.creatorId && updated.creatorId !== userId) {
      createNotification(updated.creatorId, 'TICKET_STATUS',
        `Stav tiketu #${updated.ticketNumber} zmeneny na: ${status}`, updated.id).catch(() => {})
    }
  }
  if (assigneeId && assigneeId !== ticket.assigneeId && updated.assigneeId) {
    createNotification(updated.assigneeId, 'TICKET_ASSIGNED',
      `Bol ti prideleny tiket #${updated.ticketNumber}: ${updated.subject}`, updated.id).catch(() => {})
  }

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await prisma.ticket.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
