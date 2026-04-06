import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true } } },
  })
  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  try {
    const client = await prisma.client.create({ data: { name: name.trim() } })
    return NextResponse.json(client, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Client name already exists' }, { status: 409 })
  }
}
