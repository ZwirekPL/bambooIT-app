import nodemailer from 'nodemailer';

const PRODUCT_LABELS: Record<string, string> = {
  FREE_7: 'Plan 7-dniowy (bezpłatny)',
  OPIEKA_MIESIECZNA: 'Opieka dietetyczna (miesięczna)',
  OPIEKA_ROCZNA: 'Opieka dietetyczna (roczna)',
  PLAN_2W: 'Plan dietetyczny 2-tygodniowy',
  PLAN_4W: 'Plan dietetyczny 4-tygodniowy',
  CONSULTATION: 'Konsultacja dietetyczna',
};

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

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Reset hasła — e-dietetyk.com',
    text: `Otrzymaliśmy prośbę o reset hasła do Twojego konta.\n\nKliknij poniższy link, aby ustawić nowe hasło (link wygasa po 1 godzinie):\n${resetUrl}\n\nJeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Reset hasła</h2>
        <p>Otrzymaliśmy prośbę o reset hasła do Twojego konta w e-dietetyk.com.</p>
        <p>Kliknij poniższy przycisk, aby ustawić nowe hasło. Link wygasa po <strong>1 godzinie</strong>.</p>
        <p style="margin: 32px 0;">
          <a href="${resetUrl}"
             style="background-color: #16a34a; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Resetuj hasło
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          Jeśli przycisk nie działa, skopiuj ten link do przeglądarki:<br>
          <span style="color: #374151;">${resetUrl}</span>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość — Twoje konto pozostaje bezpieczne.
        </p>
      </div>
    `,
  });
}

