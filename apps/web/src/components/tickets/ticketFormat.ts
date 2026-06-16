import type { TicketStatus, TicketPriority, TicketChannel } from '@/types/tickets';

export const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: 'Nowe',
  IN_PROGRESS: 'W toku',
  WAITING_CLIENT: 'Czeka na klienta',
  RESOLVED: 'Rozwiązane',
  CLOSED: 'Zamknięte',
};

// Tailwind classes for the status badge (bg + text).
export const STATUS_BADGE: Record<TicketStatus, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  WAITING_CLIENT: 'bg-purple-100 text-purple-700',
  RESOLVED: 'bg-bamboo-deep/15 text-navy-deep',
  CLOSED: 'bg-line text-navy-soft',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Niski',
  NORMAL: 'Normalny',
  HIGH: 'Wysoki',
  URGENT: 'Pilny',
};

export const PRIORITY_BADGE: Record<TicketPriority, string> = {
  LOW: 'bg-line text-navy-soft',
  NORMAL: 'bg-slate-100 text-slate-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

export const CHANNEL_LABELS: Record<TicketChannel, string> = {
  PORTAL: 'Panel',
  PHONE: 'Telefon',
  EMAIL: 'E-mail',
  MANUAL: 'Ręcznie',
};

export const CATEGORIES = [
  'Sprzęt',
  'Sieć/internet',
  'Poczta/M365',
  'Oprogramowanie',
  'Bezpieczeństwo',
  'Konto/dostępy',
  'Inne',
] as const;

// Active statuses a client may still act on.
export const OPEN_STATUSES: TicketStatus[] = ['NEW', 'IN_PROGRESS', 'WAITING_CLIENT'];

export type SlaTone = 'met' | 'ok' | 'soon' | 'overdue' | 'none';

export interface SlaState {
  tone: SlaTone;
  label: string;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * SLA badge state for a ticket. Once the team has reacted (firstResponseAt set)
 * the deadline is met; otherwise we count down to slaDueAt and flag soon/overdue.
 * `nowMs` is injected so callers control "now" (and avoid SSR hydration drift).
 */
export function slaState(
  ticket: { slaDueAt: string | null; firstResponseAt: string | null; status: TicketStatus },
  nowMs: number,
): SlaState {
  if (ticket.firstResponseAt) return { tone: 'met', label: 'Odpowiedziano' };
  if (!OPEN_STATUSES.includes(ticket.status)) return { tone: 'none', label: '—' };
  if (!ticket.slaDueAt) return { tone: 'none', label: 'Bez SLA' };

  const due = new Date(ticket.slaDueAt).getTime();
  const diff = due - nowMs;
  if (diff < 0) return { tone: 'overdue', label: 'Po terminie' };
  if (diff < TWO_HOURS_MS) return { tone: 'soon', label: `Zostało ${fmtDuration(diff)}` };
  return { tone: 'ok', label: `Do ${fmtDuration(diff)}` };
}

export const SLA_TONE_CLASS: Record<SlaTone, string> = {
  met: 'text-bamboo-deep',
  ok: 'text-navy-soft',
  soon: 'text-amber-600 font-medium',
  overdue: 'text-red-600 font-semibold',
  none: 'text-navy-soft',
};

/** Rough humanised duration: "3 h", "45 min", "2 dni". */
export function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} dni`;
}

/** Minutes → "5 h 20 min" (mirrors opsFormat.fmtMinutes). */
export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function companyLabel(c: {
  companyName: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
}): string {
  return (
    c.companyName ||
    [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ') ||
    'Klient'
  );
}
