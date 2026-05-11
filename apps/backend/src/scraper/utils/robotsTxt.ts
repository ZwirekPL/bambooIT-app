/**
 * Minimal RFC 9309 / Google-style robots.txt parser + in-memory cache.
 *
 * Parses just enough to answer:
 *   - isAllowed(url, userAgent)  — can we fetch this path?
 *   - crawlDelayMs(userAgent)    — how long between requests per this agent?
 *
 * Design notes:
 *  - We don't pull in a dependency (robots-parser) — the spec we care about
 *    is a small subset (User-agent, Allow, Disallow, Crawl-delay). Roughly
 *    50 lines of logic.
 *  - Longest-match-wins for Allow vs Disallow (Google / Bing behaviour).
 *  - A missing or erroring robots.txt → allow everything, zero crawl delay.
 *    We log the fetch error so the caller can see it.
 */

export interface RobotsRules {
  /**
   * Rules per user-agent group. Keys are lower-case agent strings;
   * always includes a '*' fallback if the file declared one.
   */
  groups: Record<string, { allows: string[]; disallows: string[]; crawlDelaySec?: number }>;
  /** Source URL of the robots.txt file that produced these rules. */
  sourceUrl?: string;
  /** True when robots.txt couldn't be fetched — treated as permissive. */
  unavailable?: boolean;
}

// ─── Parse ─────────────────────────────────────────────────────────────────────

/**
 * Parse robots.txt text into per-agent rules.
 * Handles CRLF, inline comments (`# ...`) and multiple agents in a block.
 */
export function parseRobotsTxt(text: string): RobotsRules {
  const lines = text.split(/\r?\n/);
  const groups: RobotsRules['groups'] = {};
  let currentAgents: string[] = [];
  let isNewBlock = true;

  for (const rawLine of lines) {
    // Strip inline comments
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) {
      // Blank line ends a group block
      isNewBlock = true;
      continue;
    }

    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === 'user-agent') {
      if (isNewBlock) {
        currentAgents = [];
        isNewBlock = false;
      }
      const agent = value.toLowerCase();
      currentAgents.push(agent);
      if (!groups[agent]) groups[agent] = { allows: [], disallows: [] };
      continue;
    }

    // Any directive other than user-agent belongs to the open block.
    isNewBlock = false;
    for (const agent of currentAgents) {
      if (!groups[agent]) groups[agent] = { allows: [], disallows: [] };
      const g = groups[agent];
      if (field === 'allow') g.allows.push(value);
      else if (field === 'disallow') g.disallows.push(value);
      else if (field === 'crawl-delay') {
        const sec = parseFloat(value);
        if (Number.isFinite(sec) && sec > 0) g.crawlDelaySec = sec;
      }
    }
  }

  return { groups };
}

// ─── Rule matching ─────────────────────────────────────────────────────────────

/**
 * Convert a robots.txt path pattern to a regex. Supports Google's extensions:
 *   *  – wildcard (matches anything incl. empty)
 *   $  – end-of-string anchor (only at very end)
 */
function patternToRegex(pattern: string): RegExp {
  // Escape regex special chars except * and $
  const escaped = pattern.replace(/[.+?^=!:{}()|[\]\\\/]/g, '\\$&');
  let regexSource = escaped.replace(/\*/g, '.*');
  if (regexSource.endsWith('\\$')) {
    regexSource = regexSource.slice(0, -2) + '$';
  }
  return new RegExp('^' + regexSource);
}

function groupForAgent(rules: RobotsRules, userAgent: string): RobotsRules['groups'][string] | null {
  const lower = userAgent.toLowerCase();
  // Prefer longest agent-prefix match; fall back to '*'
  let best: { key: string; score: number } | null = null;
  for (const key of Object.keys(rules.groups)) {
    if (key === '*') continue;
    // agent matches if lowercase UA contains the declared agent
    if (lower.includes(key) && (best == null || key.length > best.score)) {
      best = { key, score: key.length };
    }
  }
  if (best) return rules.groups[best.key];
  return rules.groups['*'] ?? null;
}

/**
 * Check whether `url` is allowed for the given user agent per `rules`.
 * When no matching group is found, defaults to allowed.
 */
export function isAllowed(rules: RobotsRules, url: string, userAgent: string): boolean {
  if (rules.unavailable) return true;
  const group = groupForAgent(rules, userAgent);
  if (!group) return true;

  const path = safePath(url);
  let matchedAllow = { pattern: '', len: -1 };
  let matchedDisallow = { pattern: '', len: -1 };

  for (const pattern of group.allows) {
    if (pattern === '') continue;
    if (patternToRegex(pattern).test(path) && pattern.length > matchedAllow.len) {
      matchedAllow = { pattern, len: pattern.length };
    }
  }
  for (const pattern of group.disallows) {
    // Empty Disallow means "allow all"
    if (pattern === '') continue;
    if (patternToRegex(pattern).test(path) && pattern.length > matchedDisallow.len) {
      matchedDisallow = { pattern, len: pattern.length };
    }
  }

  // Longest match wins; ties go to Allow (Google behaviour).
  if (matchedDisallow.len === -1) return true;
  if (matchedAllow.len >= matchedDisallow.len) return true;
  return false;
}

/**
 * Return the crawl-delay (in ms) the group declares, or 0 if none.
 */
export function crawlDelayMs(rules: RobotsRules, userAgent: string): number {
  if (rules.unavailable) return 0;
  const group = groupForAgent(rules, userAgent);
  if (!group || group.crawlDelaySec == null) return 0;
  return Math.round(group.crawlDelaySec * 1000);
}

function safePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || '');
  } catch {
    return url.startsWith('/') ? url : `/${url}`;
  }
}

// ─── Fetch + cache ─────────────────────────────────────────────────────────────

const cache = new Map<string, { rules: RobotsRules; fetchedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Returns RobotsRules for a given host. Fetches `https://host/robots.txt` once
 * per process (cached 24h). On failure returns `unavailable: true` so the
 * caller treats everything as allowed.
 */
export async function getRobotsForHost(host: string, userAgent: string): Promise<RobotsRules> {
  const cached = cache.get(host);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.rules;

  const url = `https://${host}/robots.txt`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent, Accept: 'text/plain' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const unavailable: RobotsRules = { groups: {}, sourceUrl: url, unavailable: true };
      cache.set(host, { rules: unavailable, fetchedAt: Date.now() });
      return unavailable;
    }
    const text = await res.text();
    const rules = parseRobotsTxt(text);
    rules.sourceUrl = url;
    cache.set(host, { rules, fetchedAt: Date.now() });
    return rules;
  } catch {
    const unavailable: RobotsRules = { groups: {}, sourceUrl: url, unavailable: true };
    cache.set(host, { rules: unavailable, fetchedAt: Date.now() });
    return unavailable;
  }
}

/** Visible for tests — clear the in-memory cache. */
export function _clearRobotsCache(): void {
  cache.clear();
}
