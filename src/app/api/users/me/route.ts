import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, password, oldPassword } = body

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const updateData: any = {}

  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: 'Meno nesmie byť prázdne.' }, { status: 400 })
    updateData.name = name.trim()
  }

  if (password !== undefined) {
    if (!oldPassword) return NextResponse.json({ error: 'Zadajte aktuálne heslo.' }, { status: 400 })
    const valid = await bcrypt.compare(oldPassword, user.password)
    if (!valid) return NextResponse.json({ error: 'Aktuálne heslo je nesprávne.' }, { status: 400 })
    updateData.password = await bcrypt.hash(password, 12)
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nič na uloženie.' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: (session.user as any).id },
    data: updateData,
    select: { id: true, name: true, email: true },
  })

  return NextResponse.json(updated)
}
