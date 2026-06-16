import nodemailer from 'nodemailer';

/**
 * Transactional email templates — bambooIT branding (Neo-Swiss palette,
 * Polish copy). All templates share emailLayout() for consistency.
 *
 * Transport: nodemailer/SMTP (Mailtrap in dev, real SMTP in prod).
 * Resend migration is a future task — current bottleneck is plain SMTP
 * config in .env, not the abstraction.
 */

const PRODUCT_LABELS: Record<string, string> = {
  START: 'Pakiet Start',
  FIRMA: 'Pakiet Firma',
  FIRMA_PLUS: 'Pakiet Firma Plus',
};

const BAMBOO_DEEP = '#7A9B2E'; // bamboo-deep accent
const NAVY_DEEP = '#1F2A44';
const NAVY_SOFT = '#5C6378';
const LINE = '#E5E7EB';
const PAPER = '#F8F6F0';
const SUPPORT_EMAIL = 'hello@bambooit.pl';
const BRAND_NAME = 'bambooIT';

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

interface EmailLayoutOpts {
  /** Optional emphasized heading at the top (above the body). */
  heading?: string;
  /** Main body — already rendered HTML. */
  bodyHtml: string;
  /** Optional callout block (e.g. amber warning or green success). */
  callout?: { variant: 'info' | 'warning' | 'success' | 'danger'; html: string };
  /** Optional CTA button. */
  cta?: { label: string; url: string };
  /** Optional small print at the bottom (e.g. "if this wasn't you..."). */
  footnoteHtml?: string;
}

