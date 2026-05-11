/**
 * Validate Recipe.tags after the autotagger backfill (P0.7 — Recipe Overhaul
 * Master Plan 2026-04-29).
 *
 * Five checks (sign-off bramka before merge):
 *
 *   C1 COVERAGE       — % of active recipes with at least 3 tags; flag if <95%.
 *   C2 CONFLICT       — pairs from autotagger.TAG_CONFLICTS must never co-occur.
 *   C3 CROSS-ALLERGEN — `glutenFree` tag implies no `gluten:CONTAINS` allergen;
 *                       `lactoseFree` implies no `milk:CONTAINS`; `vegan`
 *                       implies no animal-protein allergen (eggs/milk/fish/
 *                       crustaceans/molluscs:CONTAINS).
 *   C4 SAMPLE 30      — random 30 recipes printed in full (title, cuisine,
 *                       mealType, tags) for human spot-check.
 *   C5 PER-CUISINE    — per-cuisineType: count of recipes, avg tags/recipe,
 *                       % under 3 tags. Flag any cuisine with avg < 3.5 or
 *                       coverage < 90%.
 *
 * Plus a deterministic regression hint: count of distinct tags (drift signal —
 * if a future change produces unknown tags, the validator surfaces them).
 *
 * Usage:
 *   npx ts-node --esm scripts/validate-recipe-tags.ts
 *
 * Exit code: 0 on PASS, 2 on WARN-only (coverage <95% but >90%), 1 on FAIL
 * (conflicts / cross-allergen violations / coverage <90%).
 */

import { prisma } from '../packages/database/dist/index.js';
import { TAG_CONFLICTS, KNOWN_TAGS } from '../apps/backend/dist/scraper/utils/autotagger.js';

interface RecipeRow {
  id: string;
  title: string;
  cuisineType: string | null;
  mealType: string;
  tags: string[];
  allergens: Array<{ allergenCode: string; presence: string }>;
}

const COVERAGE_FAIL_THRESHOLD = 0.90; // <90% → FAIL
const COVERAGE_WARN_THRESHOLD = 0.95; // <95% → WARN
const MIN_TAGS_FOR_COVERED = 3;
const PER_CUISINE_AVG_MIN = 3.5;
const PER_CUISINE_COVERAGE_MIN = 0.90;

const ANIMAL_ALLERGENS = new Set(['eggs', 'milk', 'fish', 'crustaceans', 'molluscs']);

interface CheckOutcome {
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  details?: string[];
}

function checkCoverage(recipes: RecipeRow[]): CheckOutcome {
  const covered = recipes.filter((r) => r.tags.length >= MIN_TAGS_FOR_COVERED).length;
  const ratio = covered / recipes.length;
  const pct = (ratio * 100).toFixed(1);
  const under = recipes.filter((r) => r.tags.length < MIN_TAGS_FOR_COVERED);
  const examples = under.slice(0, 5).map((r) => `  ${r.id} | tags=[${r.tags.join(',')}] | ${r.title}`);

  if (ratio < COVERAGE_FAIL_THRESHOLD) {
    return {
      status: 'FAIL',
      message: `C1 COVERAGE: ${covered}/${recipes.length} (${pct}%) ≥3 tags — below FAIL threshold ${COVERAGE_FAIL_THRESHOLD * 100}%`,
      details: examples,
    };
  }
  if (ratio < COVERAGE_WARN_THRESHOLD) {
    return {
      status: 'WARN',
      message: `C1 COVERAGE: ${covered}/${recipes.length} (${pct}%) ≥3 tags — between FAIL ${COVERAGE_FAIL_THRESHOLD * 100}% and WARN ${COVERAGE_WARN_THRESHOLD * 100}%`,
      details: examples,
    };
  }
  return {
    status: 'PASS',
    message: `C1 COVERAGE: ${covered}/${recipes.length} (${pct}%) recipes have ≥${MIN_TAGS_FOR_COVERED} tags`,
  };
}

function checkConflicts(recipes: RecipeRow[]): CheckOutcome {
  const violations: string[] = [];
  for (const r of recipes) {
    const tagSet = new Set(r.tags);
    for (const [a, b] of TAG_CONFLICTS) {
      if (tagSet.has(a) && tagSet.has(b)) {
        violations.push(`  ${r.id} | conflict [${a} + ${b}] | ${r.title}`);
      }
    }
  }
  if (violations.length === 0) {
    return { status: 'PASS', message: `C2 CONFLICT: 0 conflicting tag pairs across ${recipes.length} recipes` };
  }
  return {
    status: 'FAIL',
    message: `C2 CONFLICT: ${violations.length} recipe(s) carry conflicting tag pairs`,
    details: violations.slice(0, 10),
  };
}

function checkCrossAllergen(recipes: RecipeRow[]): CheckOutcome {
  const violations: string[] = [];
  for (const r of recipes) {
    const tagSet = new Set(r.tags);
    const allergens = new Set(
      r.allergens.filter((a) => a.presence === 'CONTAINS').map((a) => a.allergenCode),
    );

    if (tagSet.has('glutenFree') && allergens.has('gluten')) {
      violations.push(`  ${r.id} | glutenFree tag + gluten:CONTAINS | ${r.title}`);
    }
    if (tagSet.has('lactoseFree') && allergens.has('milk')) {
      violations.push(`  ${r.id} | lactoseFree tag + milk:CONTAINS | ${r.title}`);
    }
    if (tagSet.has('vegan')) {
      const animalHit = [...allergens].find((a) => ANIMAL_ALLERGENS.has(a));
      if (animalHit) {
        violations.push(`  ${r.id} | vegan tag + ${animalHit}:CONTAINS | ${r.title}`);
      }
    }
  }
  if (violations.length === 0) {
    return { status: 'PASS', message: `C3 CROSS-ALLERGEN: 0 inconsistencies between tags and allergens` };
  }
  return {
    status: 'FAIL',
    message: `C3 CROSS-ALLERGEN: ${violations.length} tag-vs-allergen inconsistency(ies)`,
    details: violations.slice(0, 10),
  };
}

