import nodemailer from 'nodemailer'
import { prisma } from './prisma'

interface SmtpConfig {
  host: string; port: number; secure: boolean
  auth: { user: string; pass: string }; from: string
}

async function getSmtpConfig(): Promise<SmtpConfig> {
  try {
    const s = await prisma.smtpSettings.findUnique({ where: { id: 1 } })
    if (s && s.host && s.user && s.pass) {
      return { host: s.host, port: s.port, secure: s.secure, auth: { user: s.user, pass: s.pass }, from: s.from || s.user }
    }
  } catch (_err) {}
  return {
    host: process.env.SMTP_HOST ?? '', port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER ?? '', pass: process.env.SMTP_PASS ?? '' },
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '',
  }
}

async function createTransporter() {
  const cfg = await getSmtpConfig()
  return nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: cfg.auth })
}

function emailLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="sk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- HEADER -->
      <tr><td style="background:#1e40af;border-radius:12px 12px 0 0;padding:28px 36px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Sycom</span>
              <span style="font-size:22px;font-weight:300;color:#93c5fd;letter-spacing:-0.5px;"> Systems</span>
            </td>
            <td align="right">
              <span style="font-size:11px;color:#93c5fd;text-transform:uppercase;letter-spacing:1px;">Support Portal</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- BODY -->
      <tr><td style="background:#ffffff;padding:36px 36px 28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
        ${bodyHtml}
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="background:#f8fafc;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px 36px;">
        <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
          Tento email bol vygenerovaný automaticky systémom <strong style="color:#64748b;">Sycom Support Portal</strong>.<br>
          Prosím, neodpovedajte priamo na tento email.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 12px 6px 0;font-size:13px;color:#6b7280;white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;">${value}</td>
  </tr>`
}

function badge(text: string, color = '#1e40af'): string {
  return `<span style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;letter-spacing:0.3px;">${text}</span>`
}

function btn(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;background:#1e40af;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">${text}</a>`
}

const PORTAL_URL = process.env.NEXTAUTH_URL ?? 'https://portal.sycom.sk'

// ─── TIKETY ──────────────────────────────────────────────────────────────────

