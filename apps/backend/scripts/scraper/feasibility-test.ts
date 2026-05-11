/**
 * A: S-4 Feasibility test — evaluate 15 candidate Polish recipe domains
 * before committing to writing scrapers for them.
 *
 * For each candidate:
 *   1. Discover ~5 recipe URLs via sitemap.xml / wp-sitemap.xml / homepage links.
 *   2. Fetch each via existing scraper/utils/http.ts (robots.txt + rate limit).
 *   3. Try JSON-LD parse via scraper/utils/jsonLd.ts (S-2 module).
 *   4. Fall back to microdata (itemprop=...) for older blogs.
 *   5. Compute coverage matrix + feasibility score (0-100).
 *   6. Decision: GO ≥80, RESERVE 60-79, SKIP <60.
 *
 * Writes:
 *   - apps/backend/scripts/scraper/feasibility-report-<date>.json
 *   - Console: per-domain summary table + final decisions
 *
 * Honors robots.txt and crawl-delay via fetchHtml(). No DB writes.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { fetchHtml, RobotsDisallowedError, USER_AGENT } from '../../src/scraper/utils/http';
import {
  extractAndParseRecipe,
  parseIsoDuration,
  parseYield,
  type ParsedRecipeJsonLd,
} from '../../src/scraper/utils/jsonLd';

// ─── Candidate config ──────────────────────────────────────────────────────────

interface DomainCfg {
  name: string;
  homepage: string;
  sitemaps?: string[];
  recipePathPatterns: string[];
  sampleUrls?: string[];
  tier: 'S' | 'A' | 'B';
}

const CANDIDATES: DomainCfg[] = [
  // Tier S — dietitian-run blogs
  { name: 'dietetykpowszechny.pl', homepage: 'https://dietetykpowszechny.pl', sitemaps: ['https://dietetykpowszechny.pl/sitemap.xml', 'https://dietetykpowszechny.pl/wp-sitemap.xml'], recipePathPatterns: ['/przepis'], tier: 'S' },
  { name: 'ania-mielcarek.pl', homepage: 'https://ania-mielcarek.pl', sitemaps: ['https://ania-mielcarek.pl/sitemap.xml', 'https://ania-mielcarek.pl/wp-sitemap.xml', 'https://ania-mielcarek.pl/sitemap_index.xml'], recipePathPatterns: ['/przepis'], tier: 'S' },
  { name: 'eatthis.pl', homepage: 'https://eatthis.pl', sitemaps: ['https://eatthis.pl/sitemap.xml', 'https://eatthis.pl/wp-sitemap.xml'], recipePathPatterns: ['/przepis', '/recipe'], tier: 'S' },
  { name: 'dietoteka.pl', homepage: 'https://dietoteka.pl', sitemaps: ['https://dietoteka.pl/sitemap.xml', 'https://dietoteka.pl/wp-sitemap.xml'], recipePathPatterns: ['/przepis'], tier: 'S' },
  { name: 'nutrilifestyle.pl', homepage: 'https://nutrilifestyle.pl', sitemaps: ['https://nutrilifestyle.pl/sitemap.xml', 'https://nutrilifestyle.pl/wp-sitemap.xml'], recipePathPatterns: ['/przepis'], tier: 'S' },
  { name: 'magdakraszewska.com', homepage: 'https://magdakraszewska.com', sitemaps: ['https://magdakraszewska.com/sitemap.xml', 'https://magdakraszewska.com/wp-sitemap.xml'], recipePathPatterns: ['/przepis'], tier: 'S' },
  { name: 'fitnessdietaizycie.pl', homepage: 'https://fitnessdietaizycie.pl', sitemaps: ['https://fitnessdietaizycie.pl/sitemap.xml', 'https://fitnessdietaizycie.pl/wp-sitemap.xml'], recipePathPatterns: ['/przepis'], tier: 'S' },
  { name: 'justzdrowo.pl', homepage: 'https://justzdrowo.pl', sitemaps: ['https://justzdrowo.pl/sitemap.xml', 'https://justzdrowo.pl/wp-sitemap.xml'], recipePathPatterns: ['/przepis'], tier: 'S' },
  // Tier A — commercial volume, JSON-LD common
  { name: 'doradcasmaku.pl', homepage: 'https://www.doradcasmaku.pl', sitemaps: ['https://www.doradcasmaku.pl/sitemap.xml'], recipePathPatterns: ['/przepis'], tier: 'A' },
  { name: 'mojegotowanie.pl', homepage: 'https://www.mojegotowanie.pl', sitemaps: ['https://www.mojegotowanie.pl/sitemap.xml'], recipePathPatterns: ['/przepis'], tier: 'A' },
  { name: 'kuchnialidla.pl', homepage: 'https://kuchnialidla.pl', sitemaps: ['https://kuchnialidla.pl/sitemap.xml'], recipePathPatterns: ['/przepis'], tier: 'A' },
  { name: 'hellofresh.pl', homepage: 'https://www.hellofresh.pl', sitemaps: ['https://www.hellofresh.pl/sitemap.xml'], recipePathPatterns: ['/przepis', '/recipe'], tier: 'A' },
  { name: 'bonduelle.pl', homepage: 'https://www.bonduelle.pl', sitemaps: ['https://www.bonduelle.pl/sitemap.xml'], recipePathPatterns: ['/przepis'], tier: 'A' },
  { name: 'przepisy.pl', homepage: 'https://www.przepisy.pl', sitemaps: ['https://www.przepisy.pl/sitemap.xml'], recipePathPatterns: ['/przepis'], tier: 'A' },
  // Tier B — vegan gap (LEGUME 28)
  { name: 'wegepedia.pl', homepage: 'https://wegepedia.pl', sitemaps: ['https://wegepedia.pl/sitemap.xml', 'https://wegepedia.pl/wp-sitemap.xml', 'https://wegepedia.pl/post-sitemap.xml'], recipePathPatterns: ['/przepis'], tier: 'B' },
];

const SAMPLES_PER_DOMAIN = 5;
const REQUEST_RATE_MS = 1500;

// ─── URL discovery ─────────────────────────────────────────────────────────────

function extractLocsFromSitemap(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].trim());
  }
  return locs;
}

async function fetchSitemapXml(url: string): Promise<string | null> {
  try {
    const $ = await fetchHtml(url, { rateLimitMs: REQUEST_RATE_MS, skipRobots: true, maxRetries: 1 });
    return $.html();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Surface for diagnostic purposes
    console.log(`    sitemap miss: ${url} (${msg.slice(0, 80)})`);
    return null;
  }
}

/**
 * A recipe URL has more than just `/przepis` in its path — typically a slug
 * with 2+ dashes. Listing pages like `/przepisy/`, `/przepisy/sniadania/` get
 * filtered out so we don't score nav pages instead of recipes.
 */
