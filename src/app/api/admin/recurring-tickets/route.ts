import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function calcNextRun(scheduleType: string, intervalDays?: number, weekday?: number, monthDay?: number, from?: Date): Date {
    const base = from ?? new Date()
    base.setSeconds(0, 0)

    if (scheduleType === 'INTERVAL') {
          const d = new Date(base)
          d.setDate(d.getDate() + (intervalDays ?? 7))
          return d
        }

    if (scheduleType === 'WEEKDAY' && weekday != null) {
          const d = new Date(base)
          d.setHours(7, 0, 0, 0)
          const diff = (weekday - d.getDay() + 7) % 7 || 7
          d.setDate(d.getDate() + diff)
          return d
        }

    if (scheduleType === 'MONTHDAY' && monthDay != null) {
          const d = new Date(base)
          d.setHours(7, 0, 0, 0)
          d.setDate(monthDay)
          if (d <= base) d.setMonth(d.getMonth() + 1)
          return d
        }

    const fallback = new Date(base)
    fallback.setDate(fallback.getDate() + 7)
    return fallback
  }

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const items = await prisma.recurringTicket.findMany({
          include: {
                  client: { select: { id: true, name: true } },
                  assignedTo: { select: { id: true, name: true } },
                  createdBy: { select: { id: true, name: true } },
                },
          orderBy: { createdAt: 'desc' },
        })
    return NextResponse.json(items)
  }

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const userId = (session.user as any).id

    const body = await req.json()
    const { subject, description, clientId, assignedToId, priority, scheduleType, intervalDays, weekday, monthDay, firstRunAt } = body

    if (!subject?.trim()) return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    if (!scheduleType) return NextResponse.json({ error: 'scheduleType is required' }, { status: 400 })

    const from = firstRunAt ? new Date(firstRunAt) : undefined
    const nextRunAt = calcNextRun(scheduleType, intervalDays, weekday, monthDay, from)

    const item = await prisma.recurringTicket.create({
          data: {
                  subject: subject.trim(),
                  description: description ?? null,
                  clientId: clientId ?? null,
                  assignedToId: assignedToId ?? null,
                  priority: priority ?? 'MEDIUM',
                  scheduleType,
                  intervalDays: intervalDays ?? null,
                  weekday: weekday ?? null,
                  monthDay: monthDay ?? null,
                  nextRunAt,
                  createdById: userId,
                },
          include: {
                  client: { select: { id: true, name: true } },
                  assignedTo: { select: { id: true, name: true } },
                  createdBy: { select: { id: true, name: true } },
                },
        })
    return NextResponse.json(item, { status: 201 })
  }
