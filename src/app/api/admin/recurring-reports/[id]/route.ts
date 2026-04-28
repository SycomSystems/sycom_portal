import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function calcNextRun(scheduleType: string, intervalDays?: number, weekday?: number, monthDay?: number): Date {
  const base = new Date(); base.setSeconds(0, 0)
  if (scheduleType === 'INTERVAL') {
    const d = new Date(base); d.setDate(d.getDate() + (intervalDays ?? 7)); return d
  }
  if (scheduleType === 'WEEKDAY' && weekday != null) {
    const d = new Date(base); d.setHours(7, 0, 0, 0)
    const diff = (weekday - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + diff); return d
  }
  if (scheduleType === 'MONTHDAY' && monthDay != null) {
    const d = new Date(base); d.setHours(7, 0, 0, 0); d.setDate(monthDay)
    if (d <= base) d.setMonth(d.getMonth() + 1); return d
  }
  const fb = new Date(base); fb.setDate(fb.getDate() + 7); return fb
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const { name, hoursType, hours, note, isService, assignedUserId, clientId, scheduleType, intervalDays, weekday, monthDay, isActive, nextRunAt } = body
  const upd: any = {}
  if (name !== undefined) upd.name = name
  if (hoursType !== undefined) upd.hoursType = hoursType
  if (hours !== undefined) upd.hours = Number(hours)
  if (note !== undefined) upd.note = note
  if (isService !== undefined) upd.isService = isService
  if (assignedUserId !== undefined) upd.userId = assignedUserId
  if (clientId !== undefined) upd.clientId = clientId
  if (isActive !== undefined) upd.isActive = isActive
  if (nextRunAt !== undefined) upd.nextRunAt = new Date(nextRunAt)
  if (scheduleType !== undefined) {
    upd.scheduleType = scheduleType
    upd.intervalDays = intervalDays ?? null
    upd.weekday = weekday ?? null
    upd.monthDay = monthDay ?? null
    if (nextRunAt === undefined) upd.nextRunAt = calcNextRun(scheduleType, intervalDays, weekday, monthDay)
  }
  const item = await prisma.recurringReport.update({
    where: { id: params.id },
    data: upd,
    include: {
      user: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await prisma.recurringReport.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
