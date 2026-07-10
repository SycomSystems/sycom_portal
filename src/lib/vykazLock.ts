import { prisma } from '@/lib/prisma'

/** Rok a mesiac (1-12) daného dátumu. Používa lokálny čas servera, rovnako ako výkaz. */
export function yearMonth(date: Date): { year: number; month: number } {
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

/**
 * Je výkaz daného klienta za mesiac dátumu zamknutý?
 * Záznamy bez klienta (clientId == null) sa nedajú zamknúť → false.
 */
export async function isMonthLocked(clientId: string | null | undefined, date: Date): Promise<boolean> {
  if (!clientId) return false
  const { year, month } = yearMonth(date)
  const lock = await prisma.vykazLock.findUnique({
    where: { clientId_year_month: { clientId, year, month } },
  })
  return !!lock
}
