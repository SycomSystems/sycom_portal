import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getMobileSession } from '@/lib/mobile-session'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { validateFile, sanitizeFilename } from '@/lib/attachments'

// Force Node.js runtime (required for fs/path usage)
export const runtime = 'nodejs'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'attachments')

// Returns the ticket if the current user may access it, otherwise null.
async function getAccessibleTicket(ticketId: string, userId: string, role: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return { ticket: null, forbidden: false }
  if (role === 'CLIENT' && ticket.creatorId !== userId) return { ticket: null, forbidden: true }
  if (role === 'CLIENT_MANAGER') {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
    if (!me?.clientId || me.clientId !== ticket.clientId) return { ticket: null, forbidden: true }
  }
  return { ticket, forbidden: false }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMobileSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role = (session.user as any).role

  const { ticket, forbidden } = await getAccessibleTicket(params.id, userId, role)
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!ticket) return NextResponse.json({ error: 'Tiket nenájdený' }, { status: 404 })

  const formData = await req.formData()
  const files = formData.getAll('files').filter((f: FormDataEntryValue): f is File => f instanceof File)
  const single = formData.get('file')
  if (single instanceof File) files.push(single)

  if (files.length === 0) return NextResponse.json({ error: 'Žiadny súbor' }, { status: 400 })

  if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })

  const created: any[] = []
  for (const file of files) {
    const check = validateFile(file.name, file.type, file.size)
    if (!check.ok) return NextResponse.json({ error: `${file.name}: ${check.error}` }, { status: 400 })

    const safe = sanitizeFilename(file.name)
    const stored = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
    const bytes = await file.arrayBuffer()
    await writeFile(path.join(UPLOAD_DIR, stored), Buffer.from(bytes))

    const record = await prisma.attachment.create({
      data: {
        filename: file.name,
        url: `/uploads/attachments/${stored}`,
        mimeType: file.type || null,
        size: file.size,
        ticketId: ticket.id,
      },
    })
    created.push(record)
  }

  logAudit(userId, 'ticket', ticket.id, 'attachment_added', null,
    created.map(a => a.filename).join(', ').substring(0, 200)).catch(() => {})

  return NextResponse.json(created.length === 1 ? created[0] : created, { status: 201 })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getMobileSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role = (session.user as any).role

  const { ticket, forbidden } = await getAccessibleTicket(params.id, userId, role)
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!ticket) return NextResponse.json({ error: 'Tiket nenájdený' }, { status: 404 })

  const attachments = await prisma.attachment.findMany({
    where: { ticketId: ticket.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(attachments)
}
