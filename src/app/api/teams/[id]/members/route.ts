// src/app/api/teams/[id]/members/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, isLead } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const member = await prisma.teamMember.upsert({
    where:  { userId_teamId: { userId, teamId: params.id } },
    update: { isLead: isLead ?? false },
    create: { userId, teamId: params.id, isLead: isLead ?? false },
  })

  return NextResponse.json(member, { status: 201 })
}
