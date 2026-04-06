// src/app/api/teams/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  name:        z.string().min(2),
  description: z.string().optional(),
  color:       z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const teams = await prisma.team.findMany({
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
      _count: { select: { tickets: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(teams)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const team = await prisma.team.create({ data: parsed.data })
  return NextResponse.json(team, { status: 201 })
}
