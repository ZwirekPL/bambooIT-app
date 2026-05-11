/**
 * Extract cookTime / prepTime / totalTime from existing RecipeInstructionStep rows.
 *
 * Strategy: for each Recipe where `totalTimeMinutes IS NULL`, scan its steps for
 * time phrases (Polish) and sum them into `totalTimeMinutes`. This is a local-only
 * operation — no network calls.
 *
 * Usage:
 *   node scripts/extract-recipe-times.js [--dry-run] [--domain kwestiasmaku] [--limit 10] [--sample]
 *
 *   --sample   prints per-recipe extraction details (useful for validation)
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SAMPLE = args.includes("--sample");
const DOMAIN_FILTER = args.includes("--domain")
  ? args[args.indexOf("--domain") + 1]
  : null;
const LIMIT = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1], 10)
  : 0;

// ── Time extraction ─────────────────────────────────────────────────────────

// Filter: drop any number that doesn't plausibly represent a time.
// Reasonable upper bound per single phrase: 600 min (10 hours) — sous vide, slow cook.
const MAX_SINGLE_PHRASE_MIN = 600;
// Reasonable upper bound for total (anything higher is almost surely a parse error).
const MAX_TOTAL_MIN = 720; // 12 hours
// Minimum plausible cook/prep time — anything below is artifact of missing timings
// (e.g. only "gotować przez 1 minutę" matched, but pasta cook time hidden in
// "zgodnie z opakowaniem"). Below this threshold → stored as null, recipe is marked
// for re-scrape.
const MIN_TOTAL_MIN = 5;

/**
 * Extract all time mentions from a single text string.
 * Returns array of { value: number (minutes), raw: string }.
 */
function extractTimes(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = [];

  // Pattern A: "X godz(iny/ina/in) i Y min(ut)" → combined
  // Example: "1 godzinę i 15 minut"
  const combined = /(\d+)\s*godz(?:in(?:a|\u0119|y|\u00e9|\u00f3w|ami)?)?\.?\s+i\s+(\d+)\s*min(?:ut(?:a|\u0119|y|\u00f3w|ami)?)?\.?/gi;
  let m;
  while ((m = combined.exec(lower)) !== null) {
    const hours = parseInt(m[1], 10);
    const mins = parseInt(m[2], 10);
    const total = hours * 60 + mins;
    if (total > 0 && total <= MAX_SINGLE_PHRASE_MIN) {
      found.push({ value: total, raw: m[0], kind: "h+m" });
    }
  }

  // Pattern B: range "X - Y minut" or "X do Y minut" → take max
  const rangeMin = /(\d+)\s*(?:-|\u2013|do)\s*(\d+)\s*min(?:ut)?\.?\b/gi;
  while ((m = rangeMin.exec(lower)) !== null) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const pick = Math.max(a, b);
    if (pick > 0 && pick <= MAX_SINGLE_PHRASE_MIN) {
      found.push({ value: pick, raw: m[0], kind: "range-min" });
    }
  }

  // Pattern C: range "X - Y godzin" → take max * 60
  const rangeH = /(\d+)\s*(?:-|\u2013|do)\s*(\d+)\s*godz(?:in\w*)?\.?\b/gi;
  while ((m = rangeH.exec(lower)) !== null) {
    const pick = Math.max(parseInt(m[1], 10), parseInt(m[2], 10));
    const val = pick * 60;
    if (val > 0 && val <= MAX_SINGLE_PHRASE_MIN) {
      found.push({ value: val, raw: m[0], kind: "range-h" });
    }
  }

  // Pattern D: "X minut(y/\u0119)"
  const singleMin = /(\d+)\s*min(?:ut(?:a|\u0119|y|\u00f3w|ami)?)?\.?\b/gi;
  while ((m = singleMin.exec(lower)) !== null) {
    // Skip if this match already covered by combined or range (by raw overlap)
    const raw = m[0];
    if (found.some(f => f.raw.includes(raw))) continue;

    // Skip if looks like temperature line: "180 minut" unlikely, but "180°C przez 45 minut"
    // — the 45 min is legit. The 180 doesn't match `min` regex, so we're OK here.
    const val = parseInt(m[1], 10);
    if (val > 0 && val <= MAX_SINGLE_PHRASE_MIN) {
      found.push({ value: val, raw, kind: "min" });
    }
  }

  // Pattern E: "X godzin(y/\u0119/\u00f3w)" — standalone hours
  const singleH = /(\d+)\s*godz(?:in(?:a|\u0119|y|\u00f3w|ami)?)?\.?\b/gi;
  while ((m = singleH.exec(lower)) !== null) {
    const raw = m[0];
    if (found.some(f => f.raw.includes(raw))) continue;
    const val = parseInt(m[1], 10) * 60;
    if (val > 0 && val <= MAX_SINGLE_PHRASE_MIN) {
      found.push({ value: val, raw, kind: "h" });
    }
  }

  return found;
}

