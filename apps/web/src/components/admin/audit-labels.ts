// Shared audit log labels & helpers for history drawers
// Source of truth: AuditLogTable.tsx ACTION_LABELS / RESOURCE_LABELS
//

export const ACTION_LABELS: Record<string, string> = {
  // — Auth / Account —
  LOGIN: 'Logowanie',
  LOGOUT: 'Wylogowanie',
  LOGIN_FAILED: 'Nieudane logowanie',
  ACCOUNT_LOCKED: 'Zablokowanie konta',
  UNLOCK_ACCOUNT: 'Odblokowanie konta',
  DELETE_USER: 'Usunięcie użytkownika',
  RESTORE_USER: 'Przywrócenie użytkownika',
  CHANGE_USER_ROLE: 'Zmiana roli',
  CREATE_USER: 'Utworzenie użytkownika',
  BULK_USER_ACTION: 'Operacja masowa',
  REVOKE_USER_SESSIONS: 'Unieważnienie sesji',
  PASSWORD_RESET: 'Reset hasła',
  PASSWORD_CHANGE: 'Zmiana hasła',
  EMAIL_VERIFIED: 'Weryfikacja email',
  EMAIL_CHANGE: 'Zmiana email',
  ADMIN_VERIFY_EMAIL: 'Admin: weryfikacja email',
  ADMIN_RESEND_VERIFICATION: 'Admin: ponowna weryfikacja',
  ADMIN_FORCE_PASSWORD_RESET: 'Admin: reset hasła',
  DELETE_OWN_ACCOUNT: 'Usunięcie własnego konta',

  // — Stripe / Subscription / Checkout —
  SUBSCRIPTION_CHECKOUT_STARTED: 'Rozpoczęcie płatności',
  SUBSCRIPTION_PORTAL_ACCESSED: 'Dostęp do portalu',
  STRIPE_CHECKOUT_COMPLETED: 'Płatność zakończona',
  STRIPE_INVOICE_PAID: 'Faktura opłacona',
  STRIPE_SUBSCRIPTION_DELETED: 'Subskrypcja usunięta',
  STRIPE_SUBSCRIPTION_UPDATED: 'Subskrypcja zaktualizowana',
  STRIPE_INVOICE_PAYMENT_FAILED: 'Płatność nieudana',
  STRIPE_REFUND: 'Zwrot Stripe',
  CHECKOUT_STARTED: 'Rozpoczęcie checkout',
  CHECKOUT_COMPLETED: 'Zakończenie checkout',

  // — Blog —
  CREATE_POST: 'Utworzenie wpisu',
  EDIT_POST: 'Edycja wpisu',
  DELETE_POST: 'Usunięcie wpisu',

  // — Testimonial —
  CREATE_TESTIMONIAL: 'Dodanie opinii',
  DELETE_TESTIMONIAL: 'Usunięcie opinii',
  APPROVE_TESTIMONIAL: 'Zatwierdzenie opinii',
  REJECT_TESTIMONIAL: 'Odrzucenie opinii',

  // — Referral —
  REFERRAL_CODE_GENERATED: 'Wygenerowanie kodu polecającego',
  REFERRAL_USED: 'Użycie kodu polecającego',
  REFERRAL_DISCOUNT_APPLIED: 'Zastosowanie rabatu',

};

export const RESOURCE_LABELS: Record<string, string> = {
  USER: 'Użytkownik',
  SUBSCRIPTION: 'Subskrypcja',
  POST: 'Wpis blogowy',
  ORDER: 'Zamówienie',
  TESTIMONIAL: 'Opinia',
  REFERRAL: 'Polecenie',
  FEATURE_FLAG: 'Feature flag',

};

export type Severity = 'critical' | 'warning' | 'normal';

export function getActionSeverity(action: string): Severity {
  if (action.startsWith('DELETE_') || action === 'GENERATION_BLOCKED' || action === 'RED_FLAG_TRIGGERED' ||
      action === 'ACCOUNT_LOCKED' || action === 'LOGIN_FAILED') return 'critical';
  if (action.startsWith('EXPORT_') || action.startsWith('BULK_') || action === 'CHANGE_USER_ROLE' ||
      action === 'STRIPE_INVOICE_PAYMENT_FAILED' || action === 'STRIPE_REFUND' ||
      action === 'REVOKE_USER_SESSIONS' || action === 'ADMIN_FORCE_PASSWORD_RESET') return 'warning';
  return 'normal';
}

/** Human-readable action label in Polish */
export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ').toLowerCase();
}

/** Human-readable resource label in Polish */
export function resourceLabel(type: string): string {
  return RESOURCE_LABELS[type] ?? type.replace(/_/g, ' ').toLowerCase();
}

/** Friendly relative-time + absolute date string */
export function formatActivityDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  let relative: string;
  if (diffMin < 1) relative = 'przed chwilą';
  else if (diffMin < 60) relative = `${diffMin} min temu`;
  else if (diffH < 24) relative = `${diffH} godz. temu`;
  else if (diffD === 1) relative = 'wczoraj';
  else if (diffD < 7) relative = `${diffD} dni temu`;
  else relative = '';

  const abs = d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: diffD > 365 ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  });

  return relative ? `${relative} · ${abs}` : abs;
}
