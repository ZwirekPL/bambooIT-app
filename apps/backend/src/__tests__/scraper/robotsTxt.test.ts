import { describe, it, expect } from 'vitest';
import {
  parseRobotsTxt,
  isAllowed,
  crawlDelayMs,
  type RobotsRules,
} from '../../scraper/utils/robotsTxt';

const BOT = 'DietetykBot/1.0';

// ─── parseRobotsTxt ────────────────────────────────────────────────────────────

describe('parseRobotsTxt', () => {
  it('parses a simple allow/disallow block', () => {
    const text = `
User-agent: *
Disallow: /admin
Allow: /admin/public
Crawl-delay: 5
`;
    const r = parseRobotsTxt(text);
    expect(r.groups['*']).toBeDefined();
    expect(r.groups['*'].disallows).toEqual(['/admin']);
    expect(r.groups['*'].allows).toEqual(['/admin/public']);
    expect(r.groups['*'].crawlDelaySec).toBe(5);
  });

  it('supports multiple user-agents per block', () => {
    const text = `
User-agent: GoogleBot
User-agent: BingBot
Disallow: /secret

User-agent: *
Disallow: /ads
`;
    const r = parseRobotsTxt(text);
    expect(r.groups['googlebot'].disallows).toEqual(['/secret']);
    expect(r.groups['bingbot'].disallows).toEqual(['/secret']);
    expect(r.groups['*'].disallows).toEqual(['/ads']);
  });

  it('strips inline comments', () => {
    const text = `User-agent: * # any bot
Disallow: /x # keep out`;
    const r = parseRobotsTxt(text);
    expect(r.groups['*'].disallows).toEqual(['/x']);
  });

  it('handles CRLF line endings', () => {
    const text = 'User-agent: *\r\nDisallow: /foo\r\n';
    const r = parseRobotsTxt(text);
    expect(r.groups['*'].disallows).toEqual(['/foo']);
  });

  it('empty disallow is a non-rule (keeps array empty of real disallows)', () => {
    const text = `User-agent: *
Disallow:`;
    const r = parseRobotsTxt(text);
    // We store the empty "" but isAllowed ignores empty patterns.
    expect(r.groups['*'].disallows).toEqual(['']);
  });

  it('returns empty groups for empty input', () => {
    expect(parseRobotsTxt('')).toEqual({ groups: {} });
  });
});

// ─── isAllowed ─────────────────────────────────────────────────────────────────

describe('isAllowed', () => {
  it('allows everything when no matching group', () => {
    const rules: RobotsRules = { groups: {} };
    expect(isAllowed(rules, 'https://example.com/anything', BOT)).toBe(true);
  });

  it('disallows paths matched by wildcard agent', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow: /admin');
    expect(isAllowed(rules, 'https://example.com/admin/login', BOT)).toBe(false);
    expect(isAllowed(rules, 'https://example.com/public', BOT)).toBe(true);
  });

  it('allow beats disallow when more specific (longest match)', () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /admin
Allow: /admin/public
`);
    expect(isAllowed(rules, 'https://example.com/admin/secret', BOT)).toBe(false);
    expect(isAllowed(rules, 'https://example.com/admin/public/page', BOT)).toBe(true);
  });

  it('honors agent-specific rules over * fallback', () => {
    const rules = parseRobotsTxt(`
User-agent: DietetykBot
Disallow:

User-agent: *
Disallow: /
`);
    // DietetykBot explicitly allowed; * blocks everything
    expect(isAllowed(rules, 'https://example.com/x', 'DietetykBot/1.0')).toBe(true);
    expect(isAllowed(rules, 'https://example.com/x', 'RandomBot/2')).toBe(false);
  });

  it('supports * wildcard in patterns', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow: /*.pdf$');
    expect(isAllowed(rules, 'https://example.com/doc.pdf', BOT)).toBe(false);
    expect(isAllowed(rules, 'https://example.com/doc.pdfa', BOT)).toBe(true); // $ anchor
    expect(isAllowed(rules, 'https://example.com/page.html', BOT)).toBe(true);
  });

  it('treats "unavailable" robots as permissive', () => {
    const rules: RobotsRules = { groups: {}, unavailable: true };
    expect(isAllowed(rules, 'https://example.com/x', BOT)).toBe(true);
  });

  it('ignores empty Disallow (means "allow all")', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow:');
    expect(isAllowed(rules, 'https://example.com/admin', BOT)).toBe(true);
  });

  it('picks longest matching agent prefix', () => {
    const rules = parseRobotsTxt(`
User-agent: Dietetyk
Disallow: /a

User-agent: DietetykBot
Disallow: /b
`);
    // longer prefix "dietetykbot" wins
    expect(isAllowed(rules, 'https://example.com/a', 'DietetykBot/1.0')).toBe(true);
    expect(isAllowed(rules, 'https://example.com/b', 'DietetykBot/1.0')).toBe(false);
  });
});

// ─── crawlDelayMs ──────────────────────────────────────────────────────────────

describe('crawlDelayMs', () => {
  it('returns 0 when no crawl-delay declared', () => {
    expect(crawlDelayMs(parseRobotsTxt('User-agent: *\nDisallow: /x'), BOT)).toBe(0);
  });

  it('returns declared value in ms for * group', () => {
    expect(crawlDelayMs(parseRobotsTxt('User-agent: *\nCrawl-delay: 2'), BOT)).toBe(2000);
  });

  it('returns declared value for specific agent group', () => {
    const rules = parseRobotsTxt(`
User-agent: DietetykBot
Crawl-delay: 3
`);
    expect(crawlDelayMs(rules, 'DietetykBot/1.0')).toBe(3000);
  });

  it('returns 0 when rules marked unavailable', () => {
    const rules: RobotsRules = { groups: {}, unavailable: true };
    expect(crawlDelayMs(rules, BOT)).toBe(0);
  });
});
