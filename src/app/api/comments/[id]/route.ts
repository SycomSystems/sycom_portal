import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  const comment = await prisma.comment.findUnique({ where: { id: params.id } })
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (comment.authorId !== userId && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { body, createdAt } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Body is required' }, { status: 400 })

  const updated = await prisma.comment.update({
    where: { id: params.id },
    data: { body: body.trim(), ...(createdAt ? { createdAt: new Date(createdAt) } : {}) },
  })

  await logAudit(userId, 'comment', params.id, 'EDIT_COMMENT', { body: comment.body }, { body: body.trim() })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can delete comments' }, { status: 403 })
  }
  const comment = await prisma.comment.findUnique({ where: { id: params.id } })
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.comment.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
