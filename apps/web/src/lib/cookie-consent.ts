/**
 * Cookie consent — single source of truth for RODO Phase 1.1.
 *
 * Storage format (cookie `cookie-consent`, URL-encoded JSON):
 *   {"v":1,"t":"2026-04-17T...","necessary":true,"functional":true,"analytics":false,"marketing":false}
 *
 * Legacy values accepted for backward compatibility:
 *   "all"       → necessary+functional+analytics ON, marketing OFF
 *   "essential" → only necessary ON
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

export const COOKIE_CONSENT_KEY = 'cookie-consent';
export const CONSENT_EVENT = 'cookie-consent-change';
const COOKIE_MAX_AGE_DAYS = 365;

export interface CookieConsent {
  v: 1;
  t: string;
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export type CookieCategory = 'functional' | 'analytics' | 'marketing';

const DEFAULT_ESSENTIAL: CookieConsent = {
  v: 1,
  t: '',
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};

const DEFAULT_ALL: CookieConsent = {
  v: 1,
  t: '',
  necessary: true,
  functional: true,
  analytics: true,
  marketing: false,
};

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  const value = match.substring(name.length + 1);
  return value ? decodeURIComponent(value) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

export function parseCookieConsent(raw: string | null): CookieConsent | null {
  if (!raw) return null;

  if (raw === 'all') return { ...DEFAULT_ALL, t: new Date(0).toISOString() };
  if (raw === 'essential') return { ...DEFAULT_ESSENTIAL, t: new Date(0).toISOString() };

  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (parsed.v !== 1) return null;
    return {
      v: 1,
      t: typeof parsed.t === 'string' ? parsed.t : new Date().toISOString(),
      necessary: true,
      functional: Boolean(parsed.functional),
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
    };
  } catch {
    return null;
  }
}

export function getCookieConsent(): CookieConsent | null {
  return parseCookieConsent(readCookie(COOKIE_CONSENT_KEY));
}

export function persistCookieConsent(
  preferences: Partial<Pick<CookieConsent, 'functional' | 'analytics' | 'marketing'>>,
): CookieConsent {
  const consent: CookieConsent = {
    v: 1,
    t: new Date().toISOString(),
    necessary: true,
    functional: Boolean(preferences.functional),
    analytics: Boolean(preferences.analytics),
    marketing: Boolean(preferences.marketing),
  };
  writeCookie(COOKIE_CONSENT_KEY, JSON.stringify(consent));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }));
  }
  void syncConsentToBackend(consent);
  return consent;
}

/**
 * Fire-and-forget sync of cookie preferences to the backend. Writes one
 * UserConsent row per granted category (and revokes ones the user turned
 * off). Silently ignored when the user is not logged in — the backend
 * returns 401 and we just drop it.
 */
function syncConsentToBackend(consent: CookieConsent): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return fetch('/api/proxy/profile/consents/cookies', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      functional: consent.functional,
      analytics: consent.analytics,
      marketing: consent.marketing,
      documentVersion: '1.0',
    }),
  })
    .then((res) => {
      if (!res.ok && res.status !== 401) {
        console.warn('[cookie-consent] backend sync returned', res.status);
      }
    })
    .catch((err) => {
      // Network failure / user offline — cookie is the source of truth for analytics gating,
      // so degraded sync is non-fatal.
      console.warn('[cookie-consent] backend sync failed:', err);
    });
}

export function resetCookieConsent() {
  clearCookie(COOKIE_CONSENT_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
  }
}

export function acceptAll(): CookieConsent {
  return persistCookieConsent({ functional: true, analytics: true, marketing: false });
}

export function acceptEssentialOnly(): CookieConsent {
  return persistCookieConsent({ functional: false, analytics: false, marketing: false });
}

export function useCookieConsent() {
  const [consent, setConsentState] = useState<CookieConsent | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConsentState(getCookieConsent());
    setHydrated(true);

    function onChange(event: Event) {
      const detail = (event as CustomEvent<CookieConsent | null>).detail ?? null;
      setConsentState(detail);
    }
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  const setConsent = useCallback(
    (prefs: Partial<Pick<CookieConsent, 'functional' | 'analytics' | 'marketing'>>) => {
      const next = persistCookieConsent(prefs);
      setConsentState(next);
      return next;
    },
    [],
  );

  const reset = useCallback(() => {
    resetCookieConsent();
    setConsentState(null);
  }, []);

  return { consent, hydrated, setConsent, reset };
}
