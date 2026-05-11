'use client';

import { useEffect, useRef } from 'react';
import { CONSENT_EVENT, getCookieConsent } from '@/lib/cookie-consent';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

function loadGtag(gaId: string) {
  if (typeof window === 'undefined') return;
  if (document.getElementById('ga-script')) return;

  const script = document.createElement('script');
  script.id = 'ga-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script);

  const init = document.createElement('script');
  init.id = 'ga-init';
  init.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true});`;
  document.head.appendChild(init);
}

/**
 * Loads Google Analytics 4 only after the user grants analytics consent via
 * the cookie banner. Listens for consent changes so GA can be enabled at
 * runtime without a full page reload.
 *
 * Revocation: once GA is loaded on a page, disabling the consent cookie does
 * not unload already-executed scripts — it takes effect on the next page load.
 * Cookies set by GA persist in the browser until the user clears them or they
 * expire naturally (GA defaults to 14 months).
 */
export function GoogleAnalytics() {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!GA_ID) return;

    function maybeLoad() {
      const consent = getCookieConsent();
      if (consent?.analytics && !loadedRef.current) {
        loadedRef.current = true;
        loadGtag(GA_ID as string);
      }
    }

    maybeLoad();
    window.addEventListener(CONSENT_EVENT, maybeLoad);
    return () => window.removeEventListener(CONSENT_EVENT, maybeLoad);
  }, []);

  return null;
}
