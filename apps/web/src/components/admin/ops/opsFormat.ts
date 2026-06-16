import type { Plan, ServicePeriodStatus } from '@/types/ops';

export const PLAN_LABELS: Record<Plan, string> = {
  START: 'Start',
  FIRMA: 'Firma',
  FIRMA_PLUS: 'Firma Plus',
};

export const PERIOD_STATUS_LABELS: Record<ServicePeriodStatus, string> = {
  OPEN: 'Otwarty',
  TO_SETTLE: 'Do rozliczenia',
  SETTLED: 'Rozliczony',
};

export const MONTH_NAMES = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
];

/** Minutes → "5 h 20 min" (or "5 h" when whole). */
export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Decimal hours string → "1,5 h". */
export function fmtHoursDecimal(hours: string | number): string {
  return `${String(hours).replace('.', ',')} h`;
}
