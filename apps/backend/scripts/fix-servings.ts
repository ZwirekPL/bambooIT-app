/**
 * Fix Recipe.servings by scraping original source pages.
 *
 * Supports:
 *  - aniagotuje.pl  → <meta itemprop="recipeYield" content="...X porcji...">
 *  - kwestiasmaku.com → <div class="field-name-field-ilosc-porcji">...X sztuk/porcji...</div>
 *
 * Usage:
 *   DRY RUN (default):  npx ts-node -r tsconfig-paths/register scripts/fix-servings.ts
 *   APPLY:              npx ts-node -r tsconfig-paths/register scripts/fix-servings.ts --apply
 */

import { prisma } from '@db';

const DRY_RUN = !process.argv.includes('--apply');
const DELAY_MS = 800; // rate limit per request
const TIMEOUT_MS = 8000;

// ─── Parsers per domain ──────────────────────────────────────────────────────

function parseAniaGotuje(html: string): number | null {
  // Source 1: <meta itemprop="recipeYield" content="6 dużych naleśników = 6 porcji">
  //           or: content="1300 g - 4 porcje">
  const metaMatch = html.match(/itemprop="recipeYield"\s*content="([^"]*)"/i);
  if (metaMatch) {
    const content = metaMatch[1];
    // Priority: "X porcji/porcje/porcja" (not grams!)
    const porcjeMatch = content.match(/(\d+)\s*porcj/i);
    if (porcjeMatch) return parseInt(porcjeMatch[1], 10);
    // "X sztuk" (e.g. "12 sztuk")
    const sztukMatch = content.match(/(\d+)\s*sztuk/i);
    if (sztukMatch) return parseInt(sztukMatch[1], 10);
    // "X naleśników/gofrów/etc" — count items
    const itemMatch = content.match(/(\d+)\s*(?:nale|gofr|placki|placusz|pączk|bułe|kotlet|pierog|krokiet)/i);
    if (itemMatch) return parseInt(itemMatch[1], 10);
  }

  // Source 2: "Liczba porcji: X" in body text
  const bodyMatch = html.match(/Liczba porcji:[\s\S]*?(\d+)\s*(?:porcj|sztuk|nale|gofr|plack|duż)/i);
  if (bodyMatch) return parseInt(bodyMatch[1], 10);

  // Source 3: Just "Liczba porcji:" followed by a number
  const simpleMatch = html.match(/Liczba porcji:\s*(\d+)/i);
  if (simpleMatch) return parseInt(simpleMatch[1], 10);

  return null;
}

function parseKwestiaSmaku(html: string): number | null {
  // <div class="field field-name-field-ilosc-porcji ...">ok. 12 sztuk</div>
  const match = html.match(/field-name-field-ilosc-porcji[^>]*>([\s\S]*?)<\/div>/i);
  if (!match) return null;
  const content = match[1].trim();

  // Extract number: "ok. 12 sztuk", "4 porcje", "6", "8-10 sztuk"
  const numMatch = content.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);

  return null;
}

function parseServingsFromHtml(html: string, domain: string): number | null {
  if (domain.includes('aniagotuje.pl')) return parseAniaGotuje(html);
  if (domain.includes('kwestiasmaku.com')) return parseKwestiaSmaku(html);
  return null;
}

