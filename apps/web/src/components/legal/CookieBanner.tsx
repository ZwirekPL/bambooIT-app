'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Cookie, X } from 'lucide-react';
import { CookieSettings } from './CookieSettings';
import {
  CONSENT_EVENT,
  acceptAll,
  acceptEssentialOnly,
  getCookieConsent,
  persistCookieConsent,
  type CookieConsent,
} from '@/lib/cookie-consent';

const SETTINGS_EVENT = 'open-cookie-settings';

export function CookieBanner() {
  const t = useTranslations('cookieBanner');
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [consent, setConsent] = useState<CookieConsent | null>(null);

  useEffect(() => {
    const current = getCookieConsent();
    setConsent(current);
    if (current === null) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    function onSettingsOpen() {
      setSettingsOpen(true);
    }
    function onConsentChange(event: Event) {
      const detail = (event as CustomEvent<CookieConsent | null>).detail ?? null;
      setConsent(detail);
      if (detail !== null) setVisible(false);
    }
    window.addEventListener(SETTINGS_EVENT, onSettingsOpen);
    window.addEventListener(CONSENT_EVENT, onConsentChange);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, onSettingsOpen);
      window.removeEventListener(CONSENT_EVENT, onConsentChange);
    };
  }, []);

  function handleAcceptAll() {
    acceptAll();
    setVisible(false);
  }

  function handleEssentialOnly() {
    acceptEssentialOnly();
    setVisible(false);
  }

  function handleSaveFromSettings(prefs: { functional: boolean; analytics: boolean; marketing: boolean }) {
    persistCookieConsent(prefs);
    setSettingsOpen(false);
    setVisible(false);
  }

  return (
    <>
      {visible && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
          <div className="mx-auto max-w-2xl rounded-2xl border border-line-strong bg-white/95 p-5 shadow-2xl backdrop-blur-md sm:p-6">
            <div className="flex items-start gap-3">
              <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-bamboo-deep" aria-hidden="true" />
              <div className="flex-1 space-y-3">
                <p className="text-sm leading-relaxed text-navy-soft">
                  {t('message')}{' '}
                  <Link
                    href="/dokumenty-prawne?tab=cookies"
                    className="text-bamboo-deep underline underline-offset-2 hover:text-navy"
                  >
                    {t('learnMore')}
                  </Link>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleAcceptAll}
                    className="inline-flex items-center rounded-full bg-bamboo px-5 py-2 text-sm font-semibold text-navy-deep transition-all hover:-translate-y-0.5 hover:bg-bamboo-deep"
                  >
                    {t('acceptAll')}
                  </button>
                  <button
                    type="button"
                    onClick={handleEssentialOnly}
                    className="inline-flex items-center rounded-full border border-line-strong bg-white px-5 py-2 text-sm font-medium text-navy transition-colors hover:border-navy-soft"
                  >
                    {t('essentialOnly')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-navy-soft transition-colors hover:text-navy"
                  >
                    {t('customize')}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={handleEssentialOnly}
                className="shrink-0 text-navy-soft transition-colors hover:text-navy"
                aria-label={t('close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      <CookieSettings
        open={settingsOpen}
        initial={consent}
        onSave={handleSaveFromSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

export function openCookieSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT));
}