export async function sendOrderConfirmationEmail(
  to: string,
  order: { id: string; productType: string; createdAt: Date | string },
): Promise<void> {
  const transporter = createTransporter();
  const productLabel = PRODUCT_LABELS[order.productType] ?? order.productType;
  const dateStr = new Date(order.createdAt).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Potwierdzenie zamówienia #${order.id.slice(-8).toUpperCase()} — e-dietetyk.com`,
    text: `Dziękujemy za zamówienie!\n\nNumer zamówienia: ${order.id.slice(-8).toUpperCase()}\nProdukt: ${productLabel}\nData: ${dateStr}\n\nZespół e-dietetyk.com`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Potwierdzenie zamówienia</h2>
        <p>Dziękujemy! Twoje zamówienie zostało przyjęte i opłacone.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Numer zamówienia</td>
            <td style="padding: 10px 0; font-weight: bold; text-align: right;">#${order.id.slice(-8).toUpperCase()}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Produkt</td>
            <td style="padding: 10px 0; font-weight: bold; text-align: right;">${productLabel}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Data zamówienia</td>
            <td style="padding: 10px 0; text-align: right;">${dateStr}</td>
          </tr>
        </table>
        <p style="color: #6b7280; font-size: 14px;">
          Skontaktujemy się z Tobą wkrótce w celu uruchomienia usługi.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">e-dietetyk.com</p>
      </div>
    `,
  });
}

export interface ConsultationEmailData {
  orderId: string;
}

/** Email to client after CONSULTATION purchase — simplified flow (41.1). */
export async function sendConsultationPatientEmail(
  to: string,
  contactFirstName: string,
  data: ConsultationEmailData,
): Promise<void> {
  const transporter = createTransporter();
  const greeting = contactFirstName ? `Cześć ${contactFirstName}!` : 'Cześć!';
  const orderNum = data.orderId.slice(-8).toUpperCase();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Konsultacja — zamówienie #${orderNum} — e-dietetyk.com`,
    text: `${greeting}\n\nDziękujemy za zakup konsultacji!\n\nNumer zamówienia: #${orderNum}\n\nSkontaktujemy się z Tobą mailowo w celu ustalenia terminu i formy konsultacji.\n\nZespół e-dietetyk.com`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a1a1a;">Konsultacja</h2>
        <p>${greeting}</p>
        <p>Dziękujemy za zakup konsultacji! Twoje zamówienie <strong>#${orderNum}</strong> zostało opłacone.</p>
        <p>Skontaktujemy się z Tobą <strong>mailowo</strong> w celu ustalenia terminu i formy konsultacji.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">e-dietetyk.com</p>
      </div>
    `,
  });
}

/** Internal email when a client purchases a CONSULTATION. */
export async function sendConsultationDietitianEmail(
  to: string,
  data: {
    orderId: string;
    contactName: string;
    contactEmail: string;
    contactPhone?: string;
  },
): Promise<void> {
  const transporter = createTransporter();
  const orderNum = data.orderId.slice(-8).toUpperCase();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Nowa konsultacja — ${data.contactName} (#${orderNum}) — e-dietetyk.com`,
    text: `Nowe zamówienie konsultacji!\n\nKlient: ${data.contactName}\nEmail: ${data.contactEmail}\n${data.contactPhone ? `Telefon: ${data.contactPhone}\n` : ''}\nNumer zamówienia: #${orderNum}\n\nSkontaktuj się z klientem w celu umówienia terminu.\n\ne-dietetyk.com`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a1a1a;">Nowa konsultacja</h2>
        <p>Klient zakupił konsultację. Skontaktuj się w celu umówienia terminu.</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0;">
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:10px 0;color:#6b7280;font-size:14px;">Klient</td>
            <td style="padding:10px 0;font-weight:bold;text-align:right;">${data.contactName}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:10px 0;color:#6b7280;font-size:14px;">Email klienta</td>
            <td style="padding:10px 0;text-align:right;"><a href="mailto:${data.contactEmail}" style="color:#16a34a;">${data.contactEmail}</a></td>
          </tr>
          ${data.contactPhone ? `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:10px 0;color:#6b7280;font-size:14px;">Telefon klienta</td><td style="padding:10px 0;text-align:right;">${data.contactPhone}</td></tr>` : ''}
          <tr>
            <td style="padding:10px 0;color:#6b7280;font-size:14px;">Numer zamówienia</td>
            <td style="padding:10px 0;font-weight:bold;text-align:right;">#${orderNum}</td>
          </tr>
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">e-dietetyk.com</p>
      </div>
    `,
  });
}

export async function sendEmailVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Potwierdź adres email — e-dietetyk.com',
    text: `Witaj w e-dietetyk.com!\n\nKliknij poniższy link, aby potwierdzić swój adres email (link wygasa po 48 godzinach):\n${verifyUrl}\n\nJeśli nie zakładałeś konta w e-dietetyk.com, zignoruj tę wiadomość.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Potwierdź adres email</h2>
        <p>Witaj w e-dietetyk.com!</p>
        <p>Kliknij poniższy przycisk, aby potwierdzić swój adres email. Link wygasa po <strong>48 godzinach</strong>.</p>
        <p style="margin: 32px 0;">
          <a href="${verifyUrl}"
             style="background-color: #16a34a; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Potwierdź email
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          Jeśli przycisk nie działa, skopiuj ten link do przeglądarki:<br>
          <span style="color: #374151;">${verifyUrl}</span>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          Jeśli nie zakładałeś konta w e-dietetyk.com, zignoruj tę wiadomość.
        </p>
      </div>
    `,
  });
}

/** Subscription cancellation confirmation email (Dyrektywa Omnibus). */
export async function sendSubscriptionCancelEmail(
  to: string,
  periodEndDate: string,
): Promise<void> {
  const transporter = createTransporter();
  const endDateStr = new Date(periodEndDate).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Potwierdzenie anulowania subskrypcji — e-dietetyk.com',
    text: `Potwierdzamy anulowanie Twojej subskrypcji w e-dietetyk.com.\n\nTwoja subskrypcja pozostanie aktywna do: ${endDateStr}.\nPo tej dacie dostęp do usług płatnych zostanie wyłączony.\n\nJeśli zmienisz zdanie, możesz wznowić subskrypcję w dowolnym momencie z poziomu panelu użytkownika.\n\nZespół e-dietetyk.com`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a1a1a;">Subskrypcja anulowana</h2>
        <p>Potwierdzamy anulowanie Twojej subskrypcji w e-dietetyk.com.</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0;">
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:10px 0;color:#6b7280;font-size:14px;">Aktywna do</td>
            <td style="padding:10px 0;font-weight:bold;text-align:right;">${endDateStr}</td>
          </tr>
        </table>
        <p>Po tej dacie dostęp do usług płatnych zostanie wyłączony.</p>
        <div style="background-color:#f0fdf4;border-left:4px solid #22c55e;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:14px;color:#166534;">Jeśli zmienisz zdanie, możesz wznowić subskrypcję w dowolnym momencie z poziomu panelu użytkownika.</p>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">e-dietetyk.com</p>
      </div>
    `,
  });
}

/** RODO account deletion confirmation email (66.2). */
export async function sendAccountDeletionEmail(to: string): Promise<void> {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Konto zostało usunięte — e-dietetyk.com',
    text: 'Twoje konto w e-dietetyk.com zostało usunięte zgodnie z Twoją prośbą.\n\nDane osobowe zostały zanonimizowane. Jeśli to nie Ty zainicjowałeś usunięcie, skontaktuj się natychmiast pod adresem kontakt@e-dietetyk.com.\n\nZespół e-dietetyk.com',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a1a1a;">Konto usunięte</h2>
        <p>Twoje konto w e-dietetyk.com zostało usunięte zgodnie z Twoją prośbą.</p>
        <p>Dane osobowe zostały zanonimizowane zgodnie z RODO (art. 17).</p>
        <div style="background-color:#fef2f2;border-left:4px solid #ef4444;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:14px;color:#991b1b;font-weight:bold;">Jeśli to nie Ty zainicjowałeś usunięcie konta, skontaktuj się natychmiast pod adresem kontakt@e-dietetyk.com.</p>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">e-dietetyk.com</p>
      </div>
    `,
  });
}