/**
 * Given a recipe's steps, compute totalTimeMinutes estimate.
 * Returns { total, breakdown } where breakdown is array of per-step times.
 */
function computeRecipeTime(steps) {
  const breakdown = [];
  let total = 0;

  for (const step of steps) {
    const times = extractTimes(step.instruction || "");
    const stepSum = times.reduce((a, t) => a + t.value, 0);
    if (stepSum > 0) {
      breakdown.push({
        stepNumber: step.stepNumber,
        sum: stepSum,
        matches: times.map(t => `${t.raw}=${t.value}m`),
      });
      total += stepSum;
    }
  }

  if (total === 0) return { total: null, breakdown };
  if (total < MIN_TOTAL_MIN) return { total: null, breakdown, rejected: `below MIN_TOTAL_MIN (${total})` };
  if (total > MAX_TOTAL_MIN) return { total: null, breakdown, rejected: "exceeds MAX_TOTAL_MIN" };
  return { total, breakdown };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Recipe Time Extractor (from existing steps) ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}, Domain: ${DOMAIN_FILTER || "all"}, Limit: ${LIMIT || "all"}, Sample: ${SAMPLE}`);

  const where = {
    totalTimeMinutes: null,
  };
  if (DOMAIN_FILTER) {
    const domainMap = {
      kwestiasmaku: "kwestiasmaku.com",
      jadlonomia: "jadlonomia.com",
      dietetykpowszechny: "dietetykpowszechny.pl",
      aniagotuje: "aniagotuje.pl",
    };
    const needle = domainMap[DOMAIN_FILTER] || DOMAIN_FILTER;
    where.sourceUrl = { contains: needle };
  }

  const recipes = await prisma.recipe.findMany({
    where,
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      totalTimeMinutes: true,
      prepTimeMinutes: true,
      cookTimeMinutes: true,
      instructionSteps: {
        select: { stepNumber: true, instruction: true },
        orderBy: { stepNumber: "asc" },
      },
    },
    orderBy: { title: "asc" },
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
  });

  console.log(`\nFound ${recipes.length} recipes with totalTimeMinutes = null\n`);

  const stats = {
    total: recipes.length,
    extracted: 0,
    noSteps: 0,
    noTimes: 0,
    rejected: 0,
    histogram: {},
  };

  for (const r of recipes) {
    if (r.instructionSteps.length === 0) {
      stats.noSteps++;
      continue;
    }

    const { total, breakdown, rejected } = computeRecipeTime(r.instructionSteps);

    if (rejected) {
      stats.rejected++;
      if (SAMPLE) console.log(`  REJ ${r.title.slice(0, 60)} → ${rejected}`);
      continue;
    }
    if (total === null) {
      stats.noTimes++;
      continue;
    }

    stats.extracted++;
    const bucket = total < 15 ? "<15" : total < 30 ? "15-29" : total < 60 ? "30-59" : total < 120 ? "60-119" : "120+";
    stats.histogram[bucket] = (stats.histogram[bucket] || 0) + 1;

    if (SAMPLE) {
      console.log(`  ${total} min | ${r.title.slice(0, 70)}`);
      breakdown.slice(0, 3).forEach(b => {
        console.log(`    step ${b.stepNumber}: ${b.matches.join(", ")} → ${b.sum}m`);
      });
    }

    if (!DRY_RUN) {
      await prisma.recipe.update({
        where: { id: r.id },
        data: { totalTimeMinutes: total },
      });
    }
  }

  console.log("\n=== DONE ===");
  console.log(`Total:        ${stats.total}`);
  console.log(`Extracted:    ${stats.extracted} (${stats.total > 0 ? Math.round(100 * stats.extracted / stats.total) : 0}%)`);
  console.log(`No steps:     ${stats.noSteps}`);
  console.log(`No times:     ${stats.noTimes}`);
  console.log(`Rejected:     ${stats.rejected}`);
  console.log(`\nHistogram (extracted totals, minutes):`);
  Object.entries(stats.histogram).sort().forEach(([k, v]) => {
    console.log(`  ${k.padEnd(8)} ${v}`);
  });
}

main()
  .catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
