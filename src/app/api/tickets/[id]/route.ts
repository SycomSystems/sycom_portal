// src/app/api/tickets/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
  subject: z.string().min(5).max(200).optional(),
  description: z.string().min(10).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  category: z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'EMAIL', 'SECURITY', 'CLOUD', 'ONBOARDING', 'OTHER']).optional(),
  assigneeId: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  comment: z.string().optional(),
  isInternal: z.boolean().optional(),
  workedHours: z.number().min(0).max(24).optional(),
  hoursType: z.enum(['STANDARD', 'STANDARD_MIMO', 'SERVER', 'SERVER_MIMO']).optional().nullable(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      comments: {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
      attachments: true,
    },
  })

  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  if (role === 'CLIENT' && ticket.creatorId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (role === 'CLIENT_MANAGER') {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    if (!me?.clientId || me.clientId !== ticket.clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const totalWorkedHours = Math.round(
    ticket.comments.reduce((sum, c) => sum + (c.workedHours ?? 0), 0) * 100
  ) / 100

  return NextResponse.json({ ...ticket, totalWorkedHours })
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
  const commentBody = comment?.trim() || (isResolving && isStaff && workedHours ? 'Tiket vyriešený' : null)

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

  if (isAdmin) {
    if (subject) updates.subject = subject
    if (description) updates.description = description
    if (priority) updates.priority = priority
    if (category) updates.category = category
    if (clientId !== undefined) updates.clientId = clientId ?? null
  }

  const updated = await prisma.ticket.update({
    where: { id: params.id },
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
  subject: z.string().min(5).max(200).optional(),
  description: z.string().min(10).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  category: z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'EMAIL', 'SECURITY', 'CLOUD', 'ONBOARDING', 'OTHER']).optional(),
  assigneeId: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  comment: z.string().optional(),
  isInternal: z.boolean().optional(),
  workedHours: z.number().min(0).max(24).optional(),
  hoursType: z.enum(['STANDARD', 'STANDARD_MIMO', 'SERVER', 'SERVER_MIMO']).optional().nullable(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      comments: {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
      attachments: true,
    },
  })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = (session.user as any).role
  const userId = (session.user as any).id
  if (role === 'CLIENT' && ticket.creatorId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (role === 'CLIENT_MANAGER') {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    if (!me?.clientId || me.clientId !== ticket.clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
  const totalWorkedHours = Math.round(
    ticket.comments.reduce((sum, c) => sum + (c.workedHours ?? 0), 0) * 100
  ) / 100
  return NextResponse.json({ ...ticket, totalWorkedHours })
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
  import('@/lib/email').then(({ sendTicketAssigned, sendTicketResolved }) => {
    if (assigneeId && assigneeId !== ticket.assigneeId && updated.assignee?.email) {
      sendTicketAssigned(updated.assignee.email, { ticketNumber: updated.ticketNumber, subject: updated.subject, agentName: updated.assignee.name ?? '' }).catch(() => {})
    }
    if (isResolving && updated.creator?.email) {
      sendTicketResolved(updated.creator.email, { ticketNumber: updated.ticketNumber, subject: updated.subject }).catch(() => {})
    }
  }).catch(() => {})
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
