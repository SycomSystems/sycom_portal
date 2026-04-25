import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const domains = await prisma.allowedDomain.findMany({ orderBy: { domain: 'asc' } })
  return NextResponse.json(domains)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { domain, note } = await req.json()
  if (!domain || typeof domain !== 'string') return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  const normalized = domain.toLowerCase().trim().replace(/^@/, '')
  try {
    const created = await prisma.allowedDomain.create({ data: { domain: normalized, note: note || null } })
    return NextResponse.json(created, { status: 201 })
  } catch (err: any) {
    if (err.code === 'P2002') return NextResponse.json({ error: 'Doména už existuje' }, { status: 409 })
    throw err
  }
}
