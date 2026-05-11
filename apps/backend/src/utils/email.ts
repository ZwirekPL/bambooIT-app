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

export async function sendDietPlanReadyEmail(
  to: string,
  patientFirstName: string,
  planUrl: string,
): Promise<void> {
  const transporter = createTransporter();
  const greeting = patientFirstName ? `Cześć ${patientFirstName}!` : 'Cześć!';

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Twój plan diety jest gotowy — e-dietetyk.com',
    text: `${greeting}\n\nTwój dietetyk właśnie opublikował nowy plan diety.\n\nZaloguj się, aby go zobaczyć:\n${planUrl}\n\nPowodzenia!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Twój plan diety jest gotowy!</h2>
        <p>${greeting}</p>
        <p>Twój dietetyk właśnie opublikował dla Ciebie nowy plan diety. Zaloguj się, aby go zobaczyć i pobrać.</p>
        <p style="margin: 32px 0;">
          <a href="${planUrl}"
             style="background-color: #16a34a; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Zobacz plan diety
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          Jeśli przycisk nie działa, skopiuj ten link do przeglądarki:<br>
          <span style="color: #374151;">${planUrl}</span>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">e-dietetyk.com — Twój osobisty asystent żywieniowy</p>
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
          Dietetyk skontaktuje się z Tobą wkrótce w celu umówienia konsultacji lub uruchomienia planu.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">e-dietetyk.com — Twój osobisty asystent żywieniowy</p>
      </div>
    `,
  });
}

// ── Weekly summary email ───────────────────────────────────────

export interface WeeklySummaryEmailData {
  highlights: string[];
  tips: string[];
  checkinUrl: string;
  weightCurrent: number | null;
  weightChange: number | null;
  weightDirection: string;
  currentKcal: number | null;
  adaptationApplied: boolean;
  unsubscribeUrl?: string;
}

