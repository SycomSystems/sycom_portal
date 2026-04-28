import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function calcNextRun(scheduleType: string, intervalDays?: number, weekday?: number, monthDay?: number, from?: Date): Date {
  const base = from ?? new Date()
  base.setSeconds(0, 0)
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

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const items = await prisma.recurringReport.findMany({
    include: {
      user: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const userId = (session.user as any).id
  const body = await req.json()
  const { name, hoursType, hours, note, isService, assignedUserId, clientId, scheduleType, intervalDays, weekday, monthDay, firstRunAt } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Názov je povinný' }, { status: 400 })
  if (!scheduleType) return NextResponse.json({ error: 'Typ plánu je povinný' }, { status: 400 })
  if (!assignedUserId) return NextResponse.json({ error: 'Technik je povinný' }, { status: 400 })
  const from = firstRunAt ? new Date(firstRunAt) : undefined
  const nextRunAt = calcNextRun(scheduleType, intervalDays, weekday, monthDay, from)
  const item = await prisma.recurringReport.create({
    data: {
      name: name.trim(),
      hoursType: hoursType ?? (isService ? 'paušál' : 'práca'),
      hours: Number(hours) || 1,
      note: note ?? null,
      isService: isService ?? false,
      userId: assignedUserId,
      clientId: clientId ?? null,
      scheduleType,
      intervalDays: intervalDays ?? null,
      weekday: weekday ?? null,
      monthDay: monthDay ?? null,
      nextRunAt,
      createdById: userId,
    },
    include: {
      user: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(item, { status: 201 })
}
