'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Link } from '@/i18n/navigation';
import { Loader2, Lock, Clock, ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { AdminTicketDetail, TicketStatus, TicketPriority } from '@/types/tickets';
import {
  STATUS_LABELS,
  STATUS_BADGE,
  PRIORITY_LABELS,
  CHANNEL_LABELS,
  CATEGORIES,
  slaState,
  SLA_TONE_CLASS,
  fmtMinutes,
  companyLabel,
} from '@/components/tickets/ticketFormat';

const STATUSES: TicketStatus[] = ['NEW', 'IN_PROGRESS', 'WAITING_CLIENT', 'RESOLVED', 'CLOSED'];
const PRIORITIES: TicketPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export function TicketDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const myId = session?.user?.id;
  const [ticket, setTicket] = useState<AdminTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.admin.tickets
      .get(id, '')
      .then((r) => {
        setTicket(r.ticket);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Nie udało się wczytać zgłoszenia.'),
      )
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(data: Parameters<typeof api.admin.tickets.patch>[1]) {
    const r = await api.admin.tickets.patch(id, data, '');
    setTicket(r.ticket);
    // Re-fetch to refresh messages/time/firstResponse that the patch may touch.
    load();
  }

  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-navy-soft">
        <Loader2 className="h-4 w-4 animate-spin" /> Wczytywanie…
      </div>
    );
  if (error || !ticket) return <p className="text-sm text-red-600">{error ?? 'Brak zgłoszenia.'}</p>;

  const sla = slaState(ticket, Date.now());

  return (
    <div className="space-y-5">
      <Link
        href="/admin/zgloszenia"
        className="inline-flex items-center gap-1 text-sm text-navy-soft hover:text-bamboo-deep"
      >
        <ArrowLeft className="h-4 w-4" /> Wszystkie zgłoszenia
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-navy-soft">#{ticket.number}</p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-deep">{ticket.title}</h1>
          <p className="mt-1 text-sm text-navy-soft">
            <Link
              href={`/admin/klienci/${ticket.company.id}`}
              className="font-medium text-navy-deep hover:text-bamboo-deep"
            >
              {companyLabel(ticket.company)}
            </Link>{' '}
            · {ticket.company.user.email} · {CHANNEL_LABELS[ticket.channel]}
          </p>
        </div>
        <span className={`text-sm ${SLA_TONE_CLASS[sla.tone]}`}>SLA: {sla.label}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Thread + reply */}
        <div className="space-y-4">
          <Thread ticket={ticket} />
          <ReplyBox ticketId={id} onSent={load} />
        </div>

        {/* Sidebar controls */}
        <aside className="space-y-4">
          <Control label="Status">
            <select
              value={ticket.status}
              onChange={(e) => patch({ status: e.target.value as TicketStatus })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-navy-deep"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Control>

          <Control label="Priorytet">
            <select
              value={ticket.priority}
              onChange={(e) => patch({ priority: e.target.value as TicketPriority })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-navy-deep"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Control>

          <Control label="Kategoria">
            <select
              value={ticket.category ?? ''}
              onChange={(e) => patch({ category: e.target.value || null })}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-navy-deep"
            >
              <option value="">—</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Control>

          <Control label="Przypisane">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-navy-deep">
                {ticket.assignee ? ticket.assignee.email : 'nieprzypisane'}
              </span>
              {ticket.assignee ? (
                <button
                  type="button"
                  onClick={() => patch({ assigneeId: null })}
                  className="shrink-0 text-xs text-navy-soft hover:text-red-600"
                >
                  Odepnij
                </button>
              ) : (
                myId && (
                  <button
                    type="button"
                    onClick={() => patch({ assigneeId: myId })}
                    className="shrink-0 text-xs font-medium text-bamboo-deep hover:underline"
                  >
                    Przypisz do mnie
                  </button>
                )
              )}
            </div>
          </Control>

          <LogTimePanel
            companyId={ticket.company.id}
            ticketId={id}
            totalMinutes={ticket.totalMinutes}
            entries={ticket.timeEntries}
            onLogged={load}
          />
        </aside>
      </div>
    </div>
  );
}

function Thread({ ticket }: { ticket: AdminTicketDetail }) {
  return (
    <div className="space-y-3">
      {ticket.messages.map((m) => {
        const isAdmin = m.author?.role === 'ADMIN';
        return (
          <div
            key={m.id}
            className={
              m.internal
                ? 'rounded-xl border border-amber-200 bg-amber-50 p-4'
                : isAdmin
                  ? 'rounded-xl border border-bamboo-deep/20 bg-bamboo-deep/5 p-4'
                  : 'rounded-xl border border-line bg-white p-4'
            }
          >
            <div className="mb-1 flex items-center gap-2 text-xs text-navy-soft">
              <span className="font-medium text-navy-deep">
                {isAdmin ? 'Zespół' : 'Klient'}
              </span>
              <span>· {m.author?.email}</span>
              <span>· {new Date(m.createdAt).toLocaleString('pl-PL')}</span>
              {m.internal && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-200 px-1.5 py-0.5 font-medium text-amber-800">
                  <Lock className="h-3 w-3" /> notatka wewnętrzna
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm text-navy-deep">{m.body}</p>
          </div>
        );
      })}
    </div>
  );
}

function ReplyBox({ ticketId, onSent }: { ticketId: string; onSent: () => void }) {
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 1) return;
    setSaving(true);
    setError(null);
    try {
      await api.admin.tickets.addMessage(ticketId, { body: body.trim(), internal }, '');
      setBody('');
      setInternal(false);
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się wysłać.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={send}
      className={
        internal
          ? 'space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4'
          : 'space-y-2 rounded-xl border border-line bg-white p-4'
      }
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={internal ? 'Notatka wewnętrzna (niewidoczna dla klienta)…' : 'Odpowiedź do klienta…'}
        className="w-full rounded-lg border border-line px-3 py-2 text-sm text-navy-deep"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-navy-soft">
          <input
            type="checkbox"
            checked={internal}
            onChange={(e) => setInternal(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          <Lock className="h-3.5 w-3.5" /> notatka wewnętrzna
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-bamboo-deep px-4 py-2 text-sm font-semibold text-navy-deep transition-colors hover:bg-bamboo-deep/90 disabled:opacity-50"
        >
          {saving ? 'Wysyłam…' : internal ? 'Dodaj notatkę' : 'Wyślij odpowiedź'}
        </button>
      </div>
    </form>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-navy-soft">{label}</p>
      {children}
    </div>
  );
}

function LogTimePanel({
  companyId,
  ticketId,
  totalMinutes,
  entries,
  onLogged,
}: {
  companyId: string;
  ticketId: string;
  totalMinutes: number;
  entries: AdminTicketDetail['timeEntries'];
  onLogged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState(30);
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 1 || minutes < 1) return;
    setSaving(true);
    setError(null);
    try {
      await api.admin.ops.addTimeEntry(
        companyId,
        {
          date: new Date(date).toISOString(),
          minutes,
          description: description.trim(),
          billable,
          ticketId,
        },
        '',
      );
      setDescription('');
      setMinutes(30);
      setOpen(false);
      onLogged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się zapisać czasu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-navy-soft">
          <Clock className="h-3.5 w-3.5" /> Czas na zgłoszeniu
        </p>
        <span className="text-sm font-semibold text-navy-deep">{fmtMinutes(totalMinutes)}</span>
      </div>

      {entries.length > 0 && (
        <ul className="mb-2 space-y-1 border-b border-line pb-2">
          {entries.map((e) => (
            <li key={e.id} className="flex justify-between gap-2 text-xs text-navy-soft">
              <span className="truncate">
                {e.date.slice(0, 10)} · {e.description}
              </span>
              <span className="shrink-0 text-navy-deep">{fmtMinutes(e.minutes)}</span>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form onSubmit={submit} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-1/2 rounded-lg border border-line px-2 py-1.5 text-xs text-navy-deep"
            />
            <input
              type="number"
              min={1}
              max={1440}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-1/2 rounded-lg border border-line px-2 py-1.5 text-xs text-navy-deep"
              placeholder="min"
            />
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Co zrobiono…"
            className="w-full rounded-lg border border-line px-2 py-1.5 text-xs text-navy-deep"
          />
          <label className="flex items-center gap-2 text-xs text-navy-soft">
            <input
              type="checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Rozliczalne (liczone do pakietu)
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-bamboo-deep px-3 py-1.5 text-xs font-semibold text-navy-deep hover:bg-bamboo-deep/90 disabled:opacity-50"
            >
              {saving ? 'Zapis…' : 'Zapisz czas'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-navy-soft hover:bg-paper"
            >
              Anuluj
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-lg border border-dashed border-line px-3 py-2 text-xs font-medium text-navy-soft hover:bg-paper hover:text-navy-deep"
        >
          + Zaloguj czas
        </button>
      )}
    </div>
  );
}
