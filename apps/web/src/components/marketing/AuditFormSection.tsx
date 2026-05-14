'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const SIZE_OPTIONS = [
  { value: '1-5', labelKey: '1' },
  { value: '6-15', labelKey: '2' },
  { value: '16-30', labelKey: '3' },
  { value: '30+', labelKey: '4' },
] as const;

const INDUSTRY_OPTIONS = [
  'accounting',
  'law',
  'medical',
  'production',
  'hospitality',
  'other',
] as const;

/**
 * Audit form per mockup §audit, wired to backend POST /leads/audit
 * via /api/proxy/leads/audit (BE-1).
 */
export function AuditFormSection() {
  const t = useTranslations('home.auditForm');
  const [state, setState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'submitting') return;

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get('name') ?? '').trim(),
      company: String(formData.get('company') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim() || undefined,
      size: String(formData.get('size') ?? ''),
      industry: String(formData.get('industry') ?? ''),
      message: String(formData.get('message') ?? '').trim() || undefined,
      rodo: formData.get('rodo') === 'on',
      website: String(formData.get('website') ?? ''), // honeypot
    };

    setState('submitting');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/proxy/leads/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(t('errors.rateLimit'));
        }
        if (res.status === 400) {
          throw new Error(t('errors.validation'));
        }
        throw new Error(t('errors.generic'));
      }

      setState('success');
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : t('errors.generic'));
    }
  }

  function reset() {
    setState('idle');
    setErrorMessage(null);
  }

  return (
    <section
      id="audit"
      className="relative bg-navy-deep px-5 py-24 text-white md:px-12 md:py-32 lg:py-40"
    >
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="mb-16 grid grid-cols-1 items-end gap-8 md:grid-cols-2 md:gap-16">
          <div>
            <div className="mb-8 flex items-center gap-3.5 font-mono text-xs uppercase tracking-[0.2em] text-bamboo">
              <span aria-hidden="true" className="h-px w-8 bg-bamboo" />
              {t('intro.label')}
            </div>
            <h2 className="font-display text-4xl font-light leading-none tracking-[-0.035em] text-white md:text-5xl lg:text-6xl">
              {t.rich('intro.heading', {
                br: () => <br />,
                em: (chunks) => <em className="font-semibold italic text-bamboo">{chunks}</em>,
              })}
            </h2>
          </div>
          <p className="max-w-[38ch] text-base leading-[1.6] text-white/70 md:text-lg">
            {t('intro.lede')}
          </p>
        </div>

        {state === 'success' ? (
          <SuccessPanel
            title={t('success.title')}
            message={t('success.message')}
            ctaReset={t('success.resetCta')}
            onReset={reset}
          />
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 md:p-12"
            noValidate
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Field label={t('fields.name')} name="name" type="text" required />
              <Field label={t('fields.company')} name="company" type="text" required />
              <Field label={t('fields.email')} name="email" type="email" required />
              <Field label={t('fields.phone')} name="phone" type="tel" />
              <SelectField
                label={t('fields.size')}
                name="size"
                required
                options={SIZE_OPTIONS.map((o) => ({
                  value: o.value,
                  label: t(`fields.sizeOptions.${o.labelKey}`),
                }))}
              />
              <SelectField
                label={t('fields.industry')}
                name="industry"
                required
                options={INDUSTRY_OPTIONS.map((value) => ({
                  value,
                  label: t(`fields.industryOptions.${value}`),
                }))}
              />
              <div className="md:col-span-2">
                <TextareaField
                  label={t('fields.message')}
                  name="message"
                  placeholder={t('fields.messagePlaceholder')}
                />
              </div>
            </div>

            <Honeypot />

            <label className="mt-7 flex items-start gap-3 text-sm leading-[1.5] text-white/70">
              <input
                type="checkbox"
                name="rodo"
                required
                className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-bamboo"
              />
              <span>{t('fields.rodo')}</span>
            </label>

            <button
              type="submit"
              disabled={state === 'submitting'}
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-bamboo px-9 py-4 text-base font-bold text-navy-deep transition-all hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-bamboo"
            >
              {state === 'submitting' ? t('submittingBtn') : t('submitBtn')}
              {state !== 'submitting' && (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </button>

            {state === 'error' && errorMessage && (
              <p
                role="alert"
                className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200"
              >
                {errorMessage}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  type,
  required,
}: {
  label: string;
  name: string;
  type: 'text' | 'email' | 'tel';
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="font-mono text-[11px] uppercase tracking-[0.18em] text-bamboo">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="border-b border-white/20 bg-transparent py-3 text-base text-white outline-none transition-colors focus:border-bamboo"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  required,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="font-mono text-[11px] uppercase tracking-[0.18em] text-bamboo">
        {label}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue=""
        className="border-b border-white/20 bg-transparent py-3 text-base text-white outline-none transition-colors focus:border-bamboo [&>option]:bg-navy-deep"
      >
        <option value="" disabled hidden></option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextareaField({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="font-mono text-[11px] uppercase tracking-[0.18em] text-bamboo">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        placeholder={placeholder}
        rows={3}
        className="resize-y border-b border-white/20 bg-transparent py-3 text-base text-white placeholder:text-white/50 outline-none transition-colors focus:border-bamboo"
      />
    </div>
  );
}

/**
 * Honeypot — CSS-hidden field that legitimate users can't see/tab to.
 * Bots auto-fill all fields; backend rejects requests where this is set.
 */
function Honeypot() {
  return (
    <div className="pointer-events-none absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
      <label htmlFor="website">Website (leave empty)</label>
      <input
        type="text"
        id="website"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
    </div>
  );
}

function SuccessPanel({
  title,
  message,
  ctaReset,
  onReset,
}: {
  title: string;
  message: string;
  ctaReset: string;
  onReset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-bamboo/40 bg-white/[0.04] p-12 text-center md:p-16">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-bamboo">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-navy-deep"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      </div>
      <h3 className="font-display text-3xl font-semibold tracking-[-0.02em] text-white md:text-4xl">
        {title}
      </h3>
      <p className="mx-auto mt-4 max-w-prose text-base leading-[1.6] text-white/70 md:text-lg">
        {message}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-8 font-mono text-xs uppercase tracking-[0.15em] text-bamboo underline underline-offset-4 transition-colors hover:text-white"
      >
        {ctaReset}
      </button>
    </div>
  );
}
