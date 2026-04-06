// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now       = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart  = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalOpen,
    totalInProgress,
    resolvedToday,
    criticalOpen,
    totalThisMonth,
    byStatus,
    byPriority,
    byCategory,
    recentTickets,
    avgResolutionRaw,
    slaBreached,
  ] = await Promise.all([
    prisma.ticket.count({ where: { status: 'OPEN' } }),
    prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.ticket.count({ where: { status: 'RESOLVED', resolvedAt: { gte: todayStart } } }),
    prisma.ticket.count({ where: { status: 'OPEN', priority: 'CRITICAL' } }),
    prisma.ticket.count({ where: { createdAt: { gte: monthStart } } }),

    prisma.ticket.groupBy({ by: ['status'],   _count: true }),
    prisma.ticket.groupBy({ by: ['priority'], _count: true }),
    prisma.ticket.groupBy({ by: ['category'], _count: true }),

    prisma.ticket.findMany({
      where: { createdAt: { gte: weekStart } },
      include: {
        creator:  { select: { name: true } },
        assignee: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    prisma.ticket.findMany({
      where: { status: 'RESOLVED', resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 100,
    }),

    prisma.ticket.count({
      where: {
        slaDeadline: { lt: now },
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
      },
    }),
  ])

  // Average resolution time in hours
  const avgResolutionHours = avgResolutionRaw.length
    ? avgResolutionRaw.reduce((acc, t) => {
        const diff = new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()
        return acc + diff / 3_600_000
      }, 0) / avgResolutionRaw.length
    : 0

  // Tickets per day (last 7 days)
  const ticketsPerDay = await Promise.all(
    Array.from({ length: 7 }).map(async (_, i) => {
      const date = new Date(todayStart)
      date.setDate(date.getDate() - (6 - i))
      const nextDate = new Date(date); nextDate.setDate(date.getDate() + 1)
      const count = await prisma.ticket.count({
        where: { createdAt: { gte: date, lt: nextDate } },
      })
      return {
        date:  date.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric' }),
        count,
      }
    })
  )

  return NextResponse.json({
    summary: {
      totalOpen,
      totalInProgress,
      resolvedToday,
      criticalOpen,
      totalThisMonth,
      avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
      slaBreached,
    },
    byStatus,
    byPriority,
    byCategory,
    recentTickets,
    ticketsPerDay,
  })
}
