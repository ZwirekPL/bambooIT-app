import type { LeadStatus } from '@/types/api';

const STATUS_STYLES: Record<LeadStatus, { bg: string; text: string; label: string }> = {
  NEW: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Nowy' },
  CONTACTED: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'W kontakcie' },
  QUALIFIED: { bg: 'bg-violet-100', text: 'text-violet-800', label: 'Zakwalifikowany' },
  CONVERTED: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Klient' },
  REJECTED: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Odrzucony' },
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const cfg = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

export const LEAD_STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: 'NEW', label: 'Nowy' },
  { value: 'CONTACTED', label: 'W kontakcie' },
  { value: 'QUALIFIED', label: 'Zakwalifikowany' },
  { value: 'CONVERTED', label: 'Klient' },
  { value: 'REJECTED', label: 'Odrzucony' },
];