export async function sendWeeklySummaryEmail(
  to: string,
  patientFirstName: string,
  data: WeeklySummaryEmailData,
): Promise<void> {
  const transporter = createTransporter();
  const greeting = patientFirstName ? `Cześć ${patientFirstName}!` : 'Cześć!';

  const highlightsHtml = data.highlights
    .map((h) => `<li style="margin-bottom: 8px;">${h}</li>`)
    .join('');

  const tipsHtml = data.tips
    .map((t) => `<li style="margin-bottom: 8px;">${t}</li>`)
    .join('');

  const weightSection = data.weightCurrent !== null
    ? `<tr style="border-bottom: 1px solid #e5e7eb;">
         <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Aktualna waga</td>
         <td style="padding: 10px 0; font-weight: bold; text-align: right;">${data.weightCurrent.toFixed(1)} kg</td>
       </tr>`
    : '';

  const kcalSection = data.currentKcal !== null
    ? `<tr>
         <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Cel kaloryczny</td>
         <td style="padding: 10px 0; font-weight: bold; text-align: right;">${data.currentKcal} kcal</td>
       </tr>`
    : '';

  const adaptationBadge = data.adaptationApplied
    ? '<p style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0; font-size: 14px;">Twoj plan zostal automatycznie dostosowany na podstawie Twoich check-inow.</p>'
    : '';

  const highlightsText = data.highlights.map((h) => `- ${h}`).join('\n');
  const tipsText = data.tips.map((t) => `- ${t}`).join('\n');

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Twoje tygodniowe podsumowanie — e-dietetyk.com',
    text: `${greeting}\n\nOto Twoje tygodniowe podsumowanie:\n\n${highlightsText}\n\nWskazowki:\n${tipsText}\n\nWypelnij check-in: ${data.checkinUrl}\n\nZespol e-dietetyk.com`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Tygodniowe podsumowanie</h2>
        <p>${greeting}</p>
        <p>Oto Twoje podsumowanie z ostatniego tygodnia:</p>

        ${(weightSection || kcalSection) ? `
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          ${weightSection}
          ${kcalSection}
        </table>
        ` : ''}

        ${adaptationBadge}

        <h3 style="color: #1a1a1a; font-size: 16px; margin-top: 24px;">Co sie dzialo</h3>
        <ul style="color: #374151; padding-left: 20px;">
          ${highlightsHtml}
        </ul>

        <h3 style="color: #1a1a1a; font-size: 16px; margin-top: 24px;">Wskazowki na ten tydzien</h3>
        <ul style="color: #374151; padding-left: 20px;">
          ${tipsHtml}
        </ul>

        <p style="margin: 32px 0; text-align: center;">
          <a href="${data.checkinUrl}"
             style="background-color: #16a34a; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Wypelnij check-in
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px; text-align: center;">
          Regularny check-in pomaga nam lepiej dopasowac Twoj plan diety.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">e-dietetyk.com — Twoj osobisty asystent zywieniowy</p>
        ${data.unsubscribeUrl ? `<p style="color:#d1d5db; font-size:11px; text-align:center; margin:4px 0 0;"><a href="${data.unsubscribeUrl}" style="color:#9ca3af; text-decoration:underline;">Zrezygnuj z powiadomień</a></p>` : ''}
      </div>
    `,
  });
}

// ── Meal reminder email ──────────────────────────────────────────

export interface MealReminderEmailData {
  mealName: string;
  kcal: number;
  leadMinutes: number;
}

export async function sendMealReminderEmail(
  to: string,
  patientFirstName: string,
  data: MealReminderEmailData,
): Promise<void> {
  const transporter = createTransporter();
  const greeting = patientFirstName ? `Cześć ${patientFirstName}!` : 'Cześć!';
  const timeLabel = data.leadMinutes > 0 ? `Za ${data.leadMinutes} min` : 'Teraz';

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `${timeLabel} czas na posiłek: ${data.mealName} — e-dietetyk.com`,
    text: `${greeting}\n\n${timeLabel} pora na: ${data.mealName} (${data.kcal} kcal).\n\nSmacznego!\nZespół e-dietetyk.com`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Przypomnienie o posiłku</h2>
        <p>${greeting}</p>
        <p>${timeLabel} pora na Twój zaplanowany posiłek:</p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1a1a1a;">${data.mealName}</p>
          <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">${data.kcal} kcal</p>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Pamiętaj — regularne posiłki pomagają utrzymać metabolizm i energię przez cały dzień.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          e-dietetyk.com — Twój osobisty asystent żywieniowy<br>
          Aby wyłączyć przypomnienia, zmień ustawienia w swoim profilu.
        </p>
      </div>
    `,
  });
}

// ── Consultation purchase emails (29.5) ─────────────────────────────────────

export interface ConsultationEmailData {
  orderId: string;
}

