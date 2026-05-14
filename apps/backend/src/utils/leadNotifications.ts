import nodemailer from 'nodemailer';
import type { Lead } from '@prisma/client';
import * as Sentry from '@sentry/node';

/**
 * Lead notification emails — sent on Lead creation from /audyt or /kontakt.
 * Two emails per lead:
 *   1. Admin notification → NOTIFICATIONS_TO_EMAIL (fallback hello@bambooit.pl)
 *   2. Client confirmation → lead.email
 *
 * Failure is non-fatal — DB write already succeeded, admin will follow up
 * manually. Errors logged to Sentry as warnings.
 *
 * Resend migration planned for BE-4 (per .env.example comment); currently
 * uses the same nodemailer/SMTP transport as auth/order emails.
 */

const NOTIFICATIONS_TO = process.env.NOTIFICATIONS_TO_EMAIL ?? 'hello@bambooit.pl';
const FROM_ADDRESS = process.env.SMTP_FROM ?? 'bambooIT <hello@bambooit.pl>';

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const INDUSTRY_LABELS: Record<string, string> = {
  accounting: 'biuro rachunkowe',
  law: 'kancelaria prawna',
  medical: 'gabinet medyczny',
  production: 'produkcja',
  hospitality: 'hotel / gastronomia',
  other: 'inne',
};

