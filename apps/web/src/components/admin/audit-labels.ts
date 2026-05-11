// Shared audit log labels & helpers for history drawers
// Source of truth: AuditLogTable.tsx ACTION_LABELS / RESOURCE_LABELS

export const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Logowanie',
  LOGOUT: 'Wylogowanie',
  VIEW_INTERVIEW: 'Podgląd wywiadu',
  CREATE_INTERVIEW: 'Utworzenie wywiadu',
  GENERATE_PLAN: 'Generowanie planu',
  VIEW_PLAN: 'Podgląd planu',
  APPROVE_PLAN: 'Zatwierdzenie planu',
  SEND_PLAN: 'Wysłanie planu',
  PUBLISH_PLAN: 'Publikacja planu',
  EDIT_PLAN: 'Edycja planu',
  EXPORT_PLAN: 'Eksport planu',
  CREATE_MANUAL_PLAN: 'Ręczne tworzenie planu',
  VIEW_PATIENT: 'Podgląd pacjenta',
  UPDATE_PATIENT: 'Aktualizacja pacjenta',
  DELETE_PATIENT: 'Usunięcie pacjenta',
  DELETE_USER: 'Usunięcie użytkownika',
  RESTORE_USER: 'Przywrócenie użytkownika',
  CHANGE_USER_ROLE: 'Zmiana roli',
  CREATE_USER: 'Utworzenie użytkownika',
  CREATE_DIETITIAN: 'Utworzenie dietetyka',
  UPDATE_DIETITIAN: 'Aktualizacja dietetyka',
  ROTATE_DIETITIAN_CODE: 'Rotacja kodu dietetyka',
  PASSWORD_RESET: 'Reset hasła',
  PASSWORD_CHANGE: 'Zmiana hasła',
  EMAIL_VERIFIED: 'Weryfikacja email',
  EMAIL_CHANGE: 'Zmiana email',
  ADMIN_VERIFY_EMAIL: 'Admin: weryfikacja email',
  ADMIN_RESEND_VERIFICATION: 'Admin: ponowna weryfikacja',
  ADMIN_FORCE_PASSWORD_RESET: 'Admin: reset hasła',
  BULK_USER_ACTION: 'Operacja masowa',
  REVOKE_USER_SESSIONS: 'Unieważnienie sesji',
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
  CREATE_POST: 'Utworzenie wpisu',
  EDIT_POST: 'Edycja wpisu',
  DELETE_POST: 'Usunięcie wpisu',
  CREATE_RECIPE: 'Utworzenie przepisu',
  UPDATE_RECIPE: 'Aktualizacja przepisu',
  DELETE_RECIPE: 'Usunięcie przepisu',
  BULK_UPDATE_RECIPES: 'Masowa edycja przepisów',
  MERGE_RECIPES: 'Scalanie przepisów',
  CREATE_CLEAN_PRODUCT: 'Utworzenie produktu',
  UPDATE_CLEAN_PRODUCT: 'Aktualizacja produktu',
  DELETE_CLEAN_PRODUCT: 'Usunięcie produktu',
  BULK_UPDATE_CLEAN_PRODUCTS: 'Masowa edycja produktów',
  CREATE_PROTOCOL: 'Utworzenie protokołu',
  UPDATE_PROTOCOL: 'Aktualizacja protokołu',
  TOGGLE_PROTOCOL: 'Zmiana statusu protokołu',
  ASSIGN_PROTOCOL: 'Przypisanie protokołu',
  UNASSIGN_PROTOCOL: 'Odpisanie protokołu',
  PROTOCOL_AUTO_MATCHED: 'Auto-dopasowanie protokołu',
  PROTOCOL_CONFLICT_DETECTED: 'Wykryty konflikt protokołów',
  CREATE_PROTOCOL_TRIGGER: 'Utworzenie mapowania',
  UPDATE_PROTOCOL_TRIGGER: 'Aktualizacja mapowania',
  DELETE_PROTOCOL_TRIGGER: 'Usunięcie mapowania',
  CREATE_PROTOCOL_CONFLICT: 'Utworzenie konfliktu',
  UPDATE_PROTOCOL_CONFLICT: 'Aktualizacja konfliktu',
  DELETE_PROTOCOL_CONFLICT: 'Usunięcie konfliktu',
  AI_GENERATION_ENQUEUED: 'Generowanie AI zlecone',
  AI_REPAIR_ENQUEUED: 'Naprawa AI zlecona',
  AI_PARTIAL_REGEN_ENQUEUED: 'Częściowa regeneracja AI',
  REGENERATE_PARTIAL: 'Regeneracja częściowa',
  RED_FLAG_TRIGGERED: 'Red flag wyzwolony',
  GENERATION_BLOCKED: 'Generowanie zablokowane',
  CREATE_CHECKIN: 'Check-in',
  CHECKIN_ADAPTATION: 'Adaptacja z check-inu',
  CREATE_TESTIMONIAL: 'Dodanie opinii',
  DELETE_TESTIMONIAL: 'Usunięcie opinii',
  APPROVE_TESTIMONIAL: 'Zatwierdzenie opinii',
  REJECT_TESTIMONIAL: 'Odrzucenie opinii',
  REQUEST_MEAL_SWAP: 'Żądanie zamiany posiłku',
  CONFIRM_MEAL_SWAP: 'Potwierdzenie zamiany',
  CREATE_NOTE: 'Utworzenie notatki',
  REFERRAL_CODE_GENERATED: 'Wygenerowanie kodu polecającego',
  REFERRAL_USED: 'Użycie kodu polecającego',
  REFERRAL_DISCOUNT_APPLIED: 'Zastosowanie rabatu',
  UNLOCK_ACCOUNT: 'Odblokowanie konta',
  UNLOCK_PATIENT_PROFILE: 'Odblokowanie profilu pacjenta',
  DELETE_OWN_ACCOUNT: 'Usunięcie własnego konta',
  LOGIN_FAILED: 'Nieudane logowanie',
  ACCOUNT_LOCKED: 'Zablokowanie konta',
};

export const RESOURCE_LABELS: Record<string, string> = {
  USER: 'Użytkownik',
  PATIENT: 'Pacjent',
  INTERVIEW: 'Wywiad',
  DIET_PLAN: 'Plan diety',
  TENANT: 'Tenant',
  SUBSCRIPTION: 'Subskrypcja',
  POST: 'Wpis blogowy',
  FOOD_PRODUCT: 'Produkt spożywczy',
  RECIPE: 'Przepis',
  CLEAN_PRODUCT: 'Produkt',
  ORDER: 'Zamówienie',
  CHECKIN: 'Check-in',
  TESTIMONIAL: 'Opinia',
  MEAL_SWAP: 'Zamiana posiłku',
  DIETITIAN_NOTE: 'Notatka',
  REFERRAL: 'Polecenie',
  NUTRITION_PROTOCOL: 'Protokół żywieniowy',
  PROTOCOL_TRIGGER: 'Mapowanie protokołu',
  PROTOCOL_CONFLICT: 'Konflikt protokołów',
  FEATURE_FLAG: 'Feature flag',
  DIET_TEMPLATE: 'Szablon diety',
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