/** Email to patient after CONSULTATION purchase — simplified flow (41.1). */
export async function sendConsultationPatientEmail(
  to: string,
  patientFirstName: string,
  data: ConsultationEmailData,
): Promise<void> {
  const transporter = createTransporter();
  const greeting = patientFirstName ? `Cześć ${patientFirstName}!` : 'Cześć!';
  const orderNum = data.orderId.slice(-8).toUpperCase();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Konsultacja dietetyczna — zamówienie #${orderNum} — e-dietetyk.com`,
    text: `${greeting}\n\nDziękujemy za zakup konsultacji dietetycznej!\n\nNumer zamówienia: #${orderNum}\n\nSkontaktujemy się z Tobą mailowo w celu ustalenia terminu i formy konsultacji (telefon, Teams lub Whereby).\n\nZespół e-dietetyk.com`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a1a1a;">Konsultacja dietetyczna</h2>
        <p>${greeting}</p>
        <p>Dziękujemy za zakup konsultacji dietetycznej! Twoje zamówienie <strong>#${orderNum}</strong> zostało opłacone.</p>
        <p>Skontaktujemy się z Tobą <strong>mailowo</strong> w celu ustalenia terminu i formy konsultacji (telefon, Teams lub Whereby).</p>
        <h3 style="color:#1a1a1a;font-size:16px;margin-top:24px;">Co dalej?</h3>
        <ol style="color:#374151;padding-left:20px;">
          <li style="margin-bottom:8px;">Podaj numer telefonu na stronie po zakupie</li>
          <li style="margin-bottom:8px;">Skontaktujemy się mailowo w ciągu 24h, aby ustalić termin</li>
          <li style="margin-bottom:8px;">Przed konsultacją przygotuj wyniki badań (jeśli posiadasz)</li>
          <li style="margin-bottom:8px;">Po spotkaniu otrzymasz spersonalizowane zalecenia</li>
        </ol>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">e-dietetyk.com — Twój osobisty asystent żywieniowy</p>
      </div>
    `,
  });
}

/** Email to dietitian when a patient purchases a CONSULTATION. */
export async function sendConsultationDietitianEmail(
  to: string,
  data: {
    orderId: string;
    patientName: string;
    patientEmail: string;
    patientPhone?: string;
  },
): Promise<void> {
  const transporter = createTransporter();
  const orderNum = data.orderId.slice(-8).toUpperCase();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Nowa konsultacja — ${data.patientName} (#${orderNum}) — e-dietetyk.com`,
    text: `Nowe zamówienie konsultacji dietetycznej!\n\nPacjent: ${data.patientName}\nEmail: ${data.patientEmail}\n${data.patientPhone ? `Telefon: ${data.patientPhone}\n` : ''}\nNumer zamówienia: #${orderNum}\n\nSkontaktuj się z pacjentem w celu umówienia terminu.\n\ne-dietetyk.com`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a1a1a;">Nowa konsultacja dietetyczna</h2>
        <p>Pacjent zakupił konsultację dietetyczną. Skontaktuj się w celu umówienia terminu.</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0;">
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:10px 0;color:#6b7280;font-size:14px;">Pacjent</td>
            <td style="padding:10px 0;font-weight:bold;text-align:right;">${data.patientName}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:10px 0;color:#6b7280;font-size:14px;">Email pacjenta</td>
            <td style="padding:10px 0;text-align:right;"><a href="mailto:${data.patientEmail}" style="color:#16a34a;">${data.patientEmail}</a></td>
          </tr>
          ${data.patientPhone ? `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:10px 0;color:#6b7280;font-size:14px;">Telefon pacjenta</td><td style="padding:10px 0;text-align:right;">${data.patientPhone}</td></tr>` : ''}
          <tr>
            <td style="padding:10px 0;color:#6b7280;font-size:14px;">Numer zamówienia</td>
            <td style="padding:10px 0;font-weight:bold;text-align:right;">#${orderNum}</td>
          </tr>
        </table>
        <p style="margin:32px 0;text-align:center;">
          <a href="${process.env.APP_URL ?? 'http://localhost:3000'}/dietetyk"
             style="background-color:#16a34a;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
            Otwórz panel dietetyka
          </a>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">e-dietetyk.com — system zarządzania dietami</p>
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
        <p>Witaj w e-dietetyk.com! Kliknij poniższy przycisk, aby potwierdzić swój adres email.</p>
        <p>Link wygasa po <strong>48 godzinach</strong>.</p>
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
        <p style="color:#9ca3af;font-size:12px;">e-dietetyk.com — Twój osobisty asystent żywieniowy</p>
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
        <p style="color:#9ca3af;font-size:12px;">e-dietetyk.com — Twój osobisty asystent żywieniowy</p>
      </div>
    `,
  });
}

// ── Custom campaign email ────────────────────────────────────────────────────

export async function sendCustomCampaignEmail(
  to: string,
  subject: string,
  htmlBody: string,
): Promise<void> {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html: htmlBody,
    text: 'Otwórz tę wiadomość w kliencie obsługującym HTML.',
  });
}

// ── Dietitian summary email ───────────────────────────────────────────────────

interface DietitianSummaryEmailData {
  dietitianName: string;
  totalPatients: number;
  activePatients: number;
  avgCompliance: number;
  lowCompliancePatients: Array<{ name: string; compliance: number }>;
  inactivePatients: Array<{ name: string; daysSinceLastCheckin: number }>;
  unsubscribeUrl?: string;
}

export async function sendDietitianSummaryEmail(
  to: string,
  data: DietitianSummaryEmailData,
): Promise<void> {
  const transporter = createTransporter();

  const lowComplianceRows = data.lowCompliancePatients
    .map(
      (p) =>
        `<tr>
          <td style="padding:8px 12px; color:#374151;">${p.name}</td>
          <td style="padding:8px 12px; text-align:center;">
            <span style="background:#fee2e2; color:#dc2626; padding:2px 8px; border-radius:12px; font-size:13px; font-weight:bold;">
              ${p.compliance}%
            </span>
          </td>
        </tr>`,
    )
    .join('');

  const inactiveRows = data.inactivePatients
    .map(
      (p) =>
        `<tr>
          <td style="padding:8px 12px; color:#374151;">${p.name}</td>
          <td style="padding:8px 12px; text-align:center;">
            <span style="background:#fef3c7; color:#d97706; padding:2px 8px; border-radius:12px; font-size:13px; font-weight:bold;">
              ${p.daysSinceLastCheckin}d
            </span>
          </td>
        </tr>`,
    )
    .join('');

  const lowComplianceSection =
    data.lowCompliancePatients.length > 0
      ? `<h3 style="color:#dc2626; font-size:15px; margin:24px 0 8px;">⚠️ Pacjenci wymagający uwagi (adherencja &lt;50%)</h3>
         <table style="width:100%; border-collapse:collapse; background:#fff5f5; border-radius:8px; overflow:hidden;">
           <thead>
             <tr style="background:#fecaca;">
               <th style="padding:8px 12px; text-align:left; color:#991b1b; font-size:13px;">Pacjent</th>
               <th style="padding:8px 12px; text-align:center; color:#991b1b; font-size:13px;">Adherencja</th>
             </tr>
           </thead>
           <tbody>${lowComplianceRows}</tbody>
         </table>`
      : '';

  const inactiveSection =
    data.inactivePatients.length > 0
      ? `<h3 style="color:#d97706; font-size:15px; margin:24px 0 8px;">🕐 Nieaktywni pacjenci (&gt;14 dni bez check-inu)</h3>
         <table style="width:100%; border-collapse:collapse; background:#fffbeb; border-radius:8px; overflow:hidden;">
           <thead>
             <tr style="background:#fde68a;">
               <th style="padding:8px 12px; text-align:left; color:#92400e; font-size:13px;">Pacjent</th>
               <th style="padding:8px 12px; text-align:center; color:#92400e; font-size:13px;">Brak aktywności</th>
             </tr>
           </thead>
           <tbody>${inactiveRows}</tbody>
         </table>`
      : '';

  const greeting = data.dietitianName ? `Cześć ${data.dietitianName}!` : 'Cześć!';

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Tygodniowe podsumowanie — Twoi pacjenci',
    text: `${greeting}\n\nPodsumowanie Twoich pacjentów:\nŁącznie: ${data.totalPatients} | Aktywnych: ${data.activePatients} | Avg adherencja: ${data.avgCompliance}%\n\nZespół e-dietetyk.com`,
    html: `
      <div style="font-family:Arial,sans-serif; max-width:600px; margin:0 auto;">
        <div style="background:linear-gradient(135deg,#15803d,#166534); padding:24px 32px; border-radius:12px 12px 0 0;">
          <p style="margin:0; font-size:20px; font-weight:bold; color:#ffffff;">🌿 e-dietetyk.com</p>
          <p style="margin:4px 0 0; font-size:13px; color:#bbf7d0;">Panel dietetyka — tygodniowe podsumowanie</p>
        </div>
        <div style="background:#ffffff; padding:32px; border:1px solid #e5e7eb; border-top:none;">
          <p style="color:#374151; font-size:16px;">${greeting}</p>
          <p style="color:#6b7280; font-size:14px; margin-bottom:20px;">Oto tygodniowe podsumowanie Twoich pacjentów:</p>

          <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
            <tr>
              <td style="padding:12px; background:#f0fdf4; border-radius:8px; text-align:center; width:33%;">
                <p style="margin:0; font-size:28px; font-weight:bold; color:#16a34a;">${data.totalPatients}</p>
                <p style="margin:4px 0 0; font-size:12px; color:#6b7280;">Łącznie pacjentów</p>
              </td>
              <td style="padding:12px; background:#f0fdf4; border-radius:8px; text-align:center; width:33%; margin:0 8px;">
                <p style="margin:0; font-size:28px; font-weight:bold; color:#16a34a;">${data.activePatients}</p>
                <p style="margin:4px 0 0; font-size:12px; color:#6b7280;">Aktywnych (14d)</p>
              </td>
              <td style="padding:12px; background:#f0fdf4; border-radius:8px; text-align:center; width:33%;">
                <p style="margin:0; font-size:28px; font-weight:bold; color:#16a34a;">${data.avgCompliance}%</p>
                <p style="margin:4px 0 0; font-size:12px; color:#6b7280;">Śr. adherencja</p>
              </td>
            </tr>
          </table>

          ${lowComplianceSection}
          ${inactiveSection}

          <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
          <p style="color:#9ca3af; font-size:12px; text-align:center;">e-dietetyk.com — Twój osobisty asystent żywieniowy</p>
          ${data.unsubscribeUrl ? `<p style="color:#d1d5db; font-size:11px; text-align:center; margin:4px 0 0;"><a href="${data.unsubscribeUrl}" style="color:#9ca3af; text-decoration:underline;">Zrezygnuj z powiadomień</a></p>` : ''}
        </div>
      </div>
    `,
  });
}

export async function sendPatientInvitationEmail(
  to: string,
  registerUrl: string,
  dietitianName: string,
  dietitianCode: string,
): Promise<void> {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `${dietitianName} zaprasza Cię do współpracy — e-dietetyk.com`,
    text: `Cześć!\n\n${dietitianName} zaprasza Cię do współpracy dietetycznej na platformie e-dietetyk.com.\n\nZarejestruj się pod poniższym linkiem — Twój kod dietetyka zostanie automatycznie uzupełniony:\n${registerUrl}\n\nKod dietetyka: ${dietitianCode}\n\nDo zobaczenia!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); padding: 32px; border-radius: 16px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Zaproszenie do współpracy</h2>
        <p style="color: #374151; font-size: 16px;">
          <strong>${dietitianName}</strong> zaprasza Cię do współpracy dietetycznej na platformie e-dietetyk.com.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          Zarejestruj się klikając poniższy przycisk — Twój kod dietetyka zostanie automatycznie uzupełniony.
        </p>
        <p style="margin: 32px 0; text-align: center;">
          <a href="${registerUrl}"
             style="background-color: #16a34a; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Zarejestruj się
          </a>
        </p>
        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px 0;">Twój kod dietetyka</p>
          <p style="color: #1a1a1a; font-size: 24px; font-weight: bold; font-family: monospace; letter-spacing: 2px; margin: 0;">
            ${dietitianCode}
          </p>
        </div>
        <p style="color: #6b7280; font-size: 13px;">
          Jeśli przycisk nie działa, skopiuj ten link do przeglądarki:<br>
          <span style="color: #374151;">${registerUrl}</span>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">e-dietetyk.com — Twój osobisty asystent żywieniowy</p>
      </div>
    `,
  });
}

// ─── IW-15: Email to dietitian when patient submits interview ─────────────────

export async function sendInterviewSubmittedToDietitian(
  to: string,
  dietitianFirstName: string,
  patientName: string,
  patientId: string,
  dashboardUrl: string,
): Promise<void> {
  const transporter = createTransporter();
  const greeting = dietitianFirstName ? `Cześć ${dietitianFirstName}!` : 'Cześć!';
  const patientUrl = `${dashboardUrl}/dietetyk/pacjenci/${patientId}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `${patientName} wypełnił/a wywiad żywieniowy — e-dietetyk.com`,
    text: `${greeting}\n\nTwój pacjent ${patientName} właśnie uzupełnił wywiad żywieniowy. Możesz teraz wygenerować plan diety.\n\nPodgląd pacjenta: ${patientUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 32px; border-radius: 12px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Nowy wywiad żywieniowy</h2>
        <p style="color: #374151; font-size: 15px;">${greeting}</p>
        <p style="color: #374151; font-size: 15px;">
          Twój pacjent <strong>${patientName}</strong> właśnie uzupełnił wywiad żywieniowy.
          Możesz teraz przejrzeć odpowiedzi i wygenerować spersonalizowany plan diety.
        </p>
        <p style="margin: 28px 0; text-align: center;">
          <a href="${patientUrl}"
             style="background-color: #16a34a; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            Przejdź do profilu pacjenta
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">e-dietetyk.com</p>
      </div>
    `,
  });
}

