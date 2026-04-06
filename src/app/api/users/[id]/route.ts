// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const user = await prisma.user.findUnique({ where: { id: params.id } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Generate a new random password
  const newPassword = crypto.randomBytes(8).toString('base64url').slice(0, 12)
  const hashed = await bcrypt.hash(newPassword, 12)

  // Save the new password
  await prisma.user.update({
    where: { id: params.id },
    data: { password: hashed },
  })

  // Send email
  await sendEmail({
    to: user.email,
    subject: 'Sycom Portal – Nové heslo',
    html: `
      <h2>Vaše nové heslo pre Sycom IT Support Portal</h2>
      <p>Dobrý deň, <strong>${user.name}</strong>,</p>
      <p>Administrátor vám vygeneroval nové heslo:</p>
      <p style="font-size:20px;font-weight:bold;letter-spacing:2px;background:#f4f4f4;padding:12px 20px;border-radius:6px;display:inline-block">${newPassword}</p>
      <p>Po prihlásení si heslo zmeňte.</p>
      <p>Portál: <a href="${process.env.NEXTAUTH_URL}">${process.env.NEXTAUTH_URL}</a></p>
    `,
  })

  return NextResponse.json({ success: true, email: user.email })
}

  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
