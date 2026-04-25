import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN' && role !== 'AGENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const roleFilter = req.nextUrl.searchParams.get('role')
  const users = await prisma.user.findMany({
    where: roleFilter ? { role: roleFilter as any } : undefined,
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, email: true, role: true,
      department: true, phone: true, isActive: true,
      createdAt: true, clientId: true,
      client: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, email, password, role, department, phone, clientId } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email and password are required' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 12)
  try {
    const user = await prisma.user.create({
      data: {
        name, email, password: hashed,
        role: role || 'CLIENT',
        department: department || null,
        phone: phone || null,
        clientId: clientId || null,
      },
      select: { id: true, name: true, email: true, role: true, clientId: true, client: { select: { id: true, name: true } } },
    })
    return NextResponse.json(user, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
  }
}
