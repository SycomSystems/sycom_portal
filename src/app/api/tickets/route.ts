import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getSlaDeadline } from '@/lib/utils'

const createSchema = z.object({
  subject:     z.string().min(5).max(200),
  description: z.string().min(10),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  category:    z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'EMAIL', 'SECURITY', 'CLOUD', 'ONBOARDING', 'OTHER']),
  clientId:    z.string().optional(),
})

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
  } else if (role === 'CLIENT_MANAGER') {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    if (me?.clientId) {
      where.clientId = me.clientId
    } else {
      where.creatorId = userId
    }
  }

  if (status)   where.status   = status.toUpperCase()
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
        _count:   { select: { comments: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
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
  const { subject, description, priority, category, clientId } = parsed.data

  // For CLIENT/CLIENT_MANAGER — automatically set clientId from their own profile
  let resolvedClientId = clientId ?? null
  if (!isStaff) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    resolvedClientId = me?.clientId ?? null
  }

  const ticket = await prisma.ticket.create({
    data: {
      subject,
      description,
      priority,
      category,
      clientId:    resolvedClientId,
      slaDeadline: getSlaDeadline(priority),
      creatorId:   userId,
    },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      client:  { select: { id: true, name: true } },
    },
  })

  if (ticket.creator?.email) {
    import('@/lib/email').then(({ sendTicketCreated }) => {
      sendTicketCreated(ticket.creator!.email!, {
        ticketNumber: ticket.ticketNumber,
        subject:      ticket.subject,
        priority:     ticket.priority,
        category:     ticket.category,
      }).catch(() => {})
    }).catch(() => {})
  }

  return NextResponse.json(ticket, { status: 201 })
}
