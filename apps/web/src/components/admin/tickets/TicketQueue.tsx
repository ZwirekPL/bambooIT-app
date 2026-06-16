'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Loader2, Plus, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { AdminTicketRow, TicketStats, TicketStatus, TicketPriority } from '@/types/tickets';
import type { OpsClientSummary } from '@/types/ops';
import {
  STATUS_LABELS,
  STATUS_BADGE,
  PRIORITY_LABELS,
  PRIORITY_BADGE,
  CHANNEL_LABELS,
  CATEGORIES,
  slaState,
  SLA_TONE_CLASS,
  companyLabel,
} from '@/components/tickets/ticketFormat';

const STATUS_FILTERS: { key: TicketStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Wszystkie' },
  { key: 'NEW', label: STATUS_LABELS.NEW },
  { key: 'IN_PROGRESS', label: STATUS_LABELS.IN_PROGRESS },
  { key: 'WAITING_CLIENT', label: STATUS_LABELS.WAITING_CLIENT },
  { key: 'RESOLVED', label: STATUS_LABELS.RESOLVED },
  { key: 'CLOSED', label: STATUS_LABELS.CLOSED },
];

export function TicketQueue() {
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [status, setStatus] = useState<TicketStatus | 'ALL'>('ALL');
  const [slaBreached, setSlaBreached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const nowMs = Date.now();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.admin.tickets.list(
        {
          status: status === 'ALL' ? undefined : status,
          slaBreached: slaBreached || undefined,
          pageSize: 100,
        },
        '',
      ),
      api.admin.tickets.stats(''),
    ])
      .then(([list, s]) => {
        setTickets(list.tickets);
        setStats(s.stats);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Nie udało się wczytać zgłoszeń.'),
      )
      .finally(() => setLoading(false));
  }, [status, slaBreached]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Otwarte" value={stats.open} />
          <StatCard label="Nowe" value={stats.byStatus.NEW} />
          <StatCard label="Czeka na klienta" value={stats.byStatus.WAITING_CLIENT} />
          <StatCard
            label="Po terminie SLA"
            value={stats.slaBreached}
            danger={stats.slaBreached > 0}
          />
        </div>
      )}

      {/* Filters + create */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={
                status === f.key
                  ? 'rounded-full bg-navy-deep px-3 py-1.5 text-xs font-medium text-white'
                  : 'rounded-full border border-line px-3 py-1.5 text-xs font-medium text-navy-soft hover:bg-paper'
              }
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSlaBreached((v) => !v)}
            className={
              slaBreached
                ? 'inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white'
                : 'inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-navy-soft hover:bg-paper'
            }
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Po terminie
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-bamboo-deep px-3.5 py-2 text-sm font-semibold text-navy-deep transition-colors hover:bg-bamboo-deep/90"
        >
          <Plus className="h-4 w-4" />
          Nowe zgłoszenie
        </button>
      </div>

      {showCreate && (
        <CreateTicketForm
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white p-8 text-sm text-navy-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Wczytywanie…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-line bg-white p-8 text-center">
          <p className="text-sm font-medium text-navy-deep">Brak zgłoszeń</p>
          <p className="mt-1 text-sm text-navy-soft">
            Zgłoszenia z panelu klienta i te dodane ręcznie pojawią się tutaj.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-navy-soft">
                <th className="px-4 py-3 font-medium">Nr</th>
                <th className="px-4 py-3 font-medium">Temat</th>
                <th className="px-4 py-3 font-medium">Klient</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priorytet</th>
                <th className="px-4 py-3 font-medium">SLA</th>
                <th className="px-4 py-3 font-medium">Przypisane</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((tk) => {
                const sla = slaState(tk, nowMs);
                return (
                  <tr
                    key={tk.id}
                    className="border-b border-line/60 last:border-0 hover:bg-paper/60"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-navy-soft">#{tk.number}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/zgloszenia/${tk.id}`}
                        className="font-medium text-navy-deep hover:text-bamboo-deep"
                      >
                        {tk.title}
                      </Link>
                      <div className="text-xs text-navy-soft">
                        {CHANNEL_LABELS[tk.channel]}
                        {tk.category ? ` · ${tk.category}` : ''} · {tk._count.messages} wiad.
                      </div>
                    </td>
                    <td className="px-4 py-3 text-navy-deep">{companyLabel(tk.company)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[tk.status]}`}
                      >
                        {STATUS_LABELS[tk.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_BADGE[tk.priority]}`}
                      >
                        {PRIORITY_LABELS[tk.priority]}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs ${SLA_TONE_CLASS[sla.tone]}`}>{sla.label}</td>
                    <td className="px-4 py-3 text-xs text-navy-soft">
                      {tk.assignee ? tk.assignee.email : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <div
        className={`font-display text-2xl font-bold ${danger ? 'text-red-600' : 'text-navy-deep'}`}
      >
        {value}
      </div>
      <div className="text-xs text-navy-soft">{label}</div>
    </div>
  );
}

function CreateTicketForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [clients, setClients] = useState<OpsClientSummary[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('NORMAL');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.admin.ops
      .listClients('')
      .then((r) => setClients(r.clients))
      .catch(() => setClients([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || title.trim().length < 3 || body.trim().length < 1) return;
    setSaving(true);
    setError(null);
    try {
      await api.admin.tickets.create(
        {
          companyId,
          title: title.trim(),
          body: body.trim(),
          priority,
          category: category || null,
          channel: 'PHONE',
        },
        '',
      );
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się utworzyć zgłoszenia.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-white p-5">
      <p className="text-sm font-semibold text-navy-deep">Nowe zgłoszenie (np. z telefonu)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-navy-soft">
          Klient
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-navy-deep"
          >
            <option value="">— wybierz —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName || c.contactName || c.email}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-navy-soft">
          Kategoria
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-navy-deep"
          >
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs font-medium text-navy-soft">
        Temat
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
          maxLength={160}
          className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-navy-deep"
        />
      </label>
      <label className="block text-xs font-medium text-navy-soft">
        Opis
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={3}
          className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-navy-deep"
        />
      </label>
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-navy-soft">
          Priorytet
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
            className="ml-2 rounded-lg border border-line px-2 py-1.5 text-sm text-navy-deep"
          >
            {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as TicketPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-bamboo-deep px-4 py-2 text-sm font-semibold text-navy-deep transition-colors hover:bg-bamboo-deep/90 disabled:opacity-50"
        >
          {saving ? 'Tworzę…' : 'Utwórz'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-line px-4 py-2 text-sm text-navy-soft hover:bg-paper"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}
