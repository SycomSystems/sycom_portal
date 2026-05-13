interface PushMsg { to: string; title: string; body: string; data?: any; sound?: string }

export async function sendPushNotifications(msgs: PushMsg[]) {
  const valid = msgs.filter(m => m.to.startsWith('ExponentPushToken['))
  if (!valid.length) return
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(valid),
    })
  } catch (e) { console.error('[PUSH]', e) }
}

export async function notifyStaffNewTicket(prisma: any, ticket: { id: string; subject: string; client?: { name: string } | null }, excludeUserId?: string) {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'AGENT'] }, expoPushToken: { not: null }, ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}) },
    select: { expoPushToken: true },
  })
  await sendPushNotifications(staff.map((u: any) => ({
    to: u.expoPushToken,
    title: '🎫 Nový tiket',
    body: ticket.client ? `${ticket.client.name}: ${ticket.subject}` : ticket.subject,
    data: { ticketId: ticket.id },
    sound: 'default',
  })))
}
