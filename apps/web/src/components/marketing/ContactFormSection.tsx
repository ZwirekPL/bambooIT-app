'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { BRAND } from '@config/brand';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Quick contact form per W2.CC.4 plan — 4 fields (vs the audit form's 7).
 * Wired to backend POST /leads/contact via /api/proxy/leads/contact (BE-1).
 *
 * Side-by-side layout: form left, contact-info card right. On mobile
 * the card stacks below the form.
 */
export function ContactFormSection() {
  const t = useTranslations('kontakt.form');
  const [state, setState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'submitting') return;

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get('name') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim() || undefined,
      message: String(formData.get('message') ?? '').trim(),
      rodo: formData.get('rodo') === 'on',
      website: String(formData.get('website') ?? ''),
    };

    setState('submitting');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/proxy/leads/contact', {
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
    <section className="bg-paper px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-12 md:grid-cols-[1.4fr_1fr] md:gap-16">
        {/* Form side */}
        <div>
          {state === 'success' ? (
            <SuccessPanel
              title={t('success.title')}
              message={t('success.message')}
              resetCta={t('success.resetCta')}
              onReset={reset}
            />
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-line bg-white p-8 md:p-10"
              noValidate
            >
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <Field label={t('fields.name')} name="name" type="text" required />
                <Field label={t('fields.phone')} name="phone" type="tel" />
                <div className="sm:col-span-2">
                  <Field label={t('fields.email')} name="email" type="email" required />
                </div>
                <div className="sm:col-span-2">
                  <TextareaField
                    label={t('fields.message')}
                    name="message"
                    placeholder={t('fields.messagePlaceholder')}
                    required
                  />
                </div>
              </div>

              <Honeypot />

              <label className="mt-6 flex items-start gap-3 text-sm leading-[1.5] text-navy-soft">
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
                className="mt-7 inline-flex items-center gap-3 rounded-full bg-navy-deep px-8 py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-bamboo hover:text-navy-deep disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-navy-deep disabled:hover:text-white"
              >
                {state === 'submitting' ? t('submittingBtn') : t('submitBtn')}
                {state !== 'submitting' && (
                  <svg
                    width="18"
                    height="18"
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
                  className="mt-6 rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-700"
                >
                  {errorMessage}
                </p>
              )}
            </form>
          )}
        </div>

        {/* Contact info side */}
        <aside className="flex flex-col gap-8 rounded-3xl bg-navy-deep p-8 text-white md:p-10">
          <ContactRow
            label={t('info.phoneLabel')}
            value={BRAND.phone}
            href={`tel:${BRAND.phone.replace(/\s/g, '')}`}
          />
          <ContactRow
            label={t('info.emailLabel')}
            value={BRAND.email}
            href={`mailto:${BRAND.email}`}
          />
          <div>
            <span className="block font-mono text-[11px] uppercase tracking-[0.2em] text-bamboo">
              {t('info.hoursLabel')}
            </span>
            <p className="mt-2 font-display text-lg text-white md:text-xl">
              {t('info.hours')}
            </p>
            <p className="mt-1 text-sm text-white/60">{t('info.responseTime')}</p>
          </div>
          <div>
            <span className="block font-mono text-[11px] uppercase tracking-[0.2em] text-bamboo">
              {t('info.areaLabel')}
            </span>
            <p className="mt-2 font-display text-lg text-white md:text-xl">
              {t('info.area')}
            </p>
            <p className="mt-1 text-sm text-white/60">{t('info.areaNote')}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ContactRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <div>
      <span className="block font-mono text-[11px] uppercase tracking-[0.2em] text-bamboo">
        {label}
      </span>
      <a
        href={href}
        className="mt-2 inline-block border-b border-transparent font-display text-lg text-white transition-colors hover:border-bamboo md:text-xl"
      >
        {value}
      </a>
    </div>
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
      <label htmlFor={name} className="font-mono text-[11px] uppercase tracking-[0.18em] text-bamboo-deep">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="border-b border-line-strong bg-transparent py-3 text-base text-navy outline-none transition-colors focus:border-bamboo-deep"
      />
    </div>
  );
}

function TextareaField({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="font-mono text-[11px] uppercase tracking-[0.18em] text-bamboo-deep">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={5}
        required={required}
        placeholder={placeholder}
        className="resize-y border-b border-line-strong bg-transparent py-3 text-base text-navy placeholder:text-navy-soft/50 outline-none transition-colors focus:border-bamboo-deep"
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
  resetCta,
  onReset,
}: {
  title: string;
  message: string;
  resetCta: string;
  onReset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-bamboo/50 bg-white p-12 text-center md:p-16">
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
      <h3 className="font-display text-3xl font-semibold tracking-[-0.02em] text-navy">
        {title}
      </h3>
      <p className="mx-auto mt-4 max-w-prose text-base leading-[1.6] text-navy-soft">
        {message}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-8 font-mono text-xs uppercase tracking-[0.15em] text-bamboo-deep underline underline-offset-4 transition-colors hover:text-navy"
      >
        {resetCta}
      </button>
    </div>
  );
}
