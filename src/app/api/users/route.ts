// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const createSchema = z.object({
  name:       z.string().min(2),
  email:      z.string().email(),
  password:   z.string().min(8),
  role:       z.enum(['ADMIN', 'AGENT', 'CLIENT']),
  department: z.string().optional(),
  phone:      z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const filterRole = searchParams.get('role')
  const search     = searchParams.get('search')

  const where: any = {}
  if (filterRole) where.role = filterRole.toUpperCase()
  if (search) where.OR = [
    { name:  { contains: search } },
    { email: { contains: search } },
  ]

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, name: true, email: true, role: true,
      department: true, phone: true, isActive: true, createdAt: true,
      _count: { select: { ticketsCreated: true, ticketsAssigned: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 409 })

  const hashed = await bcrypt.hash(parsed.data.password, 12)
  const user   = await prisma.user.create({
    data: { ...parsed.data, password: hashed },
    select: { id: true, name: true, email: true, role: true, department: true },
  })

  return NextResponse.json(user, { status: 201 })
}
