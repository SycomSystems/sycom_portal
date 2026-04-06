// src/lib/email.ts
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

function baseTemplate(content: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'DM Sans', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
    .wrap { max-width: 600px; margin: 30px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: #1a6fba; padding: 28px 32px; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .header p  { color: rgba(255,255,255,0.75); margin: 4px 0 0; font-size: 13px; }
    .body { padding: 32px; color: #1c2b3a; line-height: 1.6; }
    .btn { display: inline-block; background: #1a6fba; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
    .footer { padding: 20px 32px; border-top: 1px solid #dde3ec; font-size: 12px; color: #7089a4; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .critical { background: #fef0f0; color: #c0252f; }
    .high     { background: #fff4e6; color: #b5600a; }
    .medium   { background: #fffbe6; color: #8a6500; }
    .low      { background: #edf9f3; color: #1d7a45; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>⚡ Sycom IT Podpora</h1>
      <p>portal.sycom.sk</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      Sycom s.r.o. · Hviezdoslavova 1, Senec 90301 · 0948 938 217<br>
      Tento email bol odoslaný automaticky, neodpovedajte naň.
    </div>
  </div>
</body>
</html>`
}

// ── Email types ───────────────────────────────────────────

export async function sendTicketCreated(to: string, ticket: {
  ticketNumber: number
  subject: string
  priority: string
  category: string
}) {
  const priorityLabel: Record<string, string> = {
    LOW: 'Nízka', MEDIUM: 'Stredná', HIGH: 'Vysoká', CRITICAL: 'Kritická',
  }
  const priorityClass: Record<string, string> = {
    LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical',
  }

  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to,
    subject: `[#T-${ticket.ticketNumber}] Tiket vytvorený: ${ticket.subject}`,
    html: baseTemplate(`
      <h2>Váš tiket bol úspešne vytvorený</h2>
      <p>Ďakujeme za kontaktovanie podpory. Váš tiket bol zaregistrovaný a čoskoro sa vám ozve náš technik.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr><td style="padding:8px 0;color:#7089a4;width:140px">Číslo tiketu:</td><td><strong>#T-${ticket.ticketNumber}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#7089a4">Predmet:</td><td>${ticket.subject}</td></tr>
        <tr><td style="padding:8px 0;color:#7089a4">Priorita:</td><td><span class="badge ${priorityClass[ticket.priority]}">${priorityLabel[ticket.priority]}</span></td></tr>
      </table>
      <a href="${process.env.APP_URL}/tickets/${ticket.ticketNumber}" class="btn">Zobraziť tiket →</a>
    `),
  })
}

export async function sendTicketAssigned(to: string, ticket: {
  ticketNumber: number
  subject: string
  agentName: string
}) {
  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to,
    subject: `[#T-${ticket.ticketNumber}] Tiket pridelený technikovi`,
    html: baseTemplate(`
      <h2>Váš tiket bol pridelený</h2>
      <p>Technik <strong>${ticket.agentName}</strong> prevzal váš tiket a pracuje na riešení.</p>
      <p><strong>Tiket:</strong> #T-${ticket.ticketNumber} — ${ticket.subject}</p>
      <a href="${process.env.APP_URL}/tickets/${ticket.ticketNumber}" class="btn">Zobraziť tiket →</a>
    `),
  })
}

export async function sendTicketResolved(to: string, ticket: {
  ticketNumber: number
  subject: string
}) {
  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to,
    subject: `[#T-${ticket.ticketNumber}] Tiket bol vyriešený ✓`,
    html: baseTemplate(`
      <h2>Váš tiket bol vyriešený ✓</h2>
      <p>Tešíme sa, že sme vám mohli pomôcť. Ak problém pretrváva, pokojne otvorte nový tiket.</p>
      <p><strong>Tiket:</strong> #T-${ticket.ticketNumber} — ${ticket.subject}</p>
      <a href="${process.env.APP_URL}/tickets/${ticket.ticketNumber}" class="btn">Zobraziť riešenie →</a>
    `),
  })
}

export async function sendNewComment(to: string, ticket: {
  ticketNumber: number
  subject: string
  authorName: string
  comment: string
}) {
  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to,
    subject: `[#T-${ticket.ticketNumber}] Nová odpoveď na váš tiket`,
    html: baseTemplate(`
      <h2>Nová odpoveď na tiket #T-${ticket.ticketNumber}</h2>
      <p><strong>${ticket.authorName}</strong> odpovedal na váš tiket <em>${ticket.subject}</em>:</p>
      <blockquote style="border-left:3px solid #1a6fba;padding:12px 16px;background:#f0f7ff;border-radius:0 8px 8px 0;margin:16px 0;color:#1c2b3a">
        ${ticket.comment}
      </blockquote>
      <a href="${process.env.APP_URL}/tickets/${ticket.ticketNumber}" class="btn">Odpovedať →</a>
    `),
  })
}
