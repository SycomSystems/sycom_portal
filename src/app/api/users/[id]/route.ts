import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true, role: true,
      department: true, phone: true, isActive: true, createdAt: true,
      clientId: true, client: { select: { id: true, name: true } },
    },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { name, email, password, role, department, phone, isActive, clientId } = await req.json()

  const validRoles = ['ADMIN', 'AGENT', 'CLIENT', 'CLIENT_MANAGER']
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const hashedPassword = password ? await bcrypt.hash(password, 12) : undefined
  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(name           !== undefined && { name }),
      ...(email          !== undefined && { email }),
      ...(hashedPassword !== undefined && { password: hashedPassword }),
      ...(role           !== undefined && { role }),
      ...(department     !== undefined && { department }),
      ...(phone          !== undefined && { phone }),
      ...(isActive       !== undefined && { isActive }),
      ...(clientId       !== undefined && { clientId: clientId || null }),
    },
    select: {
      id: true, name: true, email: true, role: true,
      department: true, phone: true, isActive: true,
      clientId: true, client: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(user)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
