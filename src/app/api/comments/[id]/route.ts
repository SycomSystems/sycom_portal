import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only ADMIN can delete comments (to remove logged work time)
  const role = (session.user as any).role
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can delete comments' }, { status: 403 })
  }

  const comment = await prisma.comment.findUnique({ where: { id: params.id } })
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.comment.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
