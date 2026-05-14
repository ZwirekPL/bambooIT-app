'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { Lead, LeadNote } from '@/types/api';

interface LeadNotesPanelProps {
  leadId: string;
  initialNotes: LeadNote[];
  onLeadUpdate?: (lead: Lead) => void;
}

export function LeadNotesPanel({ leadId, initialNotes, onLeadUpdate }: LeadNotesPanelProps) {
  const [notes, setNotes] = useState<LeadNote[]>(initialNotes);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.admin.leads.addNote(leadId, trimmed);
      const updatedNotes = (res.lead.notes ?? []) as LeadNote[];
      setNotes(updatedNotes);
      setText('');
      onLeadUpdate?.(res.lead);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Nie udało się dodać notatki.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(noteId: string) {
    if (deletingId) return;
    if (!confirm('Usunąć tę notatkę?')) return;
    setDeletingId(noteId);
    setError(null);
    try {
      const res = await api.admin.leads.deleteNote(leadId, noteId);
      const updatedNotes = (res.lead.notes ?? []) as LeadNote[];
      setNotes(updatedNotes);
      onLeadUpdate?.(res.lead);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Nie udało się usunąć notatki.';
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  }

  const sortedNotes = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Notatki ({notes.length})
      </h2>

      <form onSubmit={onSubmit} className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Co ustaliliśmy z klientem? Kto dzwonił, kiedy oddzwonić..."
          rows={3}
          maxLength={2000}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">{text.length} / 2000</span>
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Dodaj notatkę
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {sortedNotes.length === 0 && (
          <li className="rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
            Brak notatek. Pierwsza notatka pojawi się tutaj.
          </li>
        )}
        {sortedNotes.map((note) => (
          <li
            key={note.id}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
          >
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <div className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">{note.authorName}</span>{' '}
                ·{' '}
                {new Date(note.createdAt).toLocaleString('pl-PL', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </div>
              <button
                type="button"
                disabled={deletingId === note.id}
                onClick={() => onDelete(note.id)}
                aria-label="Usuń notatkę"
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600 disabled:opacity-40"
              >
                {deletingId === note.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <p className="whitespace-pre-wrap leading-snug text-slate-800">{note.text}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
