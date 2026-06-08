'use strict'

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function calcNextRun(scheduleType, intervalDays, weekday, monthDay, from) {
  const base = from ? new Date(from) : new Date()
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

async function generateTicketNumber() {
  while (true) {
    const n = Math.floor(100000000 + Math.random() * 900000000)
    const existing = await prisma.ticket.findUnique({ where: { ticketNumber: n } })
    if (!existing) return n
  }
}

function log(tag, msg) {
  console.log(`[${new Date().toISOString()}] [${tag}] ${msg}`)
}

async function runRecurringTickets() {
  const now = new Date()
  const due = await prisma.recurringTicket.findMany({
    where: { isActive: true, nextRunAt: { lte: now } },
  })
  if (due.length === 0) return
  log('tickets', `${due.length} splatnych zaznamov`)
  for (const rt of due) {
    try {
      const ticketNumber = await generateTicketNumber()
      await prisma.ticket.create({
        data: {
          ticketNumber,
          subject: rt.subject,
          description: rt.description ?? null,
          clientId: rt.clientId ?? null,
          assignedToId: rt.assignedToId ?? null,
          priority: rt.priority,
          status: 'OPEN',
          createdById: rt.createdById,
        },
      })
      const nextRunAt = calcNextRun(rt.scheduleType, rt.intervalDays, rt.weekday, rt.monthDay, now)
      await prisma.recurringTicket.update({
        where: { id: rt.id },
        data: { lastRunAt: now, nextRunAt },
      })
      log('tickets', `Vytvoreny tiket #${ticketNumber} z "${rt.subject}" | dalsi beh: ${nextRunAt.toISOString()}`)
    } catch (err) {
      log('tickets', `CHYBA pre recurring ${rt.id}: ${err.message}`)
    }
  }
}

async function runRecurringReports() {
  const now = new Date()
  const due = await prisma.recurringReport.findMany({
    where: { isActive: true, nextRunAt: { lte: now } },
  })
  if (due.length === 0) return
  log('reports', `${due.length} splatnych zaznamov`)
  for (const rr of due) {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      await prisma.manualHours.create({
        data: {
          date: today,
          name: rr.name,
          hoursType: rr.hoursType,
          hours: rr.isService ? 0 : rr.hours,
          userId: rr.userId,
          clientId: rr.clientId ?? null,
        },
      })
      const nextRunAt = calcNextRun(rr.scheduleType, rr.intervalDays, rr.weekday, rr.monthDay, now)
      await prisma.recurringReport.update({
        where: { id: rr.id },
        data: { lastRunAt: now, nextRunAt },
      })
      log('reports', `Vytvoreny ManualHours "${rr.name}" pre user ${rr.userId} | dalsi beh: ${nextRunAt.toISOString()}`)
    } catch (err) {
      log('reports', `CHYBA pre recurring ${rr.id}: ${err.message}`)
    }
  }
}

async function run() {
  try {
    await runRecurringTickets()
    await runRecurringReports()
  } catch (err) {
    log('runner', `Fatalna chyba: ${err.message}`)
  }
}

log('runner', 'Spusteny — kontrolujem kazdych 5 minut')
run()
setInterval(run, 5 * 60 * 1000)
