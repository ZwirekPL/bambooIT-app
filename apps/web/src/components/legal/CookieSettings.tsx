'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import type { CookieConsent } from '@/lib/cookie-consent';

interface Props {
  open: boolean;
  initial: CookieConsent | null;
  onSave: (prefs: { functional: boolean; analytics: boolean; marketing: boolean }) => void;
  onClose: () => void;
}

const GA_ENABLED = Boolean(process.env.NEXT_PUBLIC_GA_ID);

export function CookieSettings({ open, initial, onSave, onClose }: Props) {
  const t = useTranslations('cookieBanner');

  const [functional, setFunctional] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFunctional(initial?.functional ?? false);
    setAnalytics(initial?.analytics ?? false);
    setMarketing(initial?.marketing ?? false);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-deep/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-settings-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line-strong bg-paper shadow-2xl">
        <div className="flex items-start justify-between border-b border-line bg-white p-6">
          <h2
            id="cookie-settings-title"
            className="font-display text-xl font-semibold tracking-[-0.02em] text-navy"
          >
            {t('settingsTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-navy-soft transition-colors hover:text-navy"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-6">
          <p className="text-sm leading-relaxed text-navy-soft">{t('settingsIntro')}</p>

          <CategoryRow
            title={t('categoryNecessary')}
            description={t('categoryNecessaryDesc')}
            checked
            disabled
            onChange={() => { /* necessary — cannot toggle */ }}
          />

          <CategoryRow
            title={t('categoryFunctional')}
            description={t('categoryFunctionalDesc')}
            checked={functional}
            onChange={setFunctional}
          />

          {GA_ENABLED && (
            <CategoryRow
              title={t('categoryAnalytics')}
              description={t('categoryAnalyticsDesc')}
              checked={analytics}
              onChange={setAnalytics}
            />
          )}

          <CategoryRow
            title={t('categoryMarketing')}
            description={t('categoryMarketingDesc')}
            checked={marketing}
            onChange={setMarketing}
            disabled
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-white p-6">
          <button
            type="button"
            onClick={() => onSave({ functional: false, analytics: false, marketing: false })}
            className="inline-flex items-center rounded-full border border-line-strong bg-white px-5 py-2 text-sm font-medium text-navy transition-colors hover:border-navy-soft"
          >
            {t('essentialOnly')}
          </button>
          <button
            type="button"
            onClick={() => onSave({ functional, analytics, marketing })}
            className="inline-flex items-center rounded-full border border-line-strong bg-white px-5 py-2 text-sm font-medium text-navy transition-colors hover:border-navy-soft"
          >
            {t('savePreferences')}
          </button>
          <button
            type="button"
            onClick={() => onSave({ functional: true, analytics: GA_ENABLED, marketing: false })}
            className="inline-flex items-center rounded-full bg-bamboo px-5 py-2 text-sm font-semibold text-navy-deep transition-all hover:-translate-y-0.5 hover:bg-bamboo-deep"
          >
            {t('acceptAll')}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={
        disabled
          ? 'flex items-start gap-3 rounded-xl border border-line bg-white p-4 opacity-60'
          : 'flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-4 transition-colors hover:border-line-strong'
      }
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-bamboo-deep"
      />
      <div className="flex-1">
        <p className="font-display text-sm font-semibold text-navy">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-navy-soft">{description}</p>
      </div>
    </label>
  );
}