function emailLayout(opts: EmailLayoutOpts): string {
  const calloutBlock = opts.callout
    ? `<div style="background-color:${
        opts.callout.variant === 'warning'
          ? '#FEF3C7'
          : opts.callout.variant === 'success'
            ? '#ECFDF5'
            : opts.callout.variant === 'danger'
              ? '#FEF2F2'
              : '#EFF6FF'
      };border-left:4px solid ${
        opts.callout.variant === 'warning'
          ? '#F59E0B'
          : opts.callout.variant === 'success'
            ? '#10B981'
            : opts.callout.variant === 'danger'
              ? '#EF4444'
              : '#3B82F6'
      };padding:16px;margin:24px 0;border-radius:0 8px 8px 0;font-size:14px;color:${NAVY_DEEP};">
        ${opts.callout.html}
      </div>`
    : '';

  const ctaBlock = opts.cta
    ? `<p style="margin:32px 0;">
        <a href="${opts.cta.url}"
           style="display:inline-block;background-color:${BAMBOO_DEEP};color:${NAVY_DEEP};padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:15px;">
          ${opts.cta.label}
        </a>
      </p>`
    : '';

  const footnoteBlock = opts.footnoteHtml
    ? `<hr style="border:none;border-top:1px solid ${LINE};margin:32px 0 16px;" />
       <p style="color:#9CA3AF;font-size:12px;line-height:1.5;">${opts.footnoteHtml}</p>`
    : '';

  const headingBlock = opts.heading
    ? `<h2 style="color:${NAVY_DEEP};font-size:24px;font-weight:600;margin:0 0 16px;letter-spacing:-0.01em;">${opts.heading}</h2>`
    : '';

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background-color:${PAPER};padding:32px 16px;">
  <div style="max-width:600px;margin:0 auto;background-color:#FFFFFF;border:1px solid ${LINE};border-radius:16px;padding:32px 28px;color:${NAVY_DEEP};line-height:1.6;">
    <div style="margin-bottom:24px;">
      <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:${NAVY_DEEP};letter-spacing:-0.02em;">bamboo</span><span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:${BAMBOO_DEEP};letter-spacing:-0.02em;">it</span>
    </div>
    ${headingBlock}
    <div style="font-size:15px;color:${NAVY_SOFT};">
      ${opts.bodyHtml}
    </div>
    ${calloutBlock}
    ${ctaBlock}
    ${footnoteBlock}
  </div>
  <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    ${BRAND_NAME} · bambooit.pl
  </p>
</div>`;
}

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );
}

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Resend transport — direct REST call (no SDK dependency). Same payload
 * shape as nodemailer; chosen when RESEND_API_KEY is set.
 *
 * Resend free tier: 3000 emails/month, 100/day. Paid: 50000/month.
 */
async function sendViaResend(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(opts),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '<no body>');
    throw new Error(`Resend API ${res.status}: ${errorBody}`);
  }
}

/**
 * Unified send() — picks transport based on env. Priority:
 *   1. Resend (if RESEND_API_KEY set) — preferred for production
 *   2. nodemailer/SMTP (if SMTP_HOST + creds set) — dev (Mailtrap) or
 *      legacy prod
 *   3. No-op + log + skip (dev without any provider)
 *
 * Failures are thrown — callers (leadNotifications, subscription welcome,
 * etc.) wrap in try/catch + Sentry so DB writes aren't blocked.
 */
async function send(to: string, subject: string, text: string, html: string): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL ?? process.env.SMTP_FROM ?? `${BRAND_NAME} <${SUPPORT_EMAIL}>`;

  if (resendConfigured()) {
    return sendViaResend({ from, to, subject, text, html });
  }

  if (smtpConfigured()) {
    const transporter = createTransporter();
    await transporter.sendMail({ from, to, subject, text, html });
    return;
  }

  console.warn(
    `[email] Neither RESEND_API_KEY nor SMTP_* configured — skipping send to ${to} (subject: ${subject})`,
  );
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = `Reset hasła — ${BRAND_NAME}`;
  const text = `Otrzymaliśmy prośbę o reset hasła do Twojego konta w ${BRAND_NAME}.

Kliknij poniższy link, aby ustawić nowe hasło (link wygasa po 1 godzinie):
${resetUrl}

Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość — Twoje konto pozostaje bezpieczne.

Zespół ${BRAND_NAME}`;

  const html = emailLayout({
    heading: 'Reset hasła',
    bodyHtml: `<p>Otrzymaliśmy prośbę o reset hasła do Twojego konta w ${BRAND_NAME}.</p>
      <p>Kliknij poniższy przycisk, aby ustawić nowe hasło. Link wygasa po <strong>1 godzinie</strong>.</p>`,
    cta: { label: 'Resetuj hasło', url: resetUrl },
    footnoteHtml: `Jeśli przycisk nie działa, skopiuj ten link do przeglądarki:<br/>
      <span style="color:${NAVY_DEEP};word-break:break-all;">${resetUrl}</span><br/><br/>
      Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość — Twoje konto pozostaje bezpieczne.`,
  });

  await send(to, subject, text, html);
}

// ─── Order / subscription confirmation ────────────────────────────────────────

export async function sendOrderConfirmationEmail(
  to: string,
  order: { id: string; productType: string; createdAt: Date | string },
): Promise<void> {
  const productLabel = PRODUCT_LABELS[order.productType] ?? order.productType;
  const orderRef = order.id.slice(-8).toUpperCase();
  const dateStr = new Date(order.createdAt).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const subject = `Potwierdzenie zamówienia #${orderRef} — ${BRAND_NAME}`;
  const text = `Dziękujemy za zamówienie!

Numer zamówienia: ${orderRef}
Pakiet: ${productLabel}
Data: ${dateStr}

Skontaktujemy się z Tobą w ciągu 24h roboczych, żeby uruchomić usługę.

Zespół ${BRAND_NAME}`;

  const html = emailLayout({
    heading: 'Zamówienie przyjęte',
    bodyHtml: `<p>Dziękujemy! Twoje zamówienie zostało przyjęte i opłacone. Skontaktujemy się z Tobą w ciągu 24h roboczych, żeby uruchomić usługę.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;">
        <tr style="border-bottom:1px solid ${LINE};">
          <td style="padding:10px 0;color:${NAVY_SOFT};font-size:14px;">Numer zamówienia</td>
          <td style="padding:10px 0;font-weight:700;text-align:right;color:${NAVY_DEEP};">#${orderRef}</td>
        </tr>
        <tr style="border-bottom:1px solid ${LINE};">
          <td style="padding:10px 0;color:${NAVY_SOFT};font-size:14px;">Pakiet</td>
          <td style="padding:10px 0;font-weight:700;text-align:right;color:${NAVY_DEEP};">${productLabel}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:${NAVY_SOFT};font-size:14px;">Data zamówienia</td>
          <td style="padding:10px 0;text-align:right;color:${NAVY_DEEP};">${dateStr}</td>
        </tr>
      </table>`,
  });

  await send(to, subject, text, html);
}

// ─── Email verification ───────────────────────────────────────────────────────

