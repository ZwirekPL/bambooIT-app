'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Audit form UI per mockup §audit.
 *
 * UI-only stub: submission is a local preventDefault() that flips a
 * `submitted` state to show a thank-you panel. Real backend wiring
 * (POST /api/leads/audit → Lead model row + Resend notification) lands
 * in BE-1 per D-069. The form fields here match the schema planned in
 * TODO.md §6 Migration 11 so the swap is one component refactor.
 */
export function AuditFormSection() {
  const t = useTranslations('home.auditForm');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <section
      id="audit"
      className="relative bg-navy-deep px-5 py-24 text-white md:px-12 md:py-32 lg:py-40"
    >
      <div className="mx-auto w-full max-w-[1100px]">
        {/* Intro */}
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

        {/* Form / success panel */}
        {submitted ? (
          <SuccessPanel
            title={t('success.title')}
            message={t('success.message')}
            ctaReset={t('success.resetCta')}
            onReset={() => setSubmitted(false)}
          />
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 md:p-12"
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Field label={t('fields.name')} name="name" type="text" required />
              <Field label={t('fields.company')} name="company" type="text" required />
              <Field label={t('fields.email')} name="email" type="email" required />
              <Field label={t('fields.phone')} name="phone" type="tel" />
              <SelectField
                label={t('fields.size')}
                name="size"
                options={[
                  t('fields.sizeOptions.1'),
                  t('fields.sizeOptions.2'),
                  t('fields.sizeOptions.3'),
                  t('fields.sizeOptions.4'),
                ]}
              />
              <SelectField
                label={t('fields.industry')}
                name="industry"
                options={[
                  t('fields.industryOptions.accounting'),
                  t('fields.industryOptions.law'),
                  t('fields.industryOptions.medical'),
                  t('fields.industryOptions.production'),
                  t('fields.industryOptions.hospitality'),
                  t('fields.industryOptions.other'),
                ]}
              />
              <div className="md:col-span-2">
                <TextareaField
                  label={t('fields.message')}
                  name="message"
                  placeholder={t('fields.messagePlaceholder')}
                />
              </div>
            </div>

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
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-bamboo px-9 py-4 text-base font-bold text-navy-deep transition-all hover:-translate-y-0.5 hover:bg-white"
            >
              {t('submitBtn')}
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
            </button>
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
}: {
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="font-mono text-[11px] uppercase tracking-[0.18em] text-bamboo">
        {label}
      </label>
      <select
        id={name}
        name={name}
        className="border-b border-white/20 bg-transparent py-3 text-base text-white outline-none transition-colors focus:border-bamboo [&>option]:bg-navy-deep"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
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
        className="resize-y border-b border-white/20 bg-transparent py-3 text-base text-white placeholder:text-white/30 outline-none transition-colors focus:border-bamboo"
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
