import type { LeadsStats } from '@/types/api';

const STATUS_LABELS: Record<keyof LeadsStats['byStatus'], string> = {
  NEW: 'Nowe',
  CONTACTED: 'W kontakcie',
  QUALIFIED: 'Zakwalifikowane',
  CONVERTED: 'Klienci',
  REJECTED: 'Odrzucone',
};

export function LeadsStatsCards({ stats }: { stats: LeadsStats }) {
  const cards = [
    { label: 'Wszystkie', value: stats.total, accent: 'text-slate-900' },
    { label: 'Nowe', value: stats.byStatus.NEW, accent: 'text-blue-700' },
    { label: 'W kontakcie', value: stats.byStatus.CONTACTED, accent: 'text-amber-700' },
    { label: 'Klienci', value: stats.byStatus.CONVERTED, accent: 'text-emerald-700' },
    { label: 'Ostatnie 7 dni', value: stats.last7Days, accent: 'text-slate-900' },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className={`mt-2 text-2xl font-bold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((key) => (
          <span
            key={key}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
          >
            <span className="font-medium">{STATUS_LABELS[key]}</span>
            <span className="font-mono text-slate-500">{stats.byStatus[key]}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
          <span className="font-medium">Audyt</span>
          <span className="font-mono text-slate-500">{stats.byType.AUDIT}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
          <span className="font-medium">Kontakt</span>
          <span className="font-mono text-slate-500">{stats.byType.CONTACT}</span>
        </span>
      </div>
    </>
  );
}
