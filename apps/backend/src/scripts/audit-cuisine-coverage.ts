/**
 * Z5 — Cuisine coverage gap analysis (read-only audit).
 *
 * Compares the 17 EN cuisine codes the interview form (`InterviewForm.tsx`)
 * lets a patient pick against the 9 PL canonical values stored in
 * `Recipe.cuisineType` (per `apps/backend/src/utils/cuisineMapping.ts`),
 * then counts how many active recipes each PL value has.
 *
 * Threshold reasoning (from the master plan):
 *
 *   For a 7-day plan with SC22 cuisine cohesion target 60% (4-5 main
 *   slots/week land in the patient's preferred cuisine), and a typical
 *   4-week rotation horizon, a **practical minimum is ~15 recipes**
 *   per cuisine in the COMPLETE_MEAL ∪ MAIN_DISH "main-slot-fillable"
 *   pool. Below that, SC22 falls short and the patient gets the
 *   "preferred cuisine seems sparse" experience.
 *
 *     >= 15  ✓ green
 *      5–14  ⚠ yellow (works for 1-2 weeks, may need scrape backfill)
 *      < 5   ✗ red (SC22 essentially unreachable; scrape priority)
 *
 * Special cases:
 *
 *   • `scandinavian` → `inna` is a catch-all mapping. `inna` is HUGE
 *      (1 161 recipes) but they're not actually Scandinavian — the
 *      patient's preference signal is effectively lost. Audit calls
 *      this out so the operator can decide whether to (a) leave it
 *      (current state), (b) re-map scandinavian to `polska` (closest
 *      culturally), or (c) drop the option from the form.
 *   • `any` returns [] (no preference) — not analysed.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register \
 *       apps/backend/src/scripts/audit-cuisine-coverage.ts
 */

import { prisma } from '@db';

// 17 EN codes the interview offers. Order matches InterviewForm.tsx.
const INTERVIEW_CODES: Array<[string, string]> = [
  ['polish', 'cuisinePolish'],
  ['mediterranean', 'cuisineMediterranean'],
  ['italian', 'cuisineItalian'],
  ['greek', 'cuisineGreek'],
  ['french', 'cuisineFrench'],
  ['scandinavian', 'cuisineScandinavian'],
  ['middle_eastern', 'cuisineMiddleEastern'],
  ['turkish', 'cuisineTurkish'],
  ['lebanese', 'cuisineLebanese'],
  ['indian', 'cuisineIndian'],
  ['thai', 'cuisineThai'],
  ['japanese', 'cuisineJapanese'],
  ['vietnamese', 'cuisineVietnamese'],
  ['asian_general', 'cuisineAsianGeneral'],
  ['mexican', 'cuisineMexican'],
  ['american', 'cuisineAmerican'],
  ['any', 'cuisineAny'],
];

// Mirror of BASE_MAP from cuisineMapping.ts. Kept literal here so the
// audit doesn't pull the mapping at runtime — we want to detect
// drift between the two modules manually if it occurs.
const BASE_MAP: Record<string, string[]> = {
  polish: ['polska'],
  italian: ['włoska'],
  mediterranean: ['śródziemnomorska'],
  greek: ['śródziemnomorska'],
  french: ['francuska'],
  scandinavian: ['inna'],
  middle_eastern: ['śródziemnomorska'],
  turkish: ['śródziemnomorska'],
  lebanese: ['śródziemnomorska'],
  indian: ['indyjska'],
  thai: ['azjatycka'],
  japanese: ['azjatycka'],
  vietnamese: ['azjatycka'],
  asian_general: ['azjatycka'],
  mexican: ['meksykańska'],
  american: ['amerykańska'],
};

const MIN_VIABLE = 15;
const RED_THRESHOLD = 5;

interface PlCuisineStats {
  cuisine: string;
  total: number;
  completeMeal: number;
  mainDish: number;
  mainFillable: number; // COMPLETE_MEAL + MAIN_DISH
  perMealType: Record<string, number>;
}

async function loadStats(): Promise<Map<string, PlCuisineStats>> {
  // groupBy by cuisineType + dishCompleteness
  const byCompleteness = await prisma.recipe.groupBy({
    by: ['cuisineType', 'dishCompleteness'],
    where: { isActive: true },
    _count: true,
  });
  // groupBy by cuisineType + mealType for per-mealType breakdown
  const byMealType = await prisma.recipe.groupBy({
    by: ['cuisineType', 'mealType'],
    where: { isActive: true },
    _count: true,
  });

  const stats = new Map<string, PlCuisineStats>();
  for (const row of byCompleteness) {
    const k = row.cuisineType ?? '(NULL)';
    if (!stats.has(k)) {
      stats.set(k, {
        cuisine: k,
        total: 0,
        completeMeal: 0,
        mainDish: 0,
        mainFillable: 0,
        perMealType: {},
      });
    }
    const s = stats.get(k)!;
    const cnt = (row._count as unknown as number) ?? 0;
    s.total += cnt;
    if (row.dishCompleteness === 'COMPLETE_MEAL') s.completeMeal += cnt;
    if (row.dishCompleteness === 'MAIN_DISH') s.mainDish += cnt;
    if (row.dishCompleteness === 'COMPLETE_MEAL' || row.dishCompleteness === 'MAIN_DISH') {
      s.mainFillable += cnt;
    }
  }
  for (const row of byMealType) {
    const k = row.cuisineType ?? '(NULL)';
    if (!stats.has(k)) continue;
    const cnt = (row._count as unknown as number) ?? 0;
    const s = stats.get(k)!;
    s.perMealType[row.mealType] = (s.perMealType[row.mealType] ?? 0) + cnt;
  }
  return stats;
}