// ─── Fetch with timeout ──────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DietetykDEV-ServingsFix/1.0' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (no changes) ===' : '=== APPLYING CHANGES ===');

  const recipes = await prisma.recipe.findMany({
    where: {
      sourceUrl: { not: null },
      OR: [
        { sourceUrl: { contains: 'aniagotuje.pl' } },
        { sourceUrl: { contains: 'kwestiasmaku.com' } },
      ],
    },
    select: { id: true, title: true, servings: true, sourceUrl: true },
    orderBy: { title: 'asc' },
  });

  console.log(`Found ${recipes.length} recipes with supported sourceUrl\n`);

  const stats = {
    total: recipes.length,
    fetched: 0,
    parsed: 0,
    changed: 0,
    unchanged: 0,
    fetchFailed: 0,
    parseFailed: 0,
    errors: 0,
  };

  const changes: Array<{ title: string; old: number; new: number; url: string }> = [];
  const failures: Array<{ title: string; reason: string; url: string }> = [];

  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i];
    const url = r.sourceUrl!;
    let domain: string;
    try {
      domain = new URL(url).hostname;
    } catch {
      failures.push({ title: r.title, reason: 'invalid URL', url });
      stats.errors++;
      continue;
    }

    // Progress every 50
    if (i > 0 && i % 50 === 0) {
      console.log(`  [${i}/${recipes.length}] fetched=${stats.fetched} parsed=${stats.parsed} changed=${stats.changed} failed=${stats.fetchFailed + stats.parseFailed}`);
    }

    const html = await fetchPage(url);
    if (!html) {
      failures.push({ title: r.title, reason: 'fetch failed', url });
      stats.fetchFailed++;
      await sleep(DELAY_MS);
      continue;
    }
    stats.fetched++;

    const scraped = parseServingsFromHtml(html, domain);
    if (!scraped || scraped < 1 || scraped > 100) {
      failures.push({ title: r.title, reason: `parse failed (got: ${scraped})`, url });
      stats.parseFailed++;
      await sleep(DELAY_MS);
      continue;
    }
    stats.parsed++;

    if (scraped === r.servings) {
      stats.unchanged++;
    } else {
      stats.changed++;
      changes.push({ title: r.title, old: r.servings, new: scraped, url });

      const isSuspicious = scraped > 30 || (r.servings > 5 && scraped === 1);
      if (!DRY_RUN && !isSuspicious) {
        await prisma.recipe.update({
          where: { id: r.id },
          data: { servings: scraped },
        });
      }
    }

    await sleep(DELAY_MS);
  }

  // ─── Report ──────────────────────────────────────────────────────────────

  console.log('\n\n========== RAPORT ==========');
  console.log(`Total:        ${stats.total}`);
  console.log(`Fetched:      ${stats.fetched}`);
  console.log(`Parsed OK:    ${stats.parsed}`);
  console.log(`Changed:      ${stats.changed}`);
  console.log(`Unchanged:    ${stats.unchanged}`);
  console.log(`Fetch failed: ${stats.fetchFailed}`);
  console.log(`Parse failed: ${stats.parseFailed}`);
  console.log(`Errors:       ${stats.errors}`);

  // ─── Save full CSV for review ─────────────────────────────────────────
  const fs = await import('fs');
  const csvPath = 'fix-servings-review.csv';

  const suspicious = changes.filter((c) => c.new > 30 || (c.old > 5 && c.new === 1));
  const normal = changes.filter((c) => c.new <= 30 && !(c.old > 5 && c.new === 1));

  let csv = 'PRZEPIS;STARE PORCJE;NOWE PORCJE;URL;OCENA\n';

  if (suspicious.length > 0) {
    csv += `\n=== PODEJRZANE (${suspicious.length}) - sprawdz recznie ===\n`;
    for (const c of suspicious.sort((a, b) => b.new - a.new)) {
      csv += `${c.title};${c.old};${c.new};${c.url};???\n`;
    }
  }

  csv += `\n=== NORMALNE ZMIANY (${normal.length}) ===\n`;
  for (const c of normal.sort((a, b) => a.title.localeCompare(b.title, 'pl'))) {
    csv += `${c.title};${c.old};${c.new};${c.url};OK\n`;
  }

  fs.writeFileSync(csvPath, csv, 'utf8');
  console.log(`\nZapisano pelna liste: ${csvPath} (${changes.length} zmian, ${suspicious.length} podejrzanych)`);
  console.log(DRY_RUN ? '→ To apply: run with --apply' : '→ Changes applied to DB');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
