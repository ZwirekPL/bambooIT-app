'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-settings-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <h2 id="cookie-settings-title" className="text-lg font-semibold">
            {t('settingsTitle')}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-muted-foreground">{t('settingsIntro')}</p>

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

        <div className="flex flex-wrap gap-2 justify-end p-5 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSave({ functional: false, analytics: false, marketing: false })}
          >
            {t('essentialOnly')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSave({ functional, analytics, marketing })}
          >
            {t('savePreferences')}
          </Button>
          <Button
            variant="sage"
            size="sm"
            onClick={() => onSave({ functional: true, analytics: GA_ENABLED, marketing: false })}
          >
            {t('acceptAll')}
          </Button>
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
    <label className={`flex items-start gap-3 rounded-lg border border-border p-3 ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-muted/30'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-border text-sage-600 focus:ring-sage-600"
      />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </label>
  );
}
