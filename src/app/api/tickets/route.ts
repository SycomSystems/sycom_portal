import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getSlaDeadline } from '@/lib/utils'
import { sendTicketCreated } from '@/lib/email'

const createSchema = z.object({
  subject:     z.string().min(5).max(200),
  description: z.string().min(10),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  category:    z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'EMAIL', 'SECURITY', 'CLOUD', 'ONBOARDING', 'OTHER']),
  department:  z.string().optional(),
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
    // CLIENT sees only their own tickets
    where.creatorId = userId
  } else if (role === 'CLIENT_MANAGER') {
    // CLIENT_MANAGER sees all tickets from users with the same clientId
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    if (me?.clientId) {
      where.creator = { clientId: me.clientId }
    } else {
      // No client assigned — fall back to own tickets only
      where.creatorId = userId
    }
  }
  // ADMIN and AGENT see all tickets (no filter)

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
        creator:  { select: { id: true, name: true, email: true, client: { select: { id: true, name: true } } } },
        assignee: { select: { id: true, name: true } },
        team:     { select: { id: true, name: true } },
        _count:   { select: { comments: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
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

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const userId = (session.user as any).id
  const { subject, description, priority, category, department } = parsed.data

  const ticket = await prisma.ticket.create({
    data: {
      subject,
      description,
      priority,
      category,
      department,
      slaDeadline: getSlaDeadline(priority),
      creatorId: userId,
    },
    include: {
      creator: { select: { id: true, name: true, email: true } },
    },
  })

  try { await sendTicketCreated(ticket) } catch {}

  return NextResponse.json(ticket, { status: 201 })
}
