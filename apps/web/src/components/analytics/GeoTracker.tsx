'use client';

import { useEffect } from 'react';
import { getCookieConsent } from '@/lib/cookie-consent';

/**
 * Tracks visits referred from AI chatbots (ChatGPT, Claude, Perplexity, Gemini, Bing Copilot).
 * Sends a custom GA4 event `ai_referral` with the source name — only when the
 * user has granted analytics consent (RODO Phase 1.1).
 */

const AI_REFERRERS: Record<string, string> = {
  'chat.openai.com': 'chatgpt',
  'chatgpt.com': 'chatgpt',
  'claude.ai': 'claude',
  'perplexity.ai': 'perplexity',
  'gemini.google.com': 'gemini',
  'copilot.microsoft.com': 'bing_copilot',
  'bing.com/chat': 'bing_copilot',
};

function detectAiReferrer(): string | null {
  if (typeof window === 'undefined') return null;

  const referrer = document.referrer;
  if (!referrer) return null;

  for (const [domain, source] of Object.entries(AI_REFERRERS)) {
    if (referrer.includes(domain)) return source;
  }
  return null;
}

export function GeoTracker() {
  useEffect(() => {
    const consent = getCookieConsent();
    if (!consent?.analytics) return;

    const source = detectAiReferrer();
    if (!source) return;

    if (typeof window !== 'undefined' && 'gtag' in window) {
      const gtag = (window as Record<string, (...args: unknown[]) => void>).gtag;
      gtag('event', 'ai_referral', {
        ai_source: source,
        landing_page: window.location.pathname,
      });
    }
  }, []);

  return null;
}
