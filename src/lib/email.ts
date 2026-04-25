import nodemailer from 'nodemailer'
import { prisma } from './prisma'

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  auth: { user: string; pass: string }
  from: string
}

async function getSmtpConfig(): Promise<SmtpConfig> {
  try {
    const s = await prisma.smtpSettings.findUnique({ where: { id: 1 } })
    if (s && s.host && s.user && s.pass) {
      return {
        host: s.host,
        port: s.port,
        secure: s.secure,
        auth: { user: s.user, pass: s.pass },
        from: s.from || s.user,
      }
    }
  } catch (_err) {}
  return {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
    },
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '',
  }
}

async function createTransporter() {
  const cfg = await getSmtpConfig()
  return nodemailer.createTransport({
    host:   cfg.host,
    port:   cfg.port,
    secure: cfg.secure,
    auth:   cfg.auth,
  })
}

export async function sendTicketCreated(
  toEmail: string,
  opts: { ticketNumber: number; subject: string; creatorName?: string; priority?: string; category?: string }
) {
  try {
    const cfg = await getSmtpConfig()
    const transporter = await createTransporter()
    await transporter.sendMail({
      from:    cfg.from,
      to:      toEmail,
      subject: `[Tiket #${opts.ticketNumber}] ${opts.subject}`,
      text: [
        `Dobry den, ${opts.creatorName},`,
        '',
        'Vas tiket bol uspesne vytvoreny.',
        '',
        `Cislo tiketu: #${opts.ticketNumber}`,
        `Predmet:      ${opts.subject}`,
        '',
        'Budeme Vas informovat o kazdej zmene stavu.',
        '',
        'S pozdravom,',
        'Sycom Systems',
      ].join('\n'),
    })
  } catch (err: any) {
    console.error('[email] sendTicketCreated failed:', err.message)
  }
}

export async function sendTicketAssigned(
  toEmail: string,
  opts: { ticketNumber: number; subject: string; agentName: string }
) {
  try {
    const cfg = await getSmtpConfig()
    const transporter = await createTransporter()
    await transporter.sendMail({
      from:    cfg.from,
      to:      toEmail,
      subject: `[Tiket #${opts.ticketNumber}] Prideleny Vam: ${opts.subject}`,
      text: [
        `Dobry den, ${opts.agentName},`,
        '',
        `Bol Vam prideleny tiket #${opts.ticketNumber}.`,
        '',
        `Predmet: ${opts.subject}`,
        '',
        'S pozdravom,',
        'Sycom Portal',
      ].join('\n'),
    })
  } catch (err: any) {
    console.error('[email] sendTicketAssigned failed:', err.message)
  }
}

export async function sendTicketResolved(
  toEmail: string,
  opts: { ticketNumber: number; subject: string }
) {
  try {
    const cfg = await getSmtpConfig()
    const transporter = await createTransporter()
    await transporter.sendMail({
      from:    cfg.from,
      to:      toEmail,
      subject: `[Tiket #${opts.ticketNumber}] Vyrieseny: ${opts.subject}`,
      text: [
        'Dobry den,',
        '',
        `Vas tiket #${opts.ticketNumber} bol oznaceny ako vyrieseny.`,
        '',
        `Predmet: ${opts.subject}`,
        '',
        'Ak problem pretrvava, vytvorte prosim novy tiket.',
        '',
        'S pozdravom,',
        'Sycom Systems',
      ].join('\n'),
    })
  } catch (err: any) {
    console.error('[email] sendTicketResolved failed:', err.message)
  }
}

export async function sendNewComment(
  recipients: { email: string; name: string }[],
  opts: { ticketNumber: number; subject: string; commentAuthor: string; commentText: string }
) {
  try {
    const cfg = await getSmtpConfig()
    const transporter = await createTransporter()
    for (const recipient of recipients) {
      await transporter.sendMail({
        from:    cfg.from,
        to:      recipient.email,
        subject: `[Tiket #${opts.ticketNumber}] Novy komentar: ${opts.subject}`,
        text: [
          `Dobry den, ${recipient.name},`,
          '',
          `Bol pridany novy komentar k tiketu #${opts.ticketNumber}.`,
          '',
          `Predmet: ${opts.subject}`,
          `Autor:   ${opts.commentAuthor}`,
          '',
          'Komentar:',
          opts.commentText,
          '',
          'S pozdravom,',
          'Sycom Portal',
        ].join('\n'),
      })
    }
  } catch (err: any) {
    console.error('[email] sendNewComment failed:', err.message)
  }
}
