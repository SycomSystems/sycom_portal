// src/app/api/users/[id]/send-password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const user = await prisma.user.findUnique({ where: { id: params.id } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const newPassword = (body.password && body.password.length >= 6) ? body.password : crypto.randomBytes(8).toString('base64url').slice(0, 12)
  const hashed = await bcrypt.hash(newPassword, 12)

  await prisma.user.update({
    where: { id: params.id },
    data: { password: hashed },
  })

  const smtpCfg = await prisma.smtpSettings.findUnique({ where: { id: 1 } })
  const cfg = smtpCfg
    ? { host: smtpCfg.host, port: smtpCfg.port, secure: smtpCfg.secure, auth: { user: smtpCfg.user, pass: smtpCfg.pass } }
    : { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }
  const transporter = nodemailer.createTransport(cfg)

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
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