export async function sendEmailVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  const subject = `Potwierdź adres email — ${BRAND_NAME}`;
  const text = `Witaj w ${BRAND_NAME}!

Kliknij poniższy link, aby potwierdzić swój adres email (link wygasa po 48 godzinach):
${verifyUrl}

Jeśli nie zakładałeś konta w ${BRAND_NAME}, zignoruj tę wiadomość.

Zespół ${BRAND_NAME}`;

  const html = emailLayout({
    heading: 'Potwierdź adres email',
    bodyHtml: `<p>Witaj w ${BRAND_NAME}!</p>
      <p>Kliknij poniższy przycisk, aby potwierdzić swój adres email. Link wygasa po <strong>48 godzinach</strong>.</p>`,
    cta: { label: 'Potwierdź email', url: verifyUrl },
    footnoteHtml: `Jeśli przycisk nie działa, skopiuj ten link do przeglądarki:<br/>
      <span style="color:${NAVY_DEEP};word-break:break-all;">${verifyUrl}</span><br/><br/>
      Jeśli nie zakładałeś konta w ${BRAND_NAME}, zignoruj tę wiadomość.`,
  });

  await send(to, subject, text, html);
}

// ─── Subscription cancellation confirmation ───────────────────────────────────

export async function sendSubscriptionCancelEmail(
  to: string,
  periodEndDate: string,
): Promise<void> {
  const endDateStr = new Date(periodEndDate).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const subject = `Potwierdzenie anulowania subskrypcji — ${BRAND_NAME}`;
  const text = `Potwierdzamy anulowanie Twojej subskrypcji w ${BRAND_NAME}.

Twoja subskrypcja pozostanie aktywna do: ${endDateStr}.
Po tej dacie dostęp do usług płatnych zostanie wyłączony.

Jeśli zmienisz zdanie, możesz wznowić subskrypcję z poziomu panelu klienta.

Zespół ${BRAND_NAME}`;

  const html = emailLayout({
    heading: 'Subskrypcja anulowana',
    bodyHtml: `<p>Potwierdzamy anulowanie Twojej subskrypcji w ${BRAND_NAME}.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;">
        <tr style="border-bottom:1px solid ${LINE};">
          <td style="padding:10px 0;color:${NAVY_SOFT};font-size:14px;">Aktywna do</td>
          <td style="padding:10px 0;font-weight:700;text-align:right;color:${NAVY_DEEP};">${endDateStr}</td>
        </tr>
      </table>
      <p>Po tej dacie dostęp do usług płatnych zostanie wyłączony.</p>`,
    callout: {
      variant: 'success',
      html: 'Jeśli zmienisz zdanie, możesz wznowić subskrypcję w dowolnym momencie z poziomu panelu klienta.',
    },
  });

  await send(to, subject, text, html);
}

// ─── Account deletion confirmation ────────────────────────────────────────────

export async function sendAccountDeletionEmail(to: string): Promise<void> {
  const subject = `Konto zostało usunięte — ${BRAND_NAME}`;
  const text = `Twoje konto w ${BRAND_NAME} zostało usunięte zgodnie z Twoją prośbą.

Dane osobowe zostały zanonimizowane zgodnie z RODO (art. 17).
Jeśli to nie Ty zainicjowałeś usunięcie, skontaktuj się natychmiast pod adresem ${SUPPORT_EMAIL}.

Zespół ${BRAND_NAME}`;

  const html = emailLayout({
    heading: 'Konto usunięte',
    bodyHtml: `<p>Twoje konto w ${BRAND_NAME} zostało usunięte zgodnie z Twoją prośbą.</p>
      <p>Dane osobowe zostały zanonimizowane zgodnie z RODO (art. 17).</p>`,
    callout: {
      variant: 'danger',
      html: `<strong>Jeśli to nie Ty zainicjowałeś usunięcie konta, skontaktuj się natychmiast pod adresem <a href="mailto:${SUPPORT_EMAIL}" style="color:${NAVY_DEEP};">${SUPPORT_EMAIL}</a>.</strong>`,
    },
  });

  await send(to, subject, text, html);
}

// ─── BE-4: subscription welcome + payment failed ──────────────────────────────

