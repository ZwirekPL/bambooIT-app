'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
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
        <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6">
          <div className="mx-auto max-w-2xl rounded-xl border border-border bg-background/95 backdrop-blur-sm shadow-lg p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Cookie className="h-5 w-5 text-sage-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('message')}{' '}
                  <Link
                    href="/dokumenty-prawne?tab=cookies"
                    className="text-sage-600 hover:text-sage-700 underline underline-offset-2"
                  >
                    {t('learnMore')}
                  </Link>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="sage" size="sm" onClick={handleAcceptAll}>
                    {t('acceptAll')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleEssentialOnly}>
                    {t('essentialOnly')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
                    {t('customize')}
                  </Button>
                </div>
              </div>
              <button
                onClick={handleEssentialOnly}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
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