function formatLeadForAdmin(lead: Lead): { subject: string; text: string; html: string } {
  const isAudit = lead.type === 'AUDIT';
  const subject = isAudit
    ? `[bambooIT] Nowy lead AUDIT — ${lead.company ?? lead.firstName}`
    : `[bambooIT] Nowa wiadomość kontaktowa — ${lead.firstName}`;

  const industryLabel = lead.industry ? INDUSTRY_LABELS[lead.industry] ?? lead.industry : null;
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
  const createdAtStr = lead.createdAt.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });

  const lines = [
    `Nowe zgłoszenie z formularza ${isAudit ? 'audytu' : 'kontaktowego'} na bambooit.pl.`,
    '',
    `Imię i nazwisko: ${fullName}`,
    lead.company ? `Firma: ${lead.company}` : null,
    `Email: ${lead.email}`,
    lead.phone ? `Telefon: ${lead.phone}` : null,
    industryLabel ? `Branża: ${industryLabel}` : null,
    lead.sizeRange ? `Rozmiar zespołu: ${lead.sizeRange} stanowisk` : null,
    '',
    'Wiadomość:',
    lead.description || '(brak)',
    '',
    `Data zgłoszenia: ${createdAtStr}`,
    `Lead ID: ${lead.id}`,
  ].filter(Boolean);

  const text = lines.join('\n');

  const rows = [
    ['Imię i nazwisko', fullName],
    lead.company ? ['Firma', lead.company] : null,
    ['Email', `<a href="mailto:${lead.email}">${lead.email}</a>`],
    lead.phone ? ['Telefon', `<a href="tel:${lead.phone}">${lead.phone}</a>`] : null,
    industryLabel ? ['Branża', industryLabel] : null,
    lead.sizeRange ? ['Rozmiar zespołu', `${lead.sizeRange} stanowisk`] : null,
    ['Data', createdAtStr],
  ].filter(Boolean) as Array<[string, string]>;

  const tableRows = rows
    .map(
      ([k, v]) =>
        `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;font-size:14px;width:160px;">${k}</td><td style="padding:8px 0;font-weight:500;">${v}</td></tr>`,
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1a1a1a;">
      <h2 style="margin-bottom:8px;">Nowe zgłoszenie ${isAudit ? '— audyt' : '— kontakt'}</h2>
      <p style="color:#6b7280;margin-top:0;">Z formularza ${isAudit ? '/audyt' : '/kontakt'} na bambooit.pl</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;">${tableRows}</table>
      <h3 style="margin-bottom:8px;">Wiadomość</h3>
      <p style="white-space:pre-wrap;background:#f9fafb;padding:16px;border-radius:8px;margin-top:0;">${escapeHtml(lead.description || '(brak)')}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
      <p style="color:#9ca3af;font-size:12px;">Lead ID: ${lead.id}</p>
    </div>
  `;

  return { subject, text, html };
}

function formatLeadForClient(lead: Lead): { subject: string; text: string; html: string } {
  const isAudit = lead.type === 'AUDIT';
  const subject = isAudit
    ? 'Dziękujemy za zgłoszenie — bambooIT'
    : 'Otrzymaliśmy Twoją wiadomość — bambooIT';

  const greeting = `Cześć ${lead.firstName.split(' ')[0]},`;

  const body = isAudit
    ? 'Dziękujemy za zgłoszenie do bezpłatnego audytu IT. Skontaktujemy się z Tobą w ciągu 24h roboczych, żeby umówić rozmowę i przedstawić wstępne ustalenia.'
    : 'Dziękujemy za wiadomość. Odpowiemy w ciągu 24h roboczych.';

  const text = [
    greeting,
    '',
    body,
    '',
    'Po drugiej stronie siedzi konkretny człowiek — nie infolinia, nie korporacja.',
    '',
    'Pozdrawiamy,',
    'Remigiusz + Wirgiliusz',
    'bambooIT',
    '',
    '---',
    'Jeśli to nie Ty wysłałeś to zgłoszenie, zignoruj tę wiadomość.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
      <h2 style="margin-bottom:16px;">${greeting}</h2>
      <p style="font-size:16px;line-height:1.6;">${body}</p>
      <p style="font-size:16px;line-height:1.6;color:#4b5563;">Po drugiej stronie siedzi konkretny człowiek — nie infolinia, nie korporacja.</p>
      <p style="font-size:16px;margin-top:32px;">Pozdrawiamy,<br/><strong>Remigiusz + Wirgiliusz</strong><br/>bambooIT</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
      <p style="color:#9ca3af;font-size:12px;">Jeśli to nie Ty wysłałeś to zgłoszenie, zignoruj tę wiadomość.</p>
    </div>
  `;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send admin + client notifications for a newly created Lead.
 *
 * Non-blocking semantics: any send error is logged + reported to Sentry,
 * but never thrown. Lead is already in the DB; manual outreach is the
 * fallback.
 *
 * If SMTP env vars are not configured (dev without Mailtrap), logs a
 * warning and skips sending. The endpoint still returns 200 to the user.
 */
export async function sendLeadNotifications(lead: Lead): Promise<void> {
  if (!smtpConfigured()) {
    console.warn(
      `[leadNotifications] SMTP not configured — skipping notifications for lead ${lead.id}`,
    );
    Sentry.captureMessage(
      `[leadNotifications] SMTP not configured — lead ${lead.id} created but no email sent`,
      'warning',
    );
    return;
  }

  const transporter = createTransporter();

  const adminMsg = formatLeadForAdmin(lead);
  const clientMsg = formatLeadForClient(lead);

  const results = await Promise.allSettled([
    transporter.sendMail({
      from: FROM_ADDRESS,
      to: NOTIFICATIONS_TO,
      replyTo: lead.email,
      subject: adminMsg.subject,
      text: adminMsg.text,
      html: adminMsg.html,
    }),
    transporter.sendMail({
      from: FROM_ADDRESS,
      to: lead.email,
      subject: clientMsg.subject,
      text: clientMsg.text,
      html: clientMsg.html,
    }),
  ]);

  results.forEach((r, idx) => {
    if (r.status === 'rejected') {
      const which = idx === 0 ? 'admin' : 'client';
      console.error(
        `[leadNotifications] Failed to send ${which} email for lead ${lead.id}:`,
        r.reason,
      );
      Sentry.captureException(r.reason, {
        tags: { leadId: lead.id, recipient: which },
      });
    }
  });
}