export async function sendSubscriptionWelcomeEmail(
  to: string,
  args: {
    productLabel: string;
    amountPerMonth: number;
    panelUrl: string;
    remoteHelpUrl: string;
  },
): Promise<void> {
  const { productLabel, amountPerMonth, panelUrl, remoteHelpUrl } = args;
  const subject = `Witaj w ${BRAND_NAME} — Twój ${productLabel} jest aktywny`;
  const text = `Witaj w ${BRAND_NAME}!

Twój ${productLabel} (${amountPerMonth} zł netto/mies.) jest aktywny.

Co dalej:
1. Pobierz oprogramowanie do pomocy zdalnej: ${remoteHelpUrl}
2. Zarządzaj subskrypcją w panelu: ${panelUrl}

Skontaktujemy się z Tobą w ciągu 24h roboczych, żeby umówić pierwsze logowanie.

Pozdrawiamy,
Remigiusz + Wirgiliusz
${BRAND_NAME}`;

  const html = emailLayout({
    heading: `Witaj w ${BRAND_NAME}!`,
    bodyHtml: `<p>Twój <strong>${productLabel}</strong> (${amountPerMonth} zł netto/mies.) jest aktywny. Dziękujemy za zaufanie.</p>
      <p style="margin-top:24px;font-weight:600;color:${NAVY_DEEP};">Co dalej:</p>
      <ol style="padding-left:18px;margin:8px 0;">
        <li style="margin:8px 0;">Skontaktujemy się z Tobą w ciągu 24h roboczych, żeby umówić pierwsze logowanie i przejść przez konfigurację.</li>
        <li style="margin:8px 0;">Pobierz <a href="${remoteHelpUrl}" style="color:${BAMBOO_DEEP};font-weight:600;">oprogramowanie do pomocy zdalnej</a> — będziemy z niego korzystać przy każdym zgłoszeniu.</li>
        <li style="margin:8px 0;">Pamiętaj — po drugiej stronie siedzi konkretny człowiek. Nie infolinia, nie korporacja.</li>
      </ol>`,
    cta: { label: 'Otwórz panel klienta', url: panelUrl },
    footnoteHtml: `Pozdrawiamy,<br/>Remigiusz + Wirgiliusz`,
  });

  await send(to, subject, text, html);
}

export async function sendPaymentFailedEmail(
  to: string,
  args: {
    productLabel: string;
    portalUrl: string;
  },
): Promise<void> {
  const { productLabel, portalUrl } = args;
  const subject = `Problem z płatnością — ${BRAND_NAME}`;
  const text = `Cześć,

Nie udało nam się pobrać opłaty za Twój ${productLabel}. Zwykle oznacza to wygasłą kartę lub niedostateczne saldo.

Sprawdź i zaktualizuj metodę płatności w panelu Stripe:
${portalUrl}

Stripe automatycznie ponowi próbę za 3 dni. Jeśli płatność dalej się nie powiedzie, subskrypcja zostanie zawieszona.

Pytania? Napisz na ${SUPPORT_EMAIL}.

Zespół ${BRAND_NAME}`;

  const html = emailLayout({
    heading: 'Problem z płatnością',
    bodyHtml: `<p>Nie udało nam się pobrać opłaty za Twój <strong>${productLabel}</strong>. Zwykle oznacza to wygasłą kartę lub niedostateczne saldo na koncie.</p>
      <p>Sprawdź i zaktualizuj metodę płatności w panelu Stripe — kliknij przycisk poniżej.</p>`,
    callout: {
      variant: 'warning',
      html: 'Stripe automatycznie ponowi próbę za 3 dni. Jeśli płatność dalej się nie powiedzie, subskrypcja zostanie zawieszona, a dostęp do usługi wstrzymany do momentu uregulowania.',
    },
    cta: { label: 'Zaktualizuj kartę', url: portalUrl },
    footnoteHtml: `Pytania? Napisz na <a href="mailto:${SUPPORT_EMAIL}" style="color:${NAVY_DEEP};">${SUPPORT_EMAIL}</a>.`,
  });

  await send(to, subject, text, html);
}

// ─── U-6: bulk email campaigns ────────────────────────────────────────────────

/**
 * Whether a real transport is wired (Resend or SMTP). When false, campaign
 * sends are no-ops that still resolve — the admin UI works end-to-end in dev
 * without blasting real inboxes. Surfaced to the admin UI as a "mock mode" note.
 */
export function isEmailTransportConfigured(): boolean {
  return resendConfigured() || smtpConfigured();
}

/**
 * Send one campaign email. Admin-authored plain-text `body` is wrapped in the
 * shared emailLayout (subject as heading, blank lines → paragraphs). Throws on
 * transport failure so the caller can count failures per recipient.
 */
export async function sendCampaignEmail(
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const html = emailLayout({ heading: subject, bodyHtml: paragraphs });
  await send(to, subject, body, html);
}
