import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  let pass = body.pass
  if (!pass || pass === '••••••••') {
    const stored = await prisma.smtpSettings.findUnique({ where: { id: 1 } })
    pass = stored?.pass || ''
  }
  try {
    const transporter = nodemailer.createTransport({
      host: body.host, port: Number(body.port), secure: Boolean(body.secure),
      auth: { user: body.user, pass },
    })
    await transporter.verify()
    await transporter.sendMail({
      from: body.from || body.user,
      to: session.user.email ?? '',
      subject: '[Sycom Portal] Test SMTP spojenia',
      text: 'SMTP spojenie funguje. Tato sprava bola odoslana z Sycom IT Portalu.',
    })
    return NextResponse.json({ ok: true, message: `Test email odoslany na ${session.user.email}` })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 })
  }
}
