import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '100'), 500)
  const logs = await prisma.aiApiLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json(logs)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await prisma.aiApiLog.deleteMany()
  return NextResponse.json({ ok: true })
}
