'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Catches errors in the root layout itself — runs OUTSIDE the next-intl
 * provider tree, so no i18n / no <Header /> available. Hard-codes Polish
 * copy (primary locale) with a minimal Neo-Swiss feel. Must include
 * <html> + <body> because it replaces the root layout entirely.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pl">
      <body
        style={{
          backgroundColor: '#f6f4ee',
          color: '#2C3E50',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: '640px', textAlign: 'center' }}>
          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontWeight: 900,
              fontSize: 'clamp(64px, 14vw, 144px)',
              lineHeight: 1,
              letterSpacing: '-0.05em',
              color: '#6FA336',
              margin: 0,
            }}
          >
            Błąd
          </p>
          <h1
            style={{
              fontFamily: 'Georgia, serif',
              fontWeight: 300,
              fontSize: 'clamp(28px, 4vw, 48px)',
              lineHeight: 1.1,
              color: '#1A2735',
              marginTop: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            Coś poszło naprawdę nie tak
          </h1>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.6,
              color: '#3D556E',
              marginBottom: '2rem',
            }}
          >
            Aplikacja napotkała krytyczny błąd. Zgłosiliśmy go automatycznie — zajmiemy się tym.
            Spróbuj odświeżyć stronę.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: 'rgba(61,85,110,0.6)',
                marginBottom: '2rem',
              }}
            >
              ID błędu: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              backgroundColor: '#8BC34A',
              color: '#1A2735',
              border: 'none',
              padding: '0.875rem 1.75rem',
              borderRadius: '999px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Spróbuj ponownie
          </button>
        </div>
      </body>
    </html>
  );
}
