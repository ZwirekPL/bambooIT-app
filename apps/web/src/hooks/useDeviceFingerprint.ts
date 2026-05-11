'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 39.2 — Device fingerprinting hook using FingerprintJS.
 * Generates a stable browser fingerprint (visitorId) on mount.
 * Returns null while loading, the visitorId string when ready.
 */
export function useDeviceFingerprint(): string | null {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    import('@fingerprintjs/fingerprintjs').then(async (FingerprintJS) => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setFingerprint(result.visitorId);
      } catch {
        // Non-critical: fingerprinting may fail in some browsers
      }
    }).catch(() => {
      // Module load failed
    });
  }, []);

  return fingerprint;
}
