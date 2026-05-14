'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { Lead, LeadStatus, LeadType } from '@/types/api';
import { LeadStatusBadge } from './LeadStatusBadge';

const TYPE_LABELS: Record<LeadType, string> = {
  AUDIT: 'Audyt',
  CONTACT: 'Kontakt',
};

const PAGE_SIZE = 25;

interface LeadsTableProps {
  initialLeads?: Lead[];
  initialTotal?: number;
}

export function LeadsTable({ initialLeads, initialTotal }: LeadsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get('page') ?? '1');
  const status = (searchParams.get('status') as LeadStatus | null) ?? '';
  const type = (searchParams.get('type') as LeadType | null) ?? '';
  const search = searchParams.get('search') ?? '';

  const [leads, setLeads] = useState<Lead[]>(initialLeads ?? []);
  const [total, setTotal] = useState<number>(initialTotal ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.admin.leads
      .list({
        page,
        pageSize: PAGE_SIZE,
        status: (status as LeadStatus) || undefined,
        type: (type as LeadType) || undefined,
        search: search || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setLeads(res.leads);
        setTotal(res.total);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof ApiError ? err.message : 'Nie udało się wczytać listy leadów.';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, status, type, search]);

  function updateQuery(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    // Reset to page 1 on filter change (but not on page-only updates)
    if (!('page' in updates)) next.delete('page');
    router.replace(`?${next.toString()}`);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateQuery({ search: searchInput.trim() || null });
  }

  const csvUrl = api.admin.leads.exportCsvUrl({
    status: (status as LeadStatus) || undefined,
    type: (type as LeadType) || undefined,
    search: search || undefined,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-end gap-3">
        <form onSubmit={onSearchSubmit} className="flex flex-1 min-w-[200px] items-center gap-2">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Email, firma, imię..."
            className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
          >
            Szukaj
          </button>
        </form>

        <select
          value={status}
          onChange={(e) => updateQuery({ status: e.target.value || null })}
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="">Status: wszystkie</option>
          <option value="NEW">Nowe</option>
          <option value="CONTACTED">W kontakcie</option>
          <option value="QUALIFIED">Zakwalifikowane</option>
          <option value="CONVERTED">Klienci</option>
          <option value="REJECTED">Odrzucone</option>
        </select>

        <select
          value={type}
          onChange={(e) => updateQuery({ type: e.target.value || null })}
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="">Typ: wszystkie</option>
          <option value="AUDIT">Audyt</option>
          <option value="CONTACT">Kontakt</option>
        </select>

        <a
          href={csvUrl}
          className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Eksport CSV
        </a>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Typ</th>
              <th className="px-4 py-3 font-medium">Imię / Firma</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Telefon</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                </td>
              </tr>
            )}
            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                  Brak leadów spełniających kryteria.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
              >
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {new Date(lead.createdAt).toLocaleDateString('pl-PL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {TYPE_LABELS[lead.type]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{lead.firstName}</div>
                  {lead.company && (
                    <div className="text-xs text-slate-500">{lead.company}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <a href={`mailto:${lead.email}`} className="hover:underline">
                    {lead.email}
                  </a>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="hover:underline">
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <LeadStatusBadge status={lead.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link
                    href={`/admin/leady/${lead.id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    Otwórz →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-slate-500">
            Strona {page} z {totalPages} · {total} wyników
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => updateQuery({ page: String(page - 1) })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Poprzednia
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => updateQuery({ page: String(page + 1) })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Następna →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