function looksLikeRecipeUrl(url: string, patterns: string[]): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  const path = u.pathname.toLowerCase().replace(/\/+$/, '');
  if (!patterns.some((p) => path.includes(p))) return false;
  // Path should have a slug-like segment after the recipe pattern
  const lastSeg = path.split('/').pop() ?? '';
  // Strip pattern prefix (e.g. "przepis-na-X" → look at "X")
  const slug = lastSeg.replace(/^przepis(-na)?-?/, '').replace(/^recipe-?/, '');
  return slug.length >= 4 && slug.includes('-');
}

async function discoverSampleUrls(cfg: DomainCfg): Promise<{ urls: string[]; method: string; sitemapHits: number }> {
  // Common WordPress / SEO plugin sitemap patterns.
  const wpPatterns = [
    '/post-sitemap.xml', '/post_sitemap.xml',
    '/recipes-sitemap.xml', '/recipe-sitemap.xml',
    '/przepisy-sitemap.xml',
  ];
  const homepageBase = new URL(cfg.homepage).origin;
  const allSitemaps = [...(cfg.sitemaps ?? []), ...wpPatterns.map((p) => homepageBase + p)];

  // 1. Try sitemaps in order; recurse into sitemap_index if needed.
  for (const sm of allSitemaps) {
    const xml = await fetchSitemapXml(sm);
    if (!xml) continue;
    const locs = extractLocsFromSitemap(xml);
    if (locs.length === 0) continue;

    const subSitemaps = locs.filter((u) => /sitemap.*\.xml/i.test(u) && !cfg.sitemaps?.includes(u));
    let pool = locs.filter((u) => !subSitemaps.includes(u));

    if (pool.length < SAMPLES_PER_DOMAIN && subSitemaps.length > 0) {
      for (const sub of subSitemaps.slice(0, 3)) {
        const subXml = await fetchSitemapXml(sub);
        if (subXml) pool.push(...extractLocsFromSitemap(subXml));
        if (pool.length >= 100) break;
      }
    }

    const recipeMatches = pool.filter((u) => looksLikeRecipeUrl(u, cfg.recipePathPatterns));

    if (recipeMatches.length >= SAMPLES_PER_DOMAIN) {
      const stride = Math.max(1, Math.floor(recipeMatches.length / SAMPLES_PER_DOMAIN));
      const picked: string[] = [];
      for (let i = 0; i < SAMPLES_PER_DOMAIN; i++) {
        picked.push(recipeMatches[Math.min(recipeMatches.length - 1, i * stride)]);
      }
      return { urls: picked, method: `sitemap:${sm}`, sitemapHits: recipeMatches.length };
    }
  }

  // 2. Homepage link discovery
  try {
    const $ = await fetchHtml(cfg.homepage, { rateLimitMs: REQUEST_RATE_MS, maxRetries: 1 });
    const hrefs = new Set<string>();
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const abs = href.startsWith('http')
        ? href
        : href.startsWith('/')
          ? new URL(href, cfg.homepage).toString()
          : null;
      if (!abs) return;
      if (looksLikeRecipeUrl(abs, cfg.recipePathPatterns)) hrefs.add(abs);
    });
    const urls = [...hrefs].slice(0, SAMPLES_PER_DOMAIN);
    if (urls.length > 0) return { urls, method: 'homepage-scrape', sitemapHits: 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`    homepage fetch failed: ${msg.slice(0, 100)}`);
  }

  if (cfg.sampleUrls && cfg.sampleUrls.length > 0) {
    return { urls: cfg.sampleUrls, method: 'manual-fallback', sitemapHits: 0 };
  }

  return { urls: [], method: 'none', sitemapHits: 0 };
}

