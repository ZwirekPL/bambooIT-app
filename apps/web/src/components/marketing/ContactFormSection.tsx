'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { BRAND } from '@config/brand';

/**
 * Quick contact form per W2.CC.4 plan — 4 fields (vs the audit form's 7).
 * UI-only stub: handleSubmit prevents default, flips to a success panel.
 * Real backend wiring (POST /api/leads/contact → Lead model with
 * type: 'CONTACT') lands in BE-1.
 *
 * Side-by-side layout: form left, contact-info card right. On mobile
 * the card stacks below the form.
 */
export function ContactFormSection() {
  const t = useTranslations('kontakt.form');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <section className="bg-paper px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-12 md:grid-cols-[1.4fr_1fr] md:gap-16">
        {/* Form side */}
        <div>
          {submitted ? (
            <SuccessPanel
              title={t('success.title')}
              message={t('success.message')}
              resetCta={t('success.resetCta')}
              onReset={() => setSubmitted(false)}
            />
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-line bg-white p-8 md:p-10"
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
                className="mt-7 inline-flex items-center gap-3 rounded-full bg-navy-deep px-8 py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-bamboo hover:text-navy-deep"
              >
                {t('submitBtn')}
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
              </button>
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
