import { NextRequest, NextResponse } from 'next/server'
import { getMobileSession } from '@/lib/mobile-session'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getMobileSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { content, isInternal } = await req.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Obsah komentára je povinný' }, { status: 400 })
    }

    // Skontroluj či tiket existuje a user má prístup
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: params.id,
        ...(session.user.role === 'CLIENT'
          ? { client: { users: { some: { id: session.user.id } } } }
          : {}),
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Tiket nenájdený' }, { status: 404 })
    }

    const comment = await prisma.comment.create({
      data: {
        body: content.trim(),
        ticketId: params.id,
        authorId: session.user.id,
        isInternal: isInternal === true && session.user.role !== 'CLIENT',
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('[COMMENTS POST]', error)
    return NextResponse.json({ error: 'Interná chyba servera' }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getMobileSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const comments = await prisma.comment.findMany({
      where: {
        ticketId: params.id,
        ...(session.user.role === 'CLIENT' ? { isInternal: false } : {}),
      },
      include: {
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error('[COMMENTS GET]', error)
    return NextResponse.json({ error: 'Interná chyba servera' }, { status: 500 })
  }
}
