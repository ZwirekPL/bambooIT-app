'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Check } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { isValidNIP } from '@/lib/validators/nip';
import type { Company } from '@/types/api';

const INDUSTRY_OPTIONS = [
  'accounting',
  'law',
  'medical',
  'production',
  'hospitality',
  'other',
] as const;
type IndustryValue = (typeof INDUSTRY_OPTIONS)[number];

const INDUSTRY_LABELS: Record<IndustryValue, string> = {
  accounting: 'Biuro rachunkowe',
  law: 'Kancelaria prawna',
  medical: 'Gabinet medyczny',
  production: 'Produkcja',
  hospitality: 'Hotel / gastronomia',
  other: 'Inna',
};

type State = 'loading' | 'idle' | 'submitting' | 'success' | 'error';

export function CompanyProfileForm() {
  const [state, setState] = useState<State>('loading');
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.profile.getCompany();
        if (cancelled) return;
        setCompany(res.company);
        setState('idle');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof ApiError ? err.message : 'Nie udało się wczytać danych.';
        setError(msg);
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'submitting') return;

    const form = event.currentTarget;
    const get = (name: string) =>
      String((form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement)?.value ?? '').trim();

    const nipRaw = get('nip');
    if (!isValidNIP(nipRaw)) {
      setError('Nieprawidłowy NIP. Sprawdź czy wpisałeś 10 cyfr.');
      setState('error');
      return;
    }

    const employeesCountRaw = get('employeesCount');
    const employeesCount = employeesCountRaw ? Number(employeesCountRaw) : null;

    setState('submitting');
    setError(null);

    try {
      const res = await api.profile.updateCompany({
        contactFirstName: get('contactFirstName') || undefined,
        contactLastName: get('contactLastName') || undefined,
        companyName: get('companyName') || undefined,
        nip: nipRaw.replace(/[\s-]/g, ''),
        industry: (get('industry') as IndustryValue) || undefined,
        employeesCount,
        city: get('city') || null,
        address: get('address') || null,
        postalCode: get('postalCode') || null,
        phone: get('phone') || undefined,
        website: get('website') || null,
      });
      setCompany(res.company);
      setState('success');
      // Auto-dismiss success badge after a few seconds
      setTimeout(() => {
        setState((s) => (s === 'success' ? 'idle' : s));
      }, 4000);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      const msg =
        code === 'NIP_TAKEN'
          ? 'NIP jest już używany przez inną firmę w bambooIT. Skontaktuj się z nami.'
          : err instanceof Error
            ? err.message
            : 'Nie udało się zapisać zmian.';
      setError(msg);
      setState('error');
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-bamboo-deep" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="rounded-3xl border border-red-300 bg-red-50 p-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-navy">Nie znaleziono profilu firmy</h1>
        <p className="mt-3 text-sm text-red-700">
          {error ?? 'Skontaktuj się z nami, jeśli problem się powtarza.'}
        </p>
      </div>
    );
  }

  const submitting = state === 'submitting';

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bamboo-deep">
          Panel klienta
        </p>
        <h1 className="mt-2 font-display text-3xl font-light leading-tight tracking-[-0.02em] text-navy md:text-4xl">
          Dane firmy
        </h1>
        <p className="mt-3 max-w-prose text-sm text-navy-soft">
          Zmień dane firmy, telefon kontaktowy i adres do faktur. Email i hasło konta —
          osobne ekrany.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl border border-line bg-white p-6 md:p-8"
        noValidate
      >
        {state === 'success' && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-bamboo/40 bg-bamboo/10 px-4 py-3 text-sm text-navy-deep"
          >
            <Check className="h-4 w-4 text-bamboo-deep" />
            Zmiany zostały zapisane.
          </div>
        )}
        {state === 'error' && error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <section className="space-y-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-navy-soft">
            Osoba kontaktowa
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Imię"
              name="contactFirstName"
              defaultValue={company.contactFirstName ?? ''}
              autoComplete="given-name"
            />
            <Field
              label="Nazwisko"
              name="contactLastName"
              defaultValue={company.contactLastName ?? ''}
              autoComplete="family-name"
            />
            <Field
              label="Telefon"
              name="phone"
              type="tel"
              defaultValue={company.phone ?? ''}
              required
              autoComplete="tel"
            />
          </div>
        </section>

        <section className="space-y-4 border-t border-line pt-6">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-navy-soft">
            Dane firmy
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr]">
            <Field
              label="Nazwa firmy"
              name="companyName"
              defaultValue={company.companyName ?? ''}
              required
              autoComplete="organization"
            />
            <Field
              label="NIP"
              name="nip"
              defaultValue={company.nip ?? ''}
              required
              inputMode="numeric"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Branża"
              name="industry"
              defaultValue={company.industry ?? ''}
              required
              options={INDUSTRY_OPTIONS.map((v) => ({ value: v, label: INDUSTRY_LABELS[v] }))}
            />
            <Field
              label="Liczba pracowników"
              name="employeesCount"
              type="number"
              defaultValue={company.employeesCount?.toString() ?? ''}
              min={1}
              max={10000}
            />
          </div>
          <Field
            label="Strona internetowa"
            name="website"
            type="url"
            defaultValue={company.website ?? ''}
            autoComplete="url"
          />
        </section>

        <section className="space-y-4 border-t border-line pt-6">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-navy-soft">
            Adres (do faktur)
          </h2>
          <Field
            label="Ulica i numer"
            name="address"
            defaultValue={company.address ?? ''}
            autoComplete="street-address"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr]">
            <Field
              label="Kod pocztowy"
              name="postalCode"
              defaultValue={company.postalCode ?? ''}
              placeholder="00-000"
              autoComplete="postal-code"
            />
            <Field
              label="Miejscowość"
              name="city"
              defaultValue={company.city ?? ''}
              autoComplete="address-level2"
            />
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-4 border-t border-line pt-6">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-3 rounded-full bg-navy-deep px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-bamboo hover:text-navy-deep disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-navy-deep disabled:hover:text-white"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
  autoComplete,
  placeholder,
  inputMode,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={name}
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-bamboo-deep"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        inputMode={inputMode}
        min={min}
        max={max}
        className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-navy-deep outline-none transition-colors focus:border-bamboo-deep focus:ring-2 focus:ring-bamboo-deep/20"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  required,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={name}
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-bamboo-deep"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-navy-deep outline-none transition-colors focus:border-bamboo-deep focus:ring-2 focus:ring-bamboo-deep/20"
      >
        <option value="" disabled hidden>
          Wybierz...
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