// ─── IW-16: Confirmation email to patient after interview submission ──────────

export async function sendInterviewConfirmationToPatient(
  to: string,
  patientFirstName: string,
  dashboardUrl: string,
): Promise<void> {
  const transporter = createTransporter();
  const greeting = patientFirstName ? `Cześć ${patientFirstName}!` : 'Cześć!';
  const panelUrl = `${dashboardUrl}/dashboard`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Twój wywiad żywieniowy został przyjęty — e-dietetyk.com',
    text: `${greeting}\n\nDziękujemy za wypełnienie wywiadu żywieniowego. Twój dietetyk przejrzy go i przygotuje spersonalizowany plan diety.\n\nO gotowości planu poinformujemy Cię e-mailem.\n\nZaloguj się: ${panelUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); padding: 32px; border-radius: 12px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Wywiad przyjęty!</h2>
        <p style="color: #374151; font-size: 15px;">${greeting}</p>
        <p style="color: #374151; font-size: 15px;">
          Dziękujemy za wypełnienie wywiadu żywieniowego. Twój dietetyk przejrzy odpowiedzi
          i przygotuje dla Ciebie spersonalizowany plan diety.
        </p>
        <p style="color: #374151; font-size: 15px;">
          O gotowości planu poinformujemy Cię osobnym e-mailem.
        </p>
        <p style="margin: 28px 0; text-align: center;">
          <a href="${panelUrl}"
             style="background-color: #16a34a; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            Przejdź do panelu
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">e-dietetyk.com — Twój osobisty asystent żywieniowy</p>
      </div>
    `,
  });
}

