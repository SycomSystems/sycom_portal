// src/app/api/tickets/route.ts
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
  const page     = Number(searchParams.get('page') ?? 1)
  const limit    = Number(searchParams.get('limit') ?? 20)

  const where: any = {}

  // Clients only see their own tickets
  if (role === 'CLIENT') where.creatorId = userId

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
  const data   = parsed.data

  const ticket = await prisma.ticket.create({
    data: {
      subject:     data.subject,
      description: data.description,
      priority:    data.priority,
      category:    data.category,
      department:  data.department,
      creatorId:   userId,
      slaDeadline: getSlaDeadline(data.priority),
    },
    include: { creator: true },
  })

  // Send confirmation email
  try {
    await sendTicketCreated(ticket.creator.email, {
      ticketNumber: ticket.ticketNumber,
      subject:      ticket.subject,
      priority:     ticket.priority,
      category:     ticket.category,
    })
  } catch (e) {
    console.error('Email send failed:', e)
  }

  // Create notification
  await prisma.notification.create({
    data: {
      title:    'Tiket vytvorený',
      message:  `Váš tiket #T-${ticket.ticketNumber} bol prijatý`,
      type:     'success',
      userId,
      ticketId: ticket.id,
    },
  })

  return NextResponse.json(ticket, { status: 201 })
}