function flag(value: number): string {
  if (value < RED_THRESHOLD) return '✗ RED';
  if (value < MIN_VIABLE) return '⚠ YELLOW';
  return '✓ GREEN';
}

async function main(): Promise<void> {
  console.log('\n=== Z5 — cuisine coverage gap analysis (read-only) ===\n');

  const stats = await loadStats();
  const totalActive = [...stats.values()].reduce((acc, s) => acc + s.total, 0);
  console.log(`Total active recipes: ${totalActive}\n`);

  // ── Per PL cuisine ─────────────────────────────────────────────────────
  console.log('--- PL cuisine pool (active recipes, COMPLETE_MEAL ∪ MAIN_DISH = main-slot-fillable) ---');
  console.log(
    'cuisine'.padEnd(20) +
    'total'.padStart(7) +
    'main-fillable'.padStart(15) +
    'CM'.padStart(6) +
    'MD'.padStart(6) +
    '   status',
  );
  const sortedPl = [...stats.values()].sort((a, b) => b.mainFillable - a.mainFillable);
  for (const s of sortedPl) {
    console.log(
      s.cuisine.padEnd(20) +
      String(s.total).padStart(7) +
      String(s.mainFillable).padStart(15) +
      String(s.completeMeal).padStart(6) +
      String(s.mainDish).padStart(6) +
      `   ${flag(s.mainFillable)}`,
    );
  }

  // ── 17 EN code mapping ────────────────────────────────────────────────
  console.log('\n--- Interview EN codes → PL pool depth (main-slot-fillable) ---');
  console.log(
    'EN code'.padEnd(20) +
    'PL mapping'.padEnd(35) +
    'pool'.padStart(8) +
    '   status'
  );
  const scrapeTargets: Array<{ enCode: string; plList: string; pool: number }> = [];
  for (const [enCode] of INTERVIEW_CODES) {
    if (enCode === 'any') {
      console.log(`${enCode.padEnd(20)}${'(no preference)'.padEnd(35)}${'-'.padStart(8)}   —`);
      continue;
    }
    const plCodes = BASE_MAP[enCode] ?? [];
    if (plCodes.length === 0) {
      console.log(`${enCode.padEnd(20)}${'(unmapped)'.padEnd(35)}${'-'.padStart(8)}   ✗ NO MAPPING`);
      continue;
    }
    // Sum mainFillable across all PL codes this EN code maps to (most map
    // 1:1 today; some converge — e.g. greek + turkish + lebanese all hit
    // śródziemnomorska, which inflates "pool" because we'd be counting
    // the same Polish recipes for each EN code).
    const mainFillable = plCodes.reduce(
      (acc, pl) => acc + (stats.get(pl)?.mainFillable ?? 0),
      0,
    );
    const plLabel = plCodes.join(', ');
    console.log(
      `${enCode.padEnd(20)}${plLabel.padEnd(35)}${String(mainFillable).padStart(8)}   ${flag(mainFillable)}`,
    );
    if (mainFillable < MIN_VIABLE) {
      scrapeTargets.push({ enCode, plList: plLabel, pool: mainFillable });
    }
  }

  // ── Special: scandinavian → inna ─────────────────────────────────────
  console.log('\n--- Special-case warnings ---');
  const innaStats = stats.get('inna');
  console.log(
    `scandinavian → inna catch-all: inna has ${innaStats?.mainFillable ?? 0} main-fillable recipes,\n` +
    '   BUT none are actually Scandinavian. Patient signal is effectively LOST.\n' +
    '   Decision matrix:\n' +
    '     (a) Leave as-is (current — patient gets non-Scandinavian "inna" pool).\n' +
    '     (b) Re-map scandinavian → polska in cuisineMapping.ts (closest culturally).\n' +
    '     (c) Drop scandinavian option from InterviewForm.tsx + i18n keys.',
  );

  // ── Per-mealType depth for thin pools (lunch + dinner = main slots) ──
  console.log('\n--- Per-mealType breakdown (main slots only: BREAKFAST/LUNCH/DINNER) ---');
  for (const s of sortedPl) {
    const mainSlotCount =
      (s.perMealType.BREAKFAST ?? 0) +
      (s.perMealType.LUNCH ?? 0) +
      (s.perMealType.DINNER ?? 0);
    const slots = ['BREAKFAST', 'LUNCH', 'DINNER']
      .map((mt) => `${mt[0]}=${s.perMealType[mt] ?? 0}`)
      .join(' ');
    console.log(`  ${s.cuisine.padEnd(20)} main-slot total=${String(mainSlotCount).padStart(4)}   ${slots}`);
  }

  // ── Recommendations ────────────────────────────────────────────────────
  if (scrapeTargets.length > 0) {
    console.log('\n--- Scrape-target recommendations (pool < 15 main-fillable) ---');
    for (const t of scrapeTargets) {
      console.log(`  ${t.enCode.padEnd(15)} (${t.plList}): pool=${t.pool} → ${flag(t.pool)}`);
    }
    console.log('\n  → Prioritise these in S-4 PoC (post-Faza-D scraper backlog).');
  } else {
    console.log('\n  All 16 (excluding "any") cuisines have ≥ 15 main-fillable recipes ✓');
  }

  console.log('\n=== End audit (read-only, no writes) ===\n');
}

main()
  .catch((err) => { console.error('FAILED:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
