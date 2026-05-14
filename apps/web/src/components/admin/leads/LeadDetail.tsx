'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { Lead, LeadStatus } from '@/types/api';
import { LeadStatusBadge, LEAD_STATUS_OPTIONS } from './LeadStatusBadge';
import { LeadNotesPanel } from './LeadNotesPanel';

const TYPE_LABELS = { AUDIT: 'Audyt', CONTACT: 'Kontakt' } as const;

const INDUSTRY_LABELS: Record<string, string> = {
  accounting: 'Biuro rachunkowe',
  law: 'Kancelaria prawna',
  medical: 'Gabinet medyczny',
  production: 'Produkcja',
  hospitality: 'Hotel / gastronomia',
  other: 'Inna',
};

export function LeadDetail({ initialLead }: { initialLead: Lead }) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead>(initialLead);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onStatusChange(next: LeadStatus) {
    if (next === lead.status) return;
    setStatusUpdating(true);
    setError(null);
    try {
      const res = await api.admin.leads.updateStatus(lead.id, next);
      setLead(res.lead);
      router.refresh();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Nie udało się zmienić statusu.';
      setError(msg);
    } finally {
      setStatusUpdating(false);
    }
  }

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
  const industryLabel = lead.industry
    ? INDUSTRY_LABELS[lead.industry] ?? lead.industry
    : null;
  const createdAtStr = new Date(lead.createdAt).toLocaleString('pl-PL', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Warsaw',
  });

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/leady"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Wszystkie leady
      </Link>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {TYPE_LABELS[lead.type]}
            </span>
            <LeadStatusBadge status={lead.status} />
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{fullName}</h1>
          {lead.company && <p className="text-sm text-slate-600">{lead.company}</p>}
        </div>

        <div className="flex flex-col items-end gap-2">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Zmień status
          </label>
          <div className="relative">
            <select
              value={lead.status}
              disabled={statusUpdating}
              onChange={(e) => onStatusChange(e.target.value as LeadStatus)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm font-medium focus:border-slate-500 focus:outline-none disabled:opacity-60"
            >
              {LEAD_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {statusUpdating && (
              <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Lead facts + message */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Dane kontaktowe
            </h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Fact label="Email">
                <a
                  href={`mailto:${lead.email}`}
                  className="text-slate-900 hover:underline"
                >
                  {lead.email}
                </a>
              </Fact>
              <Fact label="Telefon">
                {lead.phone ? (
                  <a href={`tel:${lead.phone}`} className="text-slate-900 hover:underline">
                    {lead.phone}
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </Fact>
              <Fact label="Branża">{industryLabel ?? '—'}</Fact>
              <Fact label="Rozmiar zespołu">
                {lead.sizeRange ? `${lead.sizeRange} stanowisk` : '—'}
              </Fact>
              <Fact label="Źródło">{lead.source ?? '—'}</Fact>
              <Fact label="Zgłoszono">{createdAtStr}</Fact>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Wiadomość
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {lead.description || <span className="text-slate-400">(brak treści)</span>}
            </p>
          </section>

          {(lead.ipAddress || lead.userAgent) && (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Metadane (anti-abuse)
              </h2>
              <dl className="grid grid-cols-1 gap-y-3 text-xs">
                {lead.ipAddress && (
                  <div>
                    <dt className="text-slate-500">IP</dt>
                    <dd className="font-mono text-slate-800">{lead.ipAddress}</dd>
                  </div>
                )}
                {lead.userAgent && (
                  <div>
                    <dt className="text-slate-500">User-Agent</dt>
                    <dd className="break-all font-mono text-slate-800">{lead.userAgent}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>

        {/* Notes panel */}
        <LeadNotesPanel
          leadId={lead.id}
          initialNotes={lead.notes ?? []}
          onLeadUpdate={setLead}
        />
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{children}</dd>
    </div>
  );
}