export async function sendTicketCreated(
  toEmail: string,
  opts: { ticketNumber: number; subject: string; creatorName?: string; clientName?: string; priority?: string; category?: string }
) {
  const priorityColors: Record<string, string> = { CRITICAL:'#dc2626', HIGH:'#ea580c', MEDIUM:'#2563eb', LOW:'#16a34a' }
  const priorityLabels: Record<string, string> = { CRITICAL:'Kritická', HIGH:'Vysoká', MEDIUM:'Stredná', LOW:'Nízka' }
  const categoryLabels: Record<string, string> = {
    HARDWARE:'Hardware', SOFTWARE:'Software', NETWORK:'Sieť', EMAIL:'Email',
    SECURITY:'Bezpečnosť', CLOUD:'Cloud', ONBOARDING:'Onboarding', OTHER:'Iné'
  }
  try {
    const cfg = await getSmtpConfig()
    const t = await createTransporter()
    await t.sendMail({
      from: cfg.from, to: toEmail,
      subject: `[Tiket #${opts.ticketNumber}] ${opts.subject}`,
      html: emailLayout(`Nový tiket #${opts.ticketNumber}`, `
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Váš tiket bol vytvorený</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Dobrý deň${opts.creatorName ? `, <strong>${opts.creatorName}</strong>` : ''}${opts.clientName ? `, váš tiket pre spoločnosť <strong>${opts.clientName}</strong> bol úspešne prijatý.` : ', váš tiket bol úspešne prijatý.'}</p>
        <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;width:100%;">
          ${infoRow('Číslo tiketu:', `#${opts.ticketNumber}`)}
          ${infoRow('Predmet:', opts.subject)}
          ${opts.priority ? infoRow('Priorita:', badge(priorityLabels[opts.priority] ?? opts.priority, priorityColors[opts.priority] ?? '#2563eb')) : ''}
          ${opts.category ? infoRow('Kategória:', categoryLabels[opts.category] ?? opts.category) : ''}
        </table>
        <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">O každej zmene stavu vás budeme informovať emailom.</p>
        ${btn('Zobraziť tiket', `${PORTAL_URL}/tickets`)}
      `),
    })
  } catch (err: any) { console.error('[email] sendTicketCreated failed:', err.message) }
}

export async function sendTicketAssigned(
  toEmail: string,
  opts: { ticketNumber: number; subject: string; agentName: string }
) {
  try {
    const cfg = await getSmtpConfig()
    const t = await createTransporter()
    await t.sendMail({
      from: cfg.from, to: toEmail,
      subject: `[Tiket #${opts.ticketNumber}] Pridelený vám: ${opts.subject}`,
      html: emailLayout(`Pridelený tiket #${opts.ticketNumber}`, `
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Bol vám pridelený nový tiket</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Dobrý deň, <strong>${opts.agentName}</strong>.</p>
        <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;width:100%;">
          ${infoRow('Číslo tiketu:', `#${opts.ticketNumber}`)}
          ${infoRow('Predmet:', opts.subject)}
        </table>
        ${btn('Otvoriť tiket', `${PORTAL_URL}/tickets`)}
      `),
    })
  } catch (err: any) { console.error('[email] sendTicketAssigned failed:', err.message) }
}

export async function sendTicketResolved(
  toEmail: string,
  opts: { ticketNumber: number; subject: string }
) {
  try {
    const cfg = await getSmtpConfig()
    const t = await createTransporter()
    await t.sendMail({
      from: cfg.from, to: toEmail,
      subject: `[Tiket #${opts.ticketNumber}] Vyriešený: ${opts.subject}`,
      html: emailLayout(`Tiket #${opts.ticketNumber} vyriešený`, `
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Tiket bol vyriešený</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Dobrý deň, váš tiket bol označený ako vyriešený.</p>
        <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;width:100%;">
          ${infoRow('Číslo tiketu:', `#${opts.ticketNumber}`)}
          ${infoRow('Predmet:', opts.subject)}
          ${infoRow('Stav:', badge('Vyriešený', '#16a34a'))}
        </table>
        <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Ak problém pretrváva, vytvorte prosím nový tiket.</p>
        ${btn('Zobraziť tiket', `${PORTAL_URL}/tickets`)}
      `),
    })
  } catch (err: any) { console.error('[email] sendTicketResolved failed:', err.message) }
}

export async function sendNewComment(
  recipients: { email: string; name: string }[],
  opts: { ticketNumber: number; subject: string; commentAuthor: string; commentText: string }
) {
  try {
    const cfg = await getSmtpConfig()
    const t = await createTransporter()
    for (const r of recipients) {
      await t.sendMail({
        from: cfg.from, to: r.email,
        subject: `[Tiket #${opts.ticketNumber}] Nový komentár: ${opts.subject}`,
        html: emailLayout(`Nový komentár k tiketu #${opts.ticketNumber}`, `
          <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Nový komentár k tiketu</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Dobrý deň, <strong>${r.name}</strong>.</p>
          <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:20px;width:100%;">
            ${infoRow('Tiket:', `#${opts.ticketNumber} — ${opts.subject}`)}
            ${infoRow('Autor:', opts.commentAuthor)}
          </table>
          <div style="background:#eff6ff;border-left:3px solid #2563eb;border-radius:4px;padding:14px 18px;margin-bottom:24px;">
            <p style="margin:0;font-size:14px;color:#1e3a8a;line-height:1.6;">${opts.commentText.replace(/\n/g, '<br>')}</p>
          </div>
          ${btn('Zobraziť konverzáciu', `${PORTAL_URL}/tickets`)}
        `),
      })
    }
  } catch (err: any) { console.error('[email] sendNewComment failed:', err.message) }
}

export async function sendTicketStatusChanged(
  toEmail: string,
  opts: { ticketNumber: number; subject: string; newStatus: string }
) {
  const statusLabels: Record<string, string> = { IN_PROGRESS:'V riešení', RESOLVED:'Vyriešený', CLOSED:'Uzavretý', OPEN:'Otvorený' }
  const statusColors: Record<string, string> = { IN_PROGRESS:'#d97706', RESOLVED:'#16a34a', CLOSED:'#6b7280', OPEN:'#2563eb' }
  try {
    const cfg = await getSmtpConfig()
    const t = await createTransporter()
    await t.sendMail({
      from: cfg.from, to: toEmail,
      subject: `[Tiket #${opts.ticketNumber}] Zmena stavu: ${statusLabels[opts.newStatus] ?? opts.newStatus}`,
      html: emailLayout(`Zmena stavu tiketu #${opts.ticketNumber}`, `
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Stav tiketu bol zmenený</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Dobrý deň, stav vášho tiketu bol aktualizovaný.</p>
        <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;width:100%;">
          ${infoRow('Číslo tiketu:', `#${opts.ticketNumber}`)}
          ${infoRow('Predmet:', opts.subject)}
          ${infoRow('Nový stav:', badge(statusLabels[opts.newStatus] ?? opts.newStatus, statusColors[opts.newStatus] ?? '#2563eb'))}
        </table>
        ${btn('Zobraziť tiket', `${PORTAL_URL}/tickets`)}
      `),
    })
  } catch (err: any) { console.error('[email] sendTicketStatusChanged failed:', err.message) }
}

// ─── OBJEDNÁVKY ───────────────────────────────────────────────────────────────

export async function sendOrderCreated(
  toEmail: string,
  opts: { orderNumber: number; creatorName: string; clientName?: string; itemCount: number }
) {
  try {
    const cfg = await getSmtpConfig()
    const t = await createTransporter()
    await t.sendMail({
      from: cfg.from, to: toEmail,
      subject: `[Objednávka #${opts.orderNumber}] Nový cenový dopyt`,
      html: emailLayout(`Nový cenový dopyt #${opts.orderNumber}`, `
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Nový cenový dopyt</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Bol podaný nový cenový dopyt, ktorý čaká na spracovanie.</p>
        <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;width:100%;">
          ${infoRow('Číslo objednávky:', `#${opts.orderNumber}`)}
          ${infoRow('Zadal:', opts.creatorName)}
          ${opts.clientName ? infoRow('Klient:', opts.clientName) : ''}
          ${infoRow('Počet položiek:', `${opts.itemCount}`)}
          ${infoRow('Stav:', badge('Dopyt', '#6b7280'))}
        </table>
        ${btn('Zobraziť objednávku', `${PORTAL_URL}/orders`)}
      `),
    })
  } catch (err: any) { console.error('[email] sendOrderCreated failed:', err.message) }
}

export async function sendOrderOffer(
  toEmail: string,
  opts: { orderNumber: number; recipientName: string; itemCount: number; total: number; adminNote?: string }
) {
  try {
    const cfg = await getSmtpConfig()
    const t = await createTransporter()
    await t.sendMail({
      from: cfg.from, to: toEmail,
      subject: `[Objednávka #${opts.orderNumber}] Cenová ponuka je pripravená`,
      html: emailLayout(`Cenová ponuka #${opts.orderNumber}`, `
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Vaša cenová ponuka je pripravená</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Dobrý deň, <strong>${opts.recipientName}</strong>, pripravili sme cenovú ponuku pre vašu objednávku.</p>
        <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:20px;width:100%;">
          ${infoRow('Číslo objednávky:', `#${opts.orderNumber}`)}
          ${infoRow('Počet položiek:', `${opts.itemCount}`)}
          ${infoRow('Celková suma:', `<strong>${opts.total.toFixed(2)} €</strong>`)}
        </table>
        ${opts.adminNote ? `<div style="background:#eff6ff;border-left:3px solid #2563eb;border-radius:4px;padding:14px 18px;margin-bottom:20px;"><p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.5px;">Správa od dodávateľa</p><p style="margin:0;font-size:14px;color:#1e3a8a;line-height:1.6;">${opts.adminNote.replace(/\n/g, '<br>')}</p></div>` : ''}
        <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Ponuku môžete schváliť alebo zamietnuť priamo v portáli.</p>
        ${btn('Zobraziť ponuku', `${PORTAL_URL}/orders`)}
      `),
    })
  } catch (err: any) { console.error('[email] sendOrderOffer failed:', err.message) }
}

export async function sendOrderResponse(
  toEmail: string,
  opts: { orderNumber: number; status: 'SCHVALENA' | 'ZAMIETNUTA'; responderName: string }
) {
  const isApproved = opts.status === 'SCHVALENA'
  try {
    const cfg = await getSmtpConfig()
    const t = await createTransporter()
    await t.sendMail({
      from: cfg.from, to: toEmail,
      subject: `[Objednávka #${opts.orderNumber}] ${isApproved ? 'Schválená' : 'Zamietnutá'}`,
      html: emailLayout(`Odpoveď na objednávku #${opts.orderNumber}`, `
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Klient reagoval na ponuku</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Dobrý deň, klient <strong>${opts.responderName}</strong> reagoval na cenovú ponuku.</p>
        <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;width:100%;">
          ${infoRow('Číslo objednávky:', `#${opts.orderNumber}`)}
          ${infoRow('Rozhodnutie:', badge(isApproved ? 'Schválená' : 'Zamietnutá', isApproved ? '#16a34a' : '#dc2626'))}
        </table>
        ${btn('Zobraziť objednávku', `${PORTAL_URL}/orders`)}
      `),
    })
  } catch (err: any) { console.error('[email] sendOrderResponse failed:', err.message) }
}
