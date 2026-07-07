import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { getMobileSession } from '@/lib/mobile-session'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  const session = await getMobileSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role = (session.user as any).role

  const attachment = await prisma.attachment.findUnique({ where: { id: params.attachmentId } })
  if (!attachment || attachment.ticketId !== params.id) {
    return NextResponse.json({ error: 'Príloha nenájdená' }, { status: 404 })
  }

  // Access check — mirror ticket GET permissions.
  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } })
  if (!ticket) return NextResponse.json({ error: 'Tiket nenájdený' }, { status: 404 })
  if (role === 'CLIENT' && ticket.creatorId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (role === 'CLIENT_MANAGER') {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    if (!me?.clientId || me.clientId !== ticket.clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  await prisma.attachment.delete({ where: { id: attachment.id } })

  // Best-effort remove of the physical file.
  if (attachment.url?.startsWith('/uploads/')) {
    unlink(path.join(process.cwd(), 'public', attachment.url)).catch(() => {})
  }

  logAudit(userId, 'ticket', params.id, 'attachment_deleted', null, attachment.filename).catch(() => {})

  return NextResponse.json({ ok: true })
}
