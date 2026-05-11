/**
 * HTTP fetch wrapper with:
 *   - identifiable User-Agent
 *   - robots.txt compliance (per-host cache, 24h TTL)
 *   - per-domain rate limiting
 *   - exponential backoff retries (capped at 16s)
 */

import * as cheerio from 'cheerio';
import { getRobotsForHost, isAllowed, crawlDelayMs } from './robotsTxt';
import { waitForSlot, hostOf } from './rateLimiter';

/**
 * Identifiable bot UA. We don't impersonate Chrome — operators can block or
 * ask for exemption by email, and we follow robots.txt so nothing shady.
 * Change the contact info here if ownership changes.
 */
export const USER_AGENT =
  'DietetykBot/1.0 (+https://e-dietetyk.com/bot; recipe enrichment)';

/** Thrown when robots.txt explicitly disallows the target URL. */
export class RobotsDisallowedError extends Error {
  constructor(public readonly url: string) {
    super(`Disallowed by robots.txt: ${url}`);
    this.name = 'RobotsDisallowedError';
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FetchOpts {
  /** Minimum ms between requests to the same host. Defaults to 1000. */
  rateLimitMs?: number;
  /** Max retry attempts on retryable errors. */
  maxRetries?: number;
  /** Skip robots.txt check (only for sitemap fetches or explicit opt-out). */
  skipRobots?: boolean;
}

async function preflight(url: string, opts: FetchOpts): Promise<number> {
  const host = hostOf(url);
  const rateLimitMs = opts.rateLimitMs ?? 1000;

  if (!opts.skipRobots) {
    const rules = await getRobotsForHost(host, USER_AGENT);
    if (!isAllowed(rules, url, USER_AGENT)) {
      throw new RobotsDisallowedError(url);
    }
    // If robots.txt declares a longer crawl-delay, honor it.
    const robotsDelay = crawlDelayMs(rules, USER_AGENT);
    return Math.max(rateLimitMs, robotsDelay);
  }

  return rateLimitMs;
}

export async function fetchHtml(
  url: string,
  opts: FetchOpts = {},
): Promise<cheerio.CheerioAPI> {
  const effectiveRateLimit = await preflight(url, opts);
  const host = hostOf(url);
  const maxRetries = opts.maxRetries ?? 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = Math.min(1000 * Math.pow(2, attempt), 16000);
        console.log(`  [http] Retry ${attempt}/${maxRetries} after ${backoff}ms...`);
        await delay(backoff);
      }

      await waitForSlot(host, effectiveRateLimit);

      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (response.status === 429) {
        console.warn(`  [http] 429 Too Many Requests for ${url}`);
        lastError = new Error(`429 for ${url}`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      const html = await response.text();
      return cheerio.load(html);
    } catch (err) {
      // Don't retry on robots disallow — that's a deterministic rejection.
      if (err instanceof RobotsDisallowedError) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxRetries) break;
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchOpts = {},
): Promise<T> {
  const effectiveRateLimit = await preflight(url, opts);
  const host = hostOf(url);
  const maxRetries = opts.maxRetries ?? 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = Math.min(1000 * Math.pow(2, attempt), 16000);
        await delay(backoff);
      }

      await waitForSlot(host, effectiveRateLimit);

      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (response.status === 429) {
        lastError = new Error(`429 for ${url}`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof RobotsDisallowedError) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxRetries) break;
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}