// ─── Microdata fallback ────────────────────────────────────────────────────────

function parseMicrodata($: cheerio.CheerioAPI): Partial<ParsedRecipeJsonLd> {
  const recipeRoot = $('[itemtype*="schema.org/Recipe"]').first();
  if (recipeRoot.length === 0) return {};

  const t = (sel: string) => {
    const el = recipeRoot.find(`[itemprop="${sel}"]`).first();
    if (el.length === 0) return undefined;
    const c = el.attr('content') ?? el.attr('datetime') ?? el.attr('href') ?? el.text();
    return c?.trim() || undefined;
  };
  const all = (sel: string): string[] => {
    return recipeRoot.find(`[itemprop="${sel}"]`)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
  };

  const result: Partial<ParsedRecipeJsonLd> = {
    title: t('name'),
    description: t('description'),
    rawIngredients: all('recipeIngredient').length ? all('recipeIngredient') : all('ingredients'),
    steps: all('recipeInstructions'),
    prepTimeMinutes: parseIsoDuration(t('prepTime')),
    cookTimeMinutes: parseIsoDuration(t('cookTime')),
    totalTimeMinutes: parseIsoDuration(t('totalTime')),
    servings: parseYield(t('recipeYield')),
    imageUrl: t('image'),
    tags: [],
  };

  const nut = recipeRoot.find('[itemtype*="NutritionInformation"]').first();
  if (nut.length > 0) {
    const nutVal = (sel: string): number | undefined => {
      const e = nut.find(`[itemprop="${sel}"]`).first();
      const c = e.attr('content') ?? e.text();
      if (!c) return undefined;
      const m = c.match(/(\d+(?:[.,]\d+)?)/);
      return m ? Number(m[1].replace(',', '.')) : undefined;
    };
    const calories = nutVal('calories');
    const protein = nutVal('proteinContent');
    const fat = nutVal('fatContent');
    const carbs = nutVal('carbohydrateContent');
    if (calories || protein || fat || carbs) {
      result.nutrition = { calories, protein, fat, carbs };
    }
  }

  return result;
}

