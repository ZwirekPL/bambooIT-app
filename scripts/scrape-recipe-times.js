/**
 * Scrape prepTime / cookTime / totalTime from recipe source pages.
 * Only for recipes where totalTimeMinutes IS NULL.
 *
 * Tries in order:
 *   1. JSON-LD schema.org/Recipe (prepTime, cookTime, totalTime in ISO 8601 e.g. "PT30M")
 *   2. itemprop microdata (e.g. jadlonomia.com: <span itemprop="prepTime">30M</span>)
 *   3. Text patterns (fallback, Polish)
 *
 * Writes:
 *   - prepTimeMinutes (if found)
 *   - cookTimeMinutes (if found)
 *   - totalTimeMinutes (if found, OR computed as prep + cook, OR = prep if no cook)
 *
 * Usage:
 *   node scripts/scrape-recipe-times.js [--dry-run] [--domain jadlonomia] [--limit 10]
 */

const { PrismaClient } = require("@prisma/client");
const cheerio = require("cheerio");

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DOMAIN_FILTER = args.includes("--domain") ? args[args.indexOf("--domain") + 1] : null;
const LIMIT = args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1], 10) : 0;
const CONCURRENCY = 3;
const DELAY_MS = 500;
const TIMEOUT_MS = 15000;

// ── Time parsing ────────────────────────────────────────────────────────────

/**
 * Parse ISO-8601-like duration or Polish free text into minutes.
 * Handles: "PT30M", "30M", "PT1H30M", "1H30M", "30 minut", "1 godz. 30 min".
 */
function parseDuration(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();

  // ISO 8601 (with or without PT prefix)
  const iso = s.match(/^(?:PT)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (iso) {
    const h = parseInt(iso[1] || "0", 10);
    const m = parseInt(iso[2] || "0", 10);
    const total = h * 60 + m;
    if (total > 0) return total;
  }

  // Polish text
  const lower = s.toLowerCase();
  let total = 0;
  const h = lower.match(/(\d+)\s*(?:godz|h|godzin)/);
  if (h) total += parseInt(h[1], 10) * 60;
  const m = lower.match(/(\d+)\s*(?:minut|min)/);
  if (m) total += parseInt(m[1], 10);
  if (total > 0) return total;

  // Bare number
  const n = s.match(/^(\d+)$/);
  if (n) return parseInt(n[1], 10);

  return null;
}

// ── Extraction strategies ───────────────────────────────────────────────────

function extractFromJsonLd($) {
  const out = { prep: null, cook: null, total: null };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html());
      const list = [];
      if (Array.isArray(json)) list.push(...json);
      else if (json["@graph"]) list.push(...json["@graph"]);
      else list.push(json);

      for (const r of list) {
        if (!r) continue;
        const t = r["@type"];
        const isRecipe = t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
        if (!isRecipe) continue;
        out.prep = parseDuration(r.prepTime) ?? out.prep;
        out.cook = parseDuration(r.cookTime) ?? out.cook;
        out.total = parseDuration(r.totalTime) ?? out.total;
      }
    } catch (e) { /* ignore */ }
  });
  return out;
}

function extractFromItemprop($) {
  const out = { prep: null, cook: null, total: null };
  const map = { prepTime: "prep", cookTime: "cook", totalTime: "total" };
  for (const [prop, key] of Object.entries(map)) {
    const el = $(`[itemprop="${prop}"]`).first();
    if (!el.length) continue;
    const raw = el.attr("content") || el.attr("datetime") || el.text().trim();
    out[key] = parseDuration(raw);
  }
  return out;
}

function extractFromText($) {
  const text = $("body").text();
  const out = { prep: null, cook: null, total: null };
  const patterns = [
    ["prep", /[Cc]zas\s+przygotowania[^:]*:\s*([^\n+]+)/],
    ["cook", /[Cc]zas\s+gotowania[^:]*:\s*([^\n+]+)/],
    ["cook", /[Cc]zas\s+pieczenia[^:]*:\s*([^\n+]+)/],
    ["total", /[Cc]zas\s+(?:\u0142\u0105czny|ca\u0142kowity)[^:]*:\s*([^\n+]+)/],
  ];
  for (const [key, pat] of patterns) {
    if (out[key] != null) continue;
    const m = text.match(pat);
    if (m) {
      const parsed = parseDuration(m[1]);
      if (parsed != null) out[key] = parsed;
    }
  }
  return out;
}

