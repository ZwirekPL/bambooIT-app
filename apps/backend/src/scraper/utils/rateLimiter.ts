/**
 * Per-domain polite rate limiter.
 *
 * Keeps one "next-allowed-at" timestamp per hostname. Any call to
 * `waitForSlot(host, minIntervalMs)` resolves after enough wall-clock time
 * has passed since the previous call on that host. Thread-safe under the
 * single-threaded Node.js event loop because timestamp updates are
 * synchronous.
 *
 * Usage:
 *   await waitForSlot('aniagotuje.pl', 1000); // politely wait 1s since last
 *   await fetch(...);
 */

const nextAllowedAt = new Map<string, number>();

/**
 * Wait until it's polite to hit `host` again, given at least `minIntervalMs`
 * between requests. Resolves immediately when the slot is already free.
 * Reserves the slot for the caller so concurrent callers queue up.
 */
export async function waitForSlot(host: string, minIntervalMs: number): Promise<void> {
  const now = Date.now();
  const earliest = nextAllowedAt.get(host) ?? 0;
  const wait = Math.max(0, earliest - now);

  // Reserve the slot for this request by pushing "next allowed" into the
  // future. Callers arriving during `wait` will queue behind us.
  const reservedAt = Math.max(now, earliest) + Math.max(0, minIntervalMs);
  nextAllowedAt.set(host, reservedAt);

  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

/**
 * Extract host from a URL. Falls back to a raw string when the URL is not
 * parseable so callers never crash on odd inputs.
 */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Visible for tests — reset all rate limiter state. */
export function _resetRateLimiter(): void {
  nextAllowedAt.clear();
}
