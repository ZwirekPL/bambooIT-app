/**
 * S-2 smoke test: run the unified JSON-LD parser against REAL URLs from DB
 * (the 4 existing scraped domains) and report per-field coverage.
 *
 * Confirms regression safety: whatever data we previously relied on per-domain
 * is still extracted by the shared parser.
 *
 * Usage:
 *   npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/smoke-test-jsonld.ts
 *
 * Network-bound — needs internet. Errors per-URL do not stop the run.
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';
import { prisma } from '@db';
import { extractAndParseRecipe, type ParsedRecipeJsonLd } from '../src/scraper/utils/jsonLd';

const URLS_PER_DOMAIN = 3;

const DOMAIN_NEEDLES: Record<string, string> = {
  aniagotuje: 'aniagotuje.pl',
  kwestiasmaku: 'kwestiasmaku.com',
  jadlonomia: 'jadlonomia.com',
  paleosmak: 'paleosmak.pl',
  dietetykpowszechny: 'dietetykpowszechny.pl',
};

// Verified live URLs from candidate domains (S-4 targets).
// Add more as we pre-validate URLs manually.
const CANDIDATE_URLS: Array<{ domain: string; url: string }> = [
  { domain: 'mojegotowanie.pl', url: 'https://www.mojegotowanie.pl/przepis/muffinki-jajeczne' },
];

async function sampleUrls(): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [domain, needle] of Object.entries(DOMAIN_NEEDLES)) {
    const recipes = await prisma.recipe.findMany({
      where: { sourceUrl: { contains: needle } },
      select: { sourceUrl: true },
      take: URLS_PER_DOMAIN * 3, // buffer in case some URLs are dead
    });
    out[domain] = recipes
      .map((r) => r.sourceUrl)
      .filter((u): u is string => typeof u === 'string');
  }
  return out;
}

interface ProbeResult {
  url: string;
  status: 'ok' | 'jsonld-no-recipe' | 'no-jsonld' | 'fetch-error';
  hasMicrodata: boolean;
  parsed?: ParsedRecipeJsonLd;
  error?: string;
}

async function probe(url: string): Promise<ProbeResult> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DietetykBot/1.0; recipe-enrichment)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { url, status: 'fetch-error', hasMicrodata: false, error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    // Separately detect:
    //   1. presence of *any* JSON-LD scripts
    //   2. presence of microdata `itemtype="*schema.org/Recipe"`
    const jsonLdScripts = $('script[type="application/ld+json"]').length;
    const hasMicrodata = $('[itemtype*="schema.org/Recipe"]').length > 0;

    const parsed = extractAndParseRecipe($);
    if (parsed) return { url, status: 'ok', hasMicrodata, parsed };
    if (jsonLdScripts > 0) return { url, status: 'jsonld-no-recipe', hasMicrodata };
    return { url, status: 'no-jsonld', hasMicrodata };
  } catch (e) {
    return { url, status: 'fetch-error', hasMicrodata: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function fieldFlag(value: unknown): string {
  if (value == null) return '-';
  if (typeof value === 'string') return value.length > 0 ? '✓' : '-';
  if (typeof value === 'number') return Number.isFinite(value) ? '✓' : '-';
  if (Array.isArray(value)) return value.length > 0 ? `✓(${value.length})` : '-';
  if (typeof value === 'object') return Object.keys(value).length > 0 ? `✓(${Object.keys(value).length})` : '-';
  return '?';
}

async function main() {
  console.log('=== S-2 JSON-LD parser regression smoke test ===\n');

  const urlsByDomain = await sampleUrls();

  for (const [domain, urls] of Object.entries(urlsByDomain)) {
    if (urls.length === 0) {
      console.log(`━ ${domain}: no URLs in DB`);
      continue;
    }
    console.log(`\n━━━ ${domain} ━━━`);
    const targetUrls = urls.slice(0, URLS_PER_DOMAIN);
    for (const url of targetUrls) {
      const short = url.replace(/^https?:\/\/[^/]+/, '').slice(0, 50);
      process.stdout.write(`  ${short.padEnd(52)} `);
      const r = await probe(url);
      if (r.status === 'ok' && r.parsed) {
        const p = r.parsed;
        const flags = [
          `title=${fieldFlag(p.title)}`,
          `ing=${fieldFlag(p.rawIngredients)}`,
          `steps=${fieldFlag(p.steps)}`,
          `total=${fieldFlag(p.totalTimeMinutes)}`,
          `serv=${fieldFlag(p.servings)}`,
          `rating=${fieldFlag(p.rating)}`,
          `nutr=${fieldFlag(p.nutrition)}`,
          `tags=${fieldFlag(p.tags)}`,
        ].join(' ');
        console.log(`JSON-LD Recipe ok | ${flags}`);
      } else {
        const md = r.hasMicrodata ? ' + microdata[Recipe]' : '';
        console.log(`${r.status}${md}${r.error ? ' (' + r.error + ')' : ''}`);
      }
      await new Promise((s) => setTimeout(s, 700));
    }
  }

  // Candidate domains (S-4 targets)
  if (CANDIDATE_URLS.length > 0) {
    console.log(`\n\n━━━ Candidate domains (S-4 targets) ━━━`);
    for (const { domain, url } of CANDIDATE_URLS) {
      process.stdout.write(`  ${domain.padEnd(25)} `);
      const r = await probe(url);
      if (r.status === 'ok' && r.parsed) {
        const p = r.parsed;
        console.log(`JSON-LD Recipe ✓`);
        console.log(`    title     : "${p.title.slice(0, 60)}"`);
        console.log(`    ing/steps : ${p.rawIngredients.length}/${p.steps.length}`);
        console.log(`    times     : prep=${p.prepTimeMinutes ?? '-'} cook=${p.cookTimeMinutes ?? '-'} total=${p.totalTimeMinutes ?? '-'}`);
        console.log(`    servings  : ${p.servings ?? '-'}`);
        console.log(`    nutrition : ${p.nutrition ? Object.entries(p.nutrition).map(([k, v]) => `${k}=${v}`).join(', ') : '-'}`);
      } else {
        const md = r.hasMicrodata ? ' + microdata[Recipe]' : '';
        console.log(`${r.status}${md}${r.error ? ' (' + r.error + ')' : ''}`);
      }
      await new Promise((s) => setTimeout(s, 700));
    }
  }

  console.log('\n=== Done ===');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