// ─── Coverage check + scoring ──────────────────────────────────────────────────

interface UrlCheck {
  url: string;
  fetchOk: boolean;
  jsonLdFound: boolean;
  microdataFound: boolean;
  parser: 'jsonLd' | 'microdata' | 'none';
  fields: {
    title: boolean;
    ingredients: number;
    steps: number;
    kcal: number | null;
    protein: number | null;
    prepTime: number | null;
    cookTime: number | null;
    servings: number | null;
    imageUrl: boolean;
    description: boolean;
    tags: number;
  };
  score: number;
  error?: string;
}

function computeScore(c: UrlCheck['fields'], jsonLdFound: boolean): number {
  let s = 0;
  if (c.title) s += 5;
  if (c.ingredients >= 3) s += 15;
  if (c.steps >= 2) s += 15;
  if (c.kcal != null && c.kcal > 0) s += 15;
  if (c.protein != null && c.protein > 0) s += 5;
  if (c.prepTime != null || c.cookTime != null) s += 10;
  if (c.servings != null && c.servings > 0) s += 10;
  if (c.imageUrl) s += 5;
  if (c.description) s += 5;
  if (c.tags >= 2) s += 5;
  if (jsonLdFound) s += 10;
  return s;
}

async function checkUrl(url: string): Promise<UrlCheck> {
  try {
    const $ = await fetchHtml(url, { rateLimitMs: REQUEST_RATE_MS });

    let parsed: Partial<ParsedRecipeJsonLd> | null = extractAndParseRecipe($);
    let parser: UrlCheck['parser'] = parsed ? 'jsonLd' : 'none';
    const jsonLdFound = parser === 'jsonLd';
    let microdataFound = false;

    if (!parsed) {
      const md = parseMicrodata($);
      if (md.title || (md.rawIngredients && md.rawIngredients.length > 0)) {
        parsed = md;
        parser = 'microdata';
        microdataFound = true;
      }
    }

    if (!parsed) {
      return {
        url, fetchOk: true, jsonLdFound: false, microdataFound: false, parser: 'none',
        fields: {
          title: false, ingredients: 0, steps: 0, kcal: null, protein: null,
          prepTime: null, cookTime: null, servings: null, imageUrl: false,
          description: false, tags: 0,
        },
        score: 0,
      };
    }

    const fields = {
      title: !!parsed.title,
      ingredients: parsed.rawIngredients?.length ?? 0,
      steps: parsed.steps?.length ?? 0,
      kcal: parsed.nutrition?.calories ?? null,
      protein: parsed.nutrition?.protein ?? null,
      prepTime: parsed.prepTimeMinutes ?? null,
      cookTime: parsed.cookTimeMinutes ?? null,
      servings: parsed.servings ?? null,
      imageUrl: !!parsed.imageUrl,
      description: !!parsed.description,
      tags: parsed.tags?.length ?? 0,
    };

    return {
      url, fetchOk: true, jsonLdFound, microdataFound, parser,
      fields, score: computeScore(fields, jsonLdFound),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const robots = err instanceof RobotsDisallowedError;
    return {
      url, fetchOk: false, jsonLdFound: false, microdataFound: false, parser: 'none',
      fields: {
        title: false, ingredients: 0, steps: 0, kcal: null, protein: null,
        prepTime: null, cookTime: null, servings: null, imageUrl: false,
        description: false, tags: 0,
      },
      score: 0,
      error: robots ? 'ROBOTS_DISALLOWED' : msg,
    };
  }
}

interface DomainReport {
  name: string;
  tier: string;
  discovery: { method: string; sitemapHits: number; urlsFound: number };
  checks: UrlCheck[];
  avgScore: number;
  jsonLdRate: number;
  microdataRate: number;
  decision: 'GO' | 'RESERVE' | 'SKIP';
  decisionReason: string;
}

function decide(score: number, urlsFound: number, errors: number): { decision: DomainReport['decision']; reason: string } {
  if (urlsFound === 0) return { decision: 'SKIP', reason: 'no recipe URLs discoverable' };
  if (errors === urlsFound) return { decision: 'SKIP', reason: 'all sample fetches failed' };
  if (score >= 80) return { decision: 'GO', reason: `avg score ${score.toFixed(0)} ≥ 80` };
  if (score >= 60) return { decision: 'RESERVE', reason: `avg score ${score.toFixed(0)} (60-79)` };
  return { decision: 'SKIP', reason: `avg score ${score.toFixed(0)} < 60` };
}

async function runDomain(cfg: DomainCfg): Promise<DomainReport> {
  console.log(`\n[${cfg.tier}] ${cfg.name}`);
  const discovery = await discoverSampleUrls(cfg);
  console.log(`  discovered ${discovery.urls.length} URLs via ${discovery.method} (sitemap hits: ${discovery.sitemapHits})`);

  const checks: UrlCheck[] = [];
  for (const url of discovery.urls) {
    const c = await checkUrl(url);
    checks.push(c);
    const status = c.fetchOk ? (c.parser === 'jsonLd' ? 'JSON-LD' : c.parser === 'microdata' ? 'microdata' : 'no-recipe') : 'FAIL';
    console.log(`    ${String(c.score).padStart(3)} [${status.padEnd(9)}] ${c.error ? '⚠ ' + c.error.slice(0, 60) : ''}  ${url.slice(0, 80)}`);
  }

  const ok = checks.filter((c) => c.fetchOk && c.parser !== 'none');
  const avgScore = ok.length > 0 ? ok.reduce((s, c) => s + c.score, 0) / ok.length : 0;
  const jsonLdRate = checks.length ? checks.filter((c) => c.jsonLdFound).length / checks.length : 0;
  const microdataRate = checks.length ? checks.filter((c) => c.microdataFound).length / checks.length : 0;
  const errors = checks.filter((c) => !c.fetchOk).length;
  const { decision, reason } = decide(avgScore, discovery.urls.length, errors);

  console.log(`  avg score: ${avgScore.toFixed(1)} | JSON-LD: ${(jsonLdRate * 100).toFixed(0)}% | microdata: ${(microdataRate * 100).toFixed(0)}% | decision: ${decision} (${reason})`);

  return {
    name: cfg.name,
    tier: cfg.tier,
    discovery: { method: discovery.method, sitemapHits: discovery.sitemapHits, urlsFound: discovery.urls.length },
    checks,
    avgScore,
    jsonLdRate,
    microdataRate,
    decision,
    decisionReason: reason,
  };
}

async function main() {
  console.log('=== S-4 Feasibility Test ===');
  console.log(`Candidates: ${CANDIDATES.length}`);
  console.log(`Samples per domain: ${SAMPLES_PER_DOMAIN}`);
  console.log(`User-Agent: ${USER_AGENT}`);

  const reports: DomainReport[] = [];
  for (const cfg of CANDIDATES) {
    try {
      reports.push(await runDomain(cfg));
    } catch (err) {
      console.error(`  [${cfg.name}] runner crashed:`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\n\n=== SUMMARY ===');
  console.log('Tier  Domain                          Score   JSON-LD  μdata   Decision   Reason');
  console.log('────────────────────────────────────────────────────────────────────────────────');
  for (const r of reports) {
    console.log(
      `[${r.tier}]   ${r.name.padEnd(28)}  ${r.avgScore.toFixed(0).padStart(5)}   ` +
      `${(r.jsonLdRate * 100).toFixed(0).padStart(4)}%   ${(r.microdataRate * 100).toFixed(0).padStart(4)}%   ` +
      `${r.decision.padEnd(8)}   ${r.decisionReason}`,
    );
  }

  const go = reports.filter((r) => r.decision === 'GO');
  const reserve = reports.filter((r) => r.decision === 'RESERVE');
  const skip = reports.filter((r) => r.decision === 'SKIP');
  console.log(`\n  GO:      ${go.length}  ${go.map((r) => r.name).join(', ')}`);
  console.log(`  RESERVE: ${reserve.length}  ${reserve.map((r) => r.name).join(', ')}`);
  console.log(`  SKIP:    ${skip.length}  ${skip.map((r) => r.name).join(', ')}`);

  const reportPath = path.resolve(__dirname, `feasibility-report-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ runAt: new Date().toISOString(), reports }, null, 2));
  console.log(`\n  Full report: ${reportPath}`);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