function mergeExtractions(...srcs) {
  const merged = { prep: null, cook: null, total: null };
  for (const s of srcs) {
    if (merged.prep == null && s.prep != null) merged.prep = s.prep;
    if (merged.cook == null && s.cook != null) merged.cook = s.cook;
    if (merged.total == null && s.total != null) merged.total = s.total;
  }
  // Derive total if missing
  if (merged.total == null) {
    if (merged.prep != null && merged.cook != null) merged.total = merged.prep + merged.cook;
    else if (merged.prep != null) merged.total = merged.prep;
    else if (merged.cook != null) merged.total = merged.cook;
  }
  return merged;
}

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchHtml(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DietetykBot/1.0; recipe-enrichment)",
          Accept: "text/html",
          "Accept-Language": "pl,en;q=0.5",
        },
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

// ── Main processing ─────────────────────────────────────────────────────────

const stats = { total: 0, fetched: 0, found: 0, emptyResult: 0, errors: 0 };

async function processRecipe(r) {
  try {
    const html = await fetchHtml(r.sourceUrl);
    stats.fetched++;
    const $ = cheerio.load(html);
    const merged = mergeExtractions(
      extractFromJsonLd($),
      extractFromItemprop($),
      extractFromText($)
    );

    if (merged.prep == null && merged.cook == null && merged.total == null) {
      stats.emptyResult++;
      return;
    }

    stats.found++;

    if (DRY_RUN) {
      console.log(`  [DRY] ${r.title.slice(0, 60)} → prep=${merged.prep} cook=${merged.cook} total=${merged.total}`);
      return;
    }

    const data = {};
    if (merged.prep != null && r.prepTimeMinutes == null) data.prepTimeMinutes = merged.prep;
    if (merged.cook != null && r.cookTimeMinutes == null) data.cookTimeMinutes = merged.cook;
    if (merged.total != null && r.totalTimeMinutes == null) data.totalTimeMinutes = merged.total;

    if (Object.keys(data).length === 0) return;

    await prisma.recipe.update({ where: { id: r.id }, data });
  } catch (e) {
    console.error(`  ERROR ${r.title.slice(0, 50)}: ${e.message}`);
    stats.errors++;
  }
}

async function processBatch(recipes) {
  const queue = [...recipes];
  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const r = queue.shift();
        await processRecipe(r);
        await new Promise(s => setTimeout(s, DELAY_MS));
      }
    })());
  }
  await Promise.all(workers);
}

async function main() {
  console.log("=== Recipe Time Scraper ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}, Domain: ${DOMAIN_FILTER || "all"}, Limit: ${LIMIT || "all"}`);

  const where = { totalTimeMinutes: null };
  if (DOMAIN_FILTER) {
    const domainMap = {
      kwestiasmaku: "kwestiasmaku.com",
      jadlonomia: "jadlonomia.com",
      dietetykpowszechny: "dietetykpowszechny.pl",
      aniagotuje: "aniagotuje.pl",
    };
    where.sourceUrl = { contains: domainMap[DOMAIN_FILTER] || DOMAIN_FILTER };
  } else {
    where.sourceUrl = { not: null };
  }

  const recipes = await prisma.recipe.findMany({
    where,
    select: { id: true, title: true, sourceUrl: true, prepTimeMinutes: true, cookTimeMinutes: true, totalTimeMinutes: true },
    orderBy: { title: "asc" },
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
  });

  stats.total = recipes.length;
  console.log(`\nFound ${stats.total} recipes to process\n`);

  const BATCH = 25;
  for (let i = 0; i < recipes.length; i += BATCH) {
    const chunk = recipes.slice(i, i + BATCH);
    const pct = recipes.length > 0 ? Math.round(100 * i / recipes.length) : 0;
    console.log(`Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(recipes.length / BATCH)} (${pct}%)...`);
    await processBatch(chunk);
  }

  console.log("\n=== DONE ===");
  console.log(`Total:        ${stats.total}`);
  console.log(`Fetched:      ${stats.fetched}`);
  console.log(`Found times:  ${stats.found}`);
  console.log(`Empty result: ${stats.emptyResult}`);
  console.log(`Errors:       ${stats.errors}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
