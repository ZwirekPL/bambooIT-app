'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type {
  OpsClientSummary,
  OpsHoursView,
  OpsOnboarding,
  OpsPeriod,
  Plan,
  ServicePackage,
} from '@/types/ops';
import {
  PLAN_LABELS,
  PERIOD_STATUS_LABELS,
  MONTH_NAMES,
  fmtMinutes,
  fmtHoursDecimal,
} from './opsFormat';

type Tab = 'plan' | 'hours' | 'billing' | 'onboarding';

const TABS: { key: Tab; label: string }[] = [
  { key: 'plan', label: 'Pakiet' },
  { key: 'hours', label: 'Godziny' },
  { key: 'billing', label: 'Rozliczenia' },
  { key: 'onboarding', label: 'Onboarding' },
];

const ONBOARDING_STEPS: { key: keyof OpsOnboarding; label: string }[] = [
  { key: 'accessCollected', label: 'Zebrano dostępy do systemów' },
  { key: 'remoteToolReady', label: 'AnyDesk / RustDesk zainstalowany u klienta' },
  { key: 'monitoringSet', label: 'Monitoring skonfigurowany' },
  { key: 'backupSet', label: 'Backup skonfigurowany' },
  { key: 'docsCreated', label: 'Dokumentacja środowiska utworzona' },
];

const btn =
  'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50';
const btnPrimary = `${btn} bg-bamboo-deep text-navy-deep hover:bg-bamboo-deep/90`;
const btnGhost = `${btn} border border-line text-navy-soft hover:bg-paper hover:text-navy-deep`;
const input =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-navy-deep focus:border-bamboo-deep focus:outline-none';

export function ClientOpsPanel({ companyId }: { companyId: string }) {
  const [tab, setTab] = useState<Tab>('hours');
  const [summary, setSummary] = useState<OpsClientSummary | null>(null);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [hours, setHours] = useState<OpsHoursView | null>(null);
  const [periods, setPeriods] = useState<OpsPeriod[]>([]);
  const [onboarding, setOnboarding] = useState<OpsOnboarding | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const [clientsRes, pkgRes] = await Promise.all([
        api.admin.ops.listClients(),
        api.admin.ops.listPackages(),
      ]);
      setSummary(clientsRes.clients.find((c) => c.id === companyId) ?? null);
      setPackages(pkgRes.packages);
    } catch (err) {
      setLoadErr(err instanceof ApiError ? err.message : 'Nie udało się wczytać klienta.');
    }
  }, [companyId]);

  const loadHours = useCallback(async () => {
    const r = await api.admin.ops.getHours(companyId, { year, month });
    setHours(r.hours);
  }, [companyId, year, month]);

  const loadPeriods = useCallback(async () => {
    const r = await api.admin.ops.listPeriods(companyId);
    setPeriods(r.periods);
  }, [companyId]);

  const loadOnboarding = useCallback(async () => {
    const r = await api.admin.ops.getOnboarding(companyId);
    setOnboarding(r.onboarding);
  }, [companyId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);
  useEffect(() => {
    loadHours().catch(() => setHours(null));
  }, [loadHours]);
  useEffect(() => {
    if (tab === 'billing') loadPeriods().catch(() => {});
    if (tab === 'onboarding') loadOnboarding().catch(() => {});
  }, [tab, loadPeriods, loadOnboarding]);

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  if (loadErr) return <p className="text-sm text-red-600">{loadErr}</p>;

  const title = summary?.companyName || summary?.contactName || summary?.email || 'Klient';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/klienci" className="text-sm text-navy-soft hover:text-bamboo-deep">
          ← Klienci
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-deep">{title}</h1>
        <p className="text-sm text-navy-soft">
          {summary?.email}
          {summary?.servicePlan && ` · Pakiet ${PLAN_LABELS[summary.servicePlan]}`}
        </p>
      </div>

      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-bamboo-deep text-navy-deep'
                : 'border-transparent text-navy-soft hover:text-navy-deep'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plan' && (
        <PlanTab
          companyId={companyId}
          current={summary?.servicePlan ?? null}
          packages={packages}
          onSaved={() => {
            loadSummary();
            loadHours().catch(() => {});
          }}
        />
      )}
      {tab === 'hours' && (
        <HoursTab
          companyId={companyId}
          hours={hours}
          year={year}
          month={month}
          onPrev={prevMonth}
          onNext={nextMonth}
          onChanged={() => {
            loadHours().catch(() => {});
            loadSummary();
          }}
        />
      )}
      {tab === 'billing' && (
        <BillingTab periods={periods} onSettled={loadPeriods} />
      )}
      {tab === 'onboarding' && (
        <OnboardingTab
          companyId={companyId}
          onboarding={onboarding}
          onChanged={() => {
            loadOnboarding().catch(() => {});
            loadSummary();
          }}
        />
      )}
    </div>
  );
}

