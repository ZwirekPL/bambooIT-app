'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { MyTicketDetail } from '@/types/tickets';
import {
  STATUS_LABELS,
  STATUS_BADGE,
  PRIORITY_LABELS,
  OPEN_STATUSES,
} from '@/components/tickets/ticketFormat';

export function ClientTicketThread({ id }: { id: string }) {
  const [ticket, setTicket] = useState<MyTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.tickets
      .getMy(id, '')
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

  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-navy-soft">
        <Loader2 className="h-4 w-4 animate-spin" /> Wczytywanie…
      </div>
    );
  if (error || !ticket) return <p className="text-sm text-red-600">{error ?? 'Brak zgłoszenia.'}</p>;

  const canReply = OPEN_STATUSES.includes(ticket.status);
  const sla =
    ticket.firstResponseAt || !ticket.slaDueAt
      ? null
      : `Odpowiemy do ${new Date(ticket.slaDueAt).toLocaleString('pl-PL')}`;

  return (
    <div className="space-y-5">
      <Link
        href="/panel/zgloszenia"
        className="inline-flex items-center gap-1 text-sm text-navy-soft hover:text-bamboo-deep"
      >
        <ArrowLeft className="h-4 w-4" /> Moje zgłoszenia
      </Link>

      <header>
        <p className="font-mono text-xs text-navy-soft">#{ticket.number}</p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy-deep">
          {ticket.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-0.5 font-medium ${STATUS_BADGE[ticket.status]}`}>
            {STATUS_LABELS[ticket.status]}
          </span>
          <span className="text-navy-soft">Priorytet: {PRIORITY_LABELS[ticket.priority]}</span>
          {ticket.category && <span className="text-navy-soft">· {ticket.category}</span>}
          {sla && <span className="text-bamboo-deep">· {sla}</span>}
        </div>
      </header>

      <div className="space-y-3">
        {ticket.messages.map((m) => {
          const isAdmin = m.author?.role === 'ADMIN';
          return (
            <div
              key={m.id}
              className={
                isAdmin
                  ? 'rounded-xl border border-bamboo-deep/20 bg-bamboo-deep/5 p-4'
                  : 'rounded-xl border border-line bg-white p-4'
              }
            >
              <div className="mb-1 text-xs text-navy-soft">
                <span className="font-medium text-navy-deep">{isAdmin ? 'bambooIT' : 'Ty'}</span> ·{' '}
                {new Date(m.createdAt).toLocaleString('pl-PL')}
              </div>
              <p className="whitespace-pre-wrap text-sm text-navy-deep">{m.body}</p>
            </div>
          );
        })}
      </div>

      {canReply ? (
        <ReplyBox ticketId={id} onSent={load} />
      ) : (
        <p className="rounded-xl border border-line bg-paper p-4 text-sm text-navy-soft">
          To zgłoszenie jest zamknięte. Jeśli sprawa wróciła — załóż nowe zgłoszenie.
        </p>
      )}
    </div>
  );
}

function ReplyBox({ ticketId, onSent }: { ticketId: string; onSent: () => void }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 1) return;
    setSaving(true);
    setError(null);
    try {
      await api.tickets.addMessage(ticketId, body.trim(), '');
      setBody('');
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się wysłać.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-2 rounded-xl border border-line bg-white p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Napisz odpowiedź…"
        className="w-full rounded-lg border border-line px-3 py-2 text-sm text-navy-deep"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-bamboo-deep px-5 py-2.5 text-sm font-semibold text-navy-deep transition-colors hover:bg-bamboo-deep/90 disabled:opacity-50"
        >
          {saving ? 'Wysyłam…' : 'Wyślij'}
        </button>
      </div>
    </form>
  );
}
