/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_EVENT,
  COOKIE_CONSENT_KEY,
  acceptAll,
  acceptEssentialOnly,
  getCookieConsent,
  parseCookieConsent,
  persistCookieConsent,
  resetCookieConsent,
} from '@/lib/cookie-consent';

function clearAllCookies() {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  });
}

describe('parseCookieConsent', () => {
  it('returns null for null input', () => {
    expect(parseCookieConsent(null)).toBeNull();
  });

  it('handles legacy "all" value', () => {
    const c = parseCookieConsent('all');
    expect(c).not.toBeNull();
    expect(c!.necessary).toBe(true);
    expect(c!.functional).toBe(true);
    expect(c!.analytics).toBe(true);
    expect(c!.marketing).toBe(false);
  });

  it('handles legacy "essential" value', () => {
    const c = parseCookieConsent('essential');
    expect(c).not.toBeNull();
    expect(c!.necessary).toBe(true);
    expect(c!.functional).toBe(false);
    expect(c!.analytics).toBe(false);
    expect(c!.marketing).toBe(false);
  });

  it('parses valid v1 JSON', () => {
    const json = JSON.stringify({
      v: 1,
      t: '2026-04-17T00:00:00Z',
      necessary: true,
      functional: true,
      analytics: true,
      marketing: false,
    });
    const c = parseCookieConsent(json);
    expect(c!.functional).toBe(true);
    expect(c!.analytics).toBe(true);
  });

  it('rejects unknown version', () => {
    const json = JSON.stringify({ v: 99, functional: true });
    expect(parseCookieConsent(json)).toBeNull();
  });

  it('rejects malformed JSON', () => {
    expect(parseCookieConsent('{not-json')).toBeNull();
  });

  it('forces necessary=true regardless of input', () => {
    const json = JSON.stringify({ v: 1, t: 'x', necessary: false, functional: true });
    const c = parseCookieConsent(json);
    expect(c!.necessary).toBe(true);
  });
});

describe('persistCookieConsent', () => {
  beforeEach(() => {
    clearAllCookies();
  });

  afterEach(() => {
    clearAllCookies();
  });

  it('writes cookie and returns consent object', () => {
    const c = persistCookieConsent({ functional: true, analytics: false, marketing: false });
    expect(c.functional).toBe(true);
    expect(c.analytics).toBe(false);
    expect(document.cookie).toContain(COOKIE_CONSENT_KEY);
  });

  it('getCookieConsent round-trips written value', () => {
    persistCookieConsent({ functional: false, analytics: true, marketing: false });
    const read = getCookieConsent();
    expect(read!.analytics).toBe(true);
    expect(read!.functional).toBe(false);
  });

  it('dispatches CONSENT_EVENT with new state', () => {
    const handler = vi.fn();
    window.addEventListener(CONSENT_EVENT, handler);
    persistCookieConsent({ functional: true, analytics: true, marketing: false });
    expect(handler).toHaveBeenCalledTimes(1);
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.analytics).toBe(true);
    window.removeEventListener(CONSENT_EVENT, handler);
  });
});

describe('acceptAll / acceptEssentialOnly', () => {
  beforeEach(() => clearAllCookies());

  it('acceptAll sets functional + analytics, not marketing', () => {
    const c = acceptAll();
    expect(c.functional).toBe(true);
    expect(c.analytics).toBe(true);
    expect(c.marketing).toBe(false);
  });

  it('acceptEssentialOnly leaves only necessary', () => {
    const c = acceptEssentialOnly();
    expect(c.necessary).toBe(true);
    expect(c.functional).toBe(false);
    expect(c.analytics).toBe(false);
  });
});

describe('resetCookieConsent', () => {
  it('clears cookie and dispatches null event', () => {
    persistCookieConsent({ functional: true, analytics: true, marketing: false });
    const handler = vi.fn();
    window.addEventListener(CONSENT_EVENT, handler);
    resetCookieConsent();
    expect(getCookieConsent()).toBeNull();
    expect(handler).toHaveBeenCalled();
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toBeNull();
    window.removeEventListener(CONSENT_EVENT, handler);
  });
});
