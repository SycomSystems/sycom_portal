import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function calcNextRun(scheduleType: string, intervalDays?: number, weekday?: number, monthDay?: number): Date {
    const base = new Date()
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { subject, description, clientId, assignedToId, priority, scheduleType, intervalDays, weekday, monthDay, isActive, nextRunAt } = body

    const updateData: any = {}
    if (subject !== undefined) updateData.subject = subject
    if (description !== undefined) updateData.description = description
    if (clientId !== undefined) updateData.clientId = clientId
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId
    if (priority !== undefined) updateData.priority = priority
    if (isActive !== undefined) updateData.isActive = isActive
    if (nextRunAt !== undefined) updateData.nextRunAt = new Date(nextRunAt)

    if (scheduleType !== undefined) {
          updateData.scheduleType = scheduleType
          updateData.intervalDays = intervalDays ?? null
          updateData.weekday = weekday ?? null
          updateData.monthDay = monthDay ?? null
          if (nextRunAt === undefined) {
                  updateData.nextRunAt = calcNextRun(scheduleType, intervalDays, weekday, monthDay)
                }
        }

    const item = await prisma.recurringTicket.update({
          where: { id: params.id },
          data: updateData,
          include: {
                  client: { select: { id: true, name: true } },
                  assignedTo: { select: { id: true, name: true } },
                  createdBy: { select: { id: true, name: true } },
                },
        })
    return NextResponse.json(item)
  }

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await prisma.recurringTicket.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  }
