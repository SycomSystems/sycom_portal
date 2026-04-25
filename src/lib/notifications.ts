import { prisma } from './prisma'

export async function createNotification(
  userId: string,
  type: string,
  message: string,
  ticketId?: string
) {
  try {
    await prisma.notification.create({
      data: { userId, type, message, ticketId: ticketId ?? null },
    })
  } catch (err: any) {
    console.error('[notifications] createNotification failed:', err.message)
  }
}