function checkSample30(recipes: RecipeRow[]): CheckOutcome {
  // Deterministic sample (sorted by id, every Nth) so reruns produce the same
  // sample for human comparison.
  const N = 30;
  const stride = Math.max(1, Math.floor(recipes.length / N));
  const sample = recipes.filter((_, i) => i % stride === 0).slice(0, N);

  const lines = sample.map(
    (r) =>
      `  ${r.cuisineType ?? 'NULL'} | ${r.mealType.padEnd(18)} | tags=[${r.tags.join(', ')}] | ${r.title}`,
  );
  return {
    status: 'PASS',
    message: `C4 SAMPLE 30: ${sample.length} recipes sampled (deterministic, every ${stride}-th by id)`,
    details: lines,
  };
}

function checkPerCuisine(recipes: RecipeRow[]): CheckOutcome {
  const byCuisine = new Map<string, RecipeRow[]>();
  for (const r of recipes) {
    const key = r.cuisineType ?? 'NULL';
    if (!byCuisine.has(key)) byCuisine.set(key, []);
    byCuisine.get(key)!.push(r);
  }
  const flagged: string[] = [];
  const detail: string[] = [];

  const sorted = [...byCuisine.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [cuisine, rs] of sorted) {
    const avg = rs.reduce((s, r) => s + r.tags.length, 0) / rs.length;
    const covered = rs.filter((r) => r.tags.length >= MIN_TAGS_FOR_COVERED).length;
    const cov = covered / rs.length;
    const line = `  ${cuisine.padEnd(20)} n=${rs.length.toString().padStart(4)} avg=${avg.toFixed(2)} cov(≥3)=${(cov * 100).toFixed(1)}%`;
    detail.push(line);
    if (avg < PER_CUISINE_AVG_MIN || cov < PER_CUISINE_COVERAGE_MIN) {
      flagged.push(`${cuisine} (avg=${avg.toFixed(2)}, cov=${(cov * 100).toFixed(1)}%)`);
    }
  }
  const status: CheckOutcome['status'] = flagged.length > 0 ? 'WARN' : 'PASS';
  return {
    status,
    message:
      flagged.length === 0
        ? `C5 PER-CUISINE: all ${byCuisine.size} cuisines pass thresholds (avg≥${PER_CUISINE_AVG_MIN}, cov≥${PER_CUISINE_COVERAGE_MIN * 100}%)`
        : `C5 PER-CUISINE: ${flagged.length} cuisine(s) below thresholds — ${flagged.join('; ')}`,
    details: detail,
  };
}

function checkUnknownTagDrift(recipes: RecipeRow[]): CheckOutcome {
  const unknown = new Map<string, number>();
  // 'ai-generated', 'side', 'basic', 'carb_side', 'veg_side' are legacy
  // markers from prior seeds — passthrough is allowed but tracked.
  const PASSTHROUGH_OK = new Set(['ai-generated', 'side', 'basic', 'carb_side', 'veg_side', 'imported']);
  for (const r of recipes) {
    for (const t of r.tags) {
      if (!KNOWN_TAGS.has(t) && !PASSTHROUGH_OK.has(t)) {
        unknown.set(t, (unknown.get(t) ?? 0) + 1);
      }
    }
  }
  if (unknown.size === 0) {
    return { status: 'PASS', message: `DRIFT: 0 tags outside KNOWN_TAGS / passthrough whitelist` };
  }
  const lines = [...unknown.entries()].map(([t, n]) => `  ${t.padEnd(25)} ${n}`);
  return {
    status: 'WARN',
    message: `DRIFT: ${unknown.size} unknown tag value(s) detected (might be legacy or autotagger drift)`,
    details: lines,
  };
}

function printOutcome(o: CheckOutcome): void {
  const icon = o.status === 'PASS' ? '✓' : o.status === 'WARN' ? '!' : '✗';
  console.log(`[${icon} ${o.status}] ${o.message}`);
  if (o.details && o.details.length > 0) {
    for (const d of o.details) console.log(d);
  }
}

async function main(): Promise<void> {
  console.log('=== Validate Recipe.tags (P0.7) ===');
  console.log(`Date: ${new Date().toISOString()}\n`);

  const recipes = await prisma.recipe.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      cuisineType: true,
      mealType: true,
      tags: true,
      allergens: { select: { allergenCode: true, presence: true } },
    },
    orderBy: { id: 'asc' },
  });
  console.log(`Active recipes scanned: ${recipes.length}\n`);

  const outcomes = [
    checkCoverage(recipes),
    checkConflicts(recipes),
    checkCrossAllergen(recipes),
    checkPerCuisine(recipes),
    checkUnknownTagDrift(recipes),
    checkSample30(recipes),
  ];

  for (const o of outcomes) {
    printOutcome(o);
    console.log();
  }

  const fail = outcomes.some((o) => o.status === 'FAIL');
  const warn = outcomes.some((o) => o.status === 'WARN');
  console.log('=== Verdict ===');
  if (fail) {
    console.log('FAIL — fix blocking issues before merge.');
    process.exit(1);
  }
  if (warn) {
    console.log('PASS WITH WARNINGS — review before sign-off.');
    process.exit(2);
  }
  console.log('PASS — ready for sign-off.');
}

main()
  .catch((err) => { console.error('FATAL:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