// ─── Pakiet ───────────────────────────────────────────────────────────────

function PlanTab({
  companyId,
  current,
  packages,
  onSaved,
}: {
  companyId: string;
  current: Plan | null;
  packages: ServicePackage[];
  onSaved: () => void;
}) {
  const [plan, setPlan] = useState<Plan | ''>(current ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api.admin.ops.setServicePlan(companyId, { plan: plan === '' ? null : plan });
      setMsg('Zapisano.');
      onSaved();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Błąd zapisu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4 rounded-xl border border-line bg-white p-5">
      <p className="text-sm text-navy-soft">
        Pakiet określa godziny w abonamencie, stawkę za nadgodziny i SLA. Ustawienie pakietu
        aktywuje klienta i zaczyna naliczanie godzin.
      </p>
      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-navy-soft">Pakiet</label>
        <select
          className={input}
          value={plan}
          onChange={(e) => setPlan(e.target.value as Plan | '')}
        >
          <option value="">— brak (klient nieaktywny) —</option>
          {packages.map((p) => (
            <option key={p.plan} value={p.plan}>
              {PLAN_LABELS[p.plan]} — {p.hoursIncluded} h, overage {p.overageRatePerHour} zł/h, SLA{' '}
              {p.reactionTimeHours} h
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={btnPrimary} onClick={save} disabled={saving}>
          {saving ? 'Zapisywanie…' : 'Zapisz pakiet'}
        </button>
        {msg && <span className="text-sm text-navy-soft">{msg}</span>}
      </div>
    </div>
  );
}

// ─── Godziny ──────────────────────────────────────────────────────────────

function HoursTab({
  companyId,
  hours,
  year,
  month,
  onPrev,
  onNext,
  onChanged,
}: {
  companyId: string;
  hours: OpsHoursView | null;
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onChanged: () => void;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [h, setH] = useState('');
  const [m, setM] = useState('');
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    const minutes = (parseInt(h || '0', 10) || 0) * 60 + (parseInt(m || '0', 10) || 0);
    if (minutes < 1) {
      setErr('Podaj czas (minimum 1 minuta).');
      return;
    }
    if (!description.trim()) {
      setErr('Opis jest wymagany.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await api.admin.ops.addTimeEntry(companyId, {
        date: new Date(`${date}T12:00:00.000Z`).toISOString(),
        minutes,
        description: description.trim(),
        billable,
      });
      setH('');
      setM('');
      setDescription('');
      setBillable(true);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Błąd zapisu.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.admin.ops.deleteTimeEntry(id);
    onChanged();
  }

  const overage = hours ? Number(hours.overageHours) > 0 : false;
  const pct =
    hours && hours.availableMinutes > 0
      ? Math.min(100, Math.round((hours.consumedMinutes / hours.availableMinutes) * 100))
      : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-navy-deep">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <div className="flex gap-2">
          <button type="button" className={btnGhost} onClick={onPrev}>
            ← poprz.
          </button>
          <button type="button" className={btnGhost} onClick={onNext}>
            nast. →
          </button>
        </div>
      </div>

      {!hours ? (
        <p className="rounded-xl border border-line bg-white p-5 text-sm text-navy-soft">
          Klient nie ma aktywnego pakietu — ustaw pakiet w zakładce „Pakiet”, aby logować godziny.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-line bg-white p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-navy-soft">Wykorzystanie</span>
              <span className="text-sm font-medium text-navy-deep">
                {fmtMinutes(hours.consumedMinutes)} / {fmtMinutes(hours.availableMinutes)}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className={overage ? 'h-full bg-red-500' : 'h-full bg-bamboo-deep'}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-navy-soft sm:grid-cols-4">
              <div>
                <div className="text-navy-deep font-medium">{hours.hoursIncluded} h</div>
                w pakiecie
              </div>
              <div>
                <div className="text-navy-deep font-medium">
                  {fmtMinutes(hours.carryoverInMinutes)}
                </div>
                przeniesione
              </div>
              <div>
                <div className="text-navy-deep font-medium">{fmtHoursDecimal(hours.overageHours)}</div>
                nadgodziny
              </div>
              <div>
                <div className={overage ? 'font-medium text-red-600' : 'font-medium text-navy-deep'}>
                  {hours.overageAmountNet} zł
                </div>
                do doliczenia
              </div>
            </div>
          </div>

          {/* Add time entry */}
          <div className="rounded-xl border border-line bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-navy-deep">Zaloguj czas</h3>
            <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto]">
              <div>
                <label className="text-xs text-navy-soft">Data</label>
                <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-navy-soft">Czas</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    placeholder="h"
                    className={`${input} w-16`}
                    value={h}
                    onChange={(e) => setH(e.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    max={59}
                    placeholder="min"
                    className={`${input} w-20`}
                    value={m}
                    onChange={(e) => setM(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-navy-soft">Opis</label>
                <input
                  type="text"
                  className={input}
                  placeholder="Co zostało zrobione"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button type="button" className={btnPrimary} onClick={add} disabled={saving}>
                  {saving ? '…' : 'Dodaj'}
                </button>
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-navy-soft">
              <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
              Liczone do pakietu (odznacz dla gestu / gwarancji)
            </label>
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          </div>

          {/* Entries */}
          <div className="rounded-xl border border-line bg-white">
            {hours.entries.length === 0 ? (
              <p className="p-5 text-sm text-navy-soft">Brak wpisów w tym miesiącu.</p>
            ) : (
              <ul className="divide-y divide-line">
                {hours.entries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-navy-deep">
                        {e.description}
                        {!e.billable && (
                          <span className="ml-2 rounded bg-line px-1.5 py-0.5 text-[10px] text-navy-soft">
                            nieliczone
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-navy-soft">
                        {e.date.slice(0, 10)} · {fmtMinutes(e.minutes)}
                        {e.createdBy?.email && ` · ${e.createdBy.email}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      className="text-xs text-navy-soft hover:text-red-600"
                    >
                      Usuń
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Rozliczenia ──────────────────────────────────────────────────────────

function BillingTab({
  periods,
  onSettled,
}: {
  periods: OpsPeriod[];
  onSettled: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState<string | null>(null);
  const [reportDone, setReportDone] = useState<string | null>(null);

  async function settle(id: string) {
    setBusy(id);
    try {
      await api.admin.ops.settlePeriod(id);
      onSettled();
    } finally {
      setBusy(null);
    }
  }

  async function sendReport(id: string) {
    setReportBusy(id);
    setReportDone(null);
    try {
      await api.admin.ops.sendReport(id);
      setReportDone(id);
    } finally {
      setReportBusy(null);
    }
  }

  if (periods.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-white p-5 text-sm text-navy-soft">
        Brak okresów rozliczeniowych — pojawią się po zalogowaniu pierwszych godzin.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-navy-soft">
            <th className="px-4 py-3 font-medium">Miesiąc</th>
            <th className="px-4 py-3 font-medium">Zużyte</th>
            <th className="px-4 py-3 font-medium">Nadgodziny</th>
            <th className="px-4 py-3 font-medium">Do doliczenia</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => {
            const overage = Number(p.overageHours) > 0;
            return (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 text-navy-deep">
                  {MONTH_NAMES[p.month - 1]} {p.year}
                </td>
                <td className="px-4 py-3 text-navy-soft">
                  {fmtMinutes(p.consumedMinutes)} / {fmtMinutes(p.availableMinutes)}
                </td>
                <td className="px-4 py-3">
                  {overage ? (
                    <span className="text-red-600">{fmtHoursDecimal(p.overageHours)}</span>
                  ) : (
                    <span className="text-navy-soft">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-navy-deep">{p.overageAmountNet} zł</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      p.status === 'SETTLED'
                        ? 'bg-bamboo-deep/10 text-navy-deep'
                        : p.status === 'TO_SETTLE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-line text-navy-soft'
                    }`}
                  >
                    {PERIOD_STATUS_LABELS[p.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => sendReport(p.id)}
                      disabled={reportBusy === p.id}
                      className={btnGhost}
                    >
                      {reportBusy === p.id
                        ? '…'
                        : reportDone === p.id
                          ? 'Wysłano ✓'
                          : 'Wyślij raport'}
                    </button>
                    {p.status !== 'SETTLED' && (
                      <button
                        type="button"
                        onClick={() => settle(p.id)}
                        disabled={busy === p.id}
                        className={btnGhost}
                      >
                        {busy === p.id ? '…' : 'Oznacz rozliczone'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────

function OnboardingTab({
  companyId,
  onboarding,
  onChanged,
}: {
  companyId: string;
  onboarding: OpsOnboarding | null;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    setNotes(onboarding?.notes ?? '');
  }, [onboarding]);

  if (!onboarding) return <p className="text-sm text-navy-soft">Wczytywanie…</p>;

  async function toggle(step: keyof OpsOnboarding) {
    const done = Boolean(onboarding![step]);
    await api.admin.ops.updateOnboarding(companyId, { [step]: !done });
    onChanged();
  }

  async function toggleComplete() {
    await api.admin.ops.updateOnboarding(companyId, { completed: !onboarding!.completedAt });
    onChanged();
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await api.admin.ops.updateOnboarding(companyId, { notes });
      onChanged();
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4 rounded-xl border border-line bg-white p-5">
      <ul className="space-y-2">
        {ONBOARDING_STEPS.map((s) => {
          const done = Boolean(onboarding[s.key]);
          return (
            <li key={s.key}>
              <label className="flex items-center gap-3 text-sm text-navy-deep">
                <input type="checkbox" checked={done} onChange={() => toggle(s.key)} />
                <span className={done ? 'text-navy-deep' : 'text-navy-soft'}>{s.label}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-navy-soft">Notatki</label>
        <textarea
          className={`${input} min-h-[80px]`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="button" className={btnGhost} onClick={saveNotes} disabled={savingNotes}>
          {savingNotes ? 'Zapisywanie…' : 'Zapisz notatki'}
        </button>
      </div>

      <div className="border-t border-line pt-4">
        <button type="button" className={onboarding.completedAt ? btnGhost : btnPrimary} onClick={toggleComplete}>
          {onboarding.completedAt ? 'Cofnij zakończenie onboardingu' : 'Zakończ onboarding'}
        </button>
        {onboarding.completedAt && (
          <p className="mt-2 text-xs text-navy-soft">
            Ukończony {onboarding.completedAt.slice(0, 10)}
          </p>
        )}
      </div>
    </div>
  );
}
