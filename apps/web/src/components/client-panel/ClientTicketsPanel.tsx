'use client';

import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { Loader2, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { MyTicketSummary, TicketPriority } from '@/types/tickets';
import {
  STATUS_LABELS,
  STATUS_BADGE,
  CATEGORIES,
  PRIORITY_LABELS,
} from '@/components/tickets/ticketFormat';

const CLIENT_PRIORITIES: TicketPriority[] = ['LOW', 'NORMAL', 'HIGH'];

export function ClientTicketsPanel() {
  const [tickets, setTickets] = useState<MyTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  function load() {
    api.tickets
      .listMy(undefined, '')
      .then((r) => {
        setTickets(r.tickets);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Nie udało się wczytać zgłoszeń.'),
      )
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-bamboo-deep">Obsługa IT</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-navy-deep">
            Zgłoszenia
          </h1>
          <p className="mt-1 text-sm text-navy-soft">
            Zgłoś problem lub prośbę — odpowiemy w czasie wynikającym z Twojego pakietu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-bamboo-deep px-5 py-2.5 text-sm font-semibold text-navy-deep transition-colors hover:bg-bamboo-deep/90"
        >
          <Plus className="h-4 w-4" />
          Nowe zgłoszenie
        </button>
      </header>

      {showNew && <NewTicketForm onCreated={() => { setShowNew(false); load(); }} onCancel={() => setShowNew(false)} />}

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-white p-8 text-sm text-navy-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Wczytywanie…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <p className="font-medium text-navy-deep">Nie masz jeszcze żadnych zgłoszeń</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-navy-soft">
            Coś nie działa albo potrzebujesz pomocy? Kliknij „Nowe zgłoszenie”, a my się tym zajmiemy.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {tickets.map((tk) => (
            <li key={tk.id}>
              <Link
                href={`/panel/zgloszenia/${tk.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-paper/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-navy-deep">
                    <span className="font-mono text-xs text-navy-soft">#{tk.number}</span> {tk.title}
                  </p>
                  <p className="text-xs text-navy-soft">
                    {tk.category ? `${tk.category} · ` : ''}
                    {tk._count.messages} wiad. · {new Date(tk.updatedAt).toLocaleDateString('pl-PL')}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[tk.status]}`}
                >
                  {STATUS_LABELS[tk.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/panel/subskrypcja" className="inline-block text-sm text-navy-soft hover:text-bamboo-deep">
        ← Wróć do panelu
      </Link>
    </div>
  );
}

function NewTicketForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('NORMAL');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3 || body.trim().length < 1) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.tickets.create(
        { title: title.trim(), body: body.trim(), priority, category: category || null },
        '',
      );
      onCreated();
      router.push(`/panel/zgloszenia/${r.ticket.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się utworzyć zgłoszenia.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-white p-6">
      <label className="block text-xs font-medium text-navy-soft">
        Temat
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
          maxLength={160}
          placeholder="np. Nie działa drukarka w sekretariacie"
          className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-navy-deep"
        />
      </label>
      <label className="block text-xs font-medium text-navy-soft">
        Opis
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={4}
          placeholder="Opisz problem — co się dzieje, od kiedy, czego dotyczy."
          className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-navy-deep"
        />
      </label>
      <div className="flex flex-wrap gap-4">
        <label className="text-xs font-medium text-navy-soft">
          Kategoria
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="ml-2 rounded-lg border border-line px-2 py-1.5 text-sm text-navy-deep"
          >
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-navy-soft">
          Priorytet
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
            className="ml-2 rounded-lg border border-line px-2 py-1.5 text-sm text-navy-deep"
          >
            {CLIENT_PRIORITIES.map((p) => (
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
          className="rounded-full bg-bamboo-deep px-5 py-2.5 text-sm font-semibold text-navy-deep transition-colors hover:bg-bamboo-deep/90 disabled:opacity-50"
        >
          {saving ? 'Wysyłam…' : 'Wyślij zgłoszenie'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-line px-5 py-2.5 text-sm text-navy-soft hover:bg-paper"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}