// ─── IW-19: Request interview update email to patient ────────────────────────

export async function sendInterviewUpdateRequestEmail(
  to: string,
  patientFirstName: string,
  dietitianName: string,
  interviewUrl: string,
): Promise<void> {
  const transporter = createTransporter();
  const greeting = patientFirstName ? `Cześć ${patientFirstName}!` : 'Cześć!';

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `${dietitianName} prosi o aktualizację wywiadu — e-dietetyk.com`,
    text: `${greeting}\n\nTwój dietetyk ${dietitianName} prosi Cię o aktualizację wywiadu żywieniowego.\n\nPrzejdź do formularza: ${interviewUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 32px; border-radius: 12px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Aktualizacja wywiadu żywieniowego</h2>
        <p style="color: #374151; font-size: 15px;">${greeting}</p>
        <p style="color: #374151; font-size: 15px;">
          Twój dietetyk <strong>${dietitianName}</strong> prosi Cię o aktualizację wywiadu żywieniowego.
          Aktualny wywiad pomaga lepiej dopasować plan diety do Twoich potrzeb.
        </p>
        <p style="margin: 28px 0; text-align: center;">
          <a href="${interviewUrl}"
             style="background-color: #16a34a; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            Wypełnij wywiad
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">e-dietetyk.com — Twój osobisty asystent żywieniowy</p>
      </div>
    `,
  });
}
