/**
 * Faza A.2 v2: Reclassify component recipes — multi-tier confidence system.
 *
 * Built from discovery findings (2974 recipes scanned):
 *   - Pattern alone is NOT enough (e.g., "Schab w sosie" matches /sos/ but
 *     is a full meal). We need EXCLUSION guards.
 *   - 416 low-kcal anomalies are SCALE BUGS, not components — handled by a
 *     separate script.
 *   - classifyMealType disagreements give 154 false positives — ignored here.
 *
 * Two confidence tiers:
 *   HIGH   — title unambiguously indicates a component (after exclusion guards).
 *            → auto-apply: mealType becomes SAUCE.
 *   MEDIUM — title is ambiguous (hummus/guacamole/twarożek/pasztet) — could
 *            be a standalone snack OR a spread.
 *            → write DataQualityIssue with code RECIPE_POSSIBLE_COMPONENT for
 *              dietitian review; do NOT change mealType.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/reclassify-component-recipes.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/reclassify-component-recipes.ts --apply
 *   npx ts-node -r tsconfig-paths/register src/scripts/reclassify-component-recipes.ts --apply --skip-medium
 */

import { prisma } from '@db';
import { normalizeProductName } from '../scraper/utils/productMatcher';

const APPLY = process.argv.includes('--apply');
const SKIP_MEDIUM = process.argv.includes('--skip-medium');

// ─── HIGH-confidence patterns ────────────────────────────────────────────────

interface Pattern {
  name: string;
  regex: RegExp;
  category: 'spread' | 'dough' | 'filling' | 'topping' | 'marinade' | 'sauce-glaze';
}

// Run on normalizeProductName(title) — lowercase, no diacritics, ascii-only.
// Each pattern targets a NARROW, unambiguous component construction.
const HIGH_PATTERNS: Pattern[] = [
  // — Spreads / sandwich pastes —
  // Specific named spreads — "pasta jajeczna", "pasta z fasoli", etc.
  { name: 'pasta-named', category: 'spread',
    regex: /^pasta (jajeczna|serowa|z awokado|z tunczyka|tunczykowa|z lososia|kanapkowa|z ciecierzycy|z fasoli|z bialej fasoli|hummusowa|jaglana z|z kaszy)\b/ },
  // "Pasta na kanapki" / "pasta do kanapek"
  { name: 'pasta-na-kanapki', category: 'spread',
    regex: /^.{0,30}\bpasta na kanapki?\b/ },
  { name: 'pasta-do-kanapek', category: 'spread',
    regex: /^.{0,30}\bpasta do kanapek\b/ },
  // "Smalec" — Polish lard spread, never a meal
  { name: 'smalec', category: 'spread',
    regex: /^smalec\b/ },

  // — Doughs / bases — only "ciasto na X" where X is a dish-target
  { name: 'ciasto-na-target', category: 'dough',
    regex: /^ciasto na (pizz|pierog|nalesnik|paczk|kluski|tortill|kulebiak|pasztecik|tarteletk|fokacc|focacc|chleb|bulk|drozdzowk|tarte\b)/ },
  // "Baza pod X"
  { name: 'baza-pod', category: 'dough',
    regex: /^baza pod\b/ },
  // NOTE: "Ciasto kruche/francuskie/drożdżowe X" patterns NOT included — they
  // match full desserts (e.g. "Ciasto kruche ze śliwkami") not bases.
  // A bare "Ciasto kruche" with no filler may be a base, but the gain is too
  // small to justify the risk; leave for MEDIUM tier if needed later.

  // — Fillings —
  { name: 'farsz', category: 'filling',
    regex: /^farsz\b/ },
  { name: 'nadzienie', category: 'filling',
    regex: /^nadzienie\b/ },

  // — Toppings / coatings / glazes —
  { name: 'panierka', category: 'topping',
    regex: /^panierka\b/ },
  { name: 'polewa', category: 'topping',
    regex: /^polewa\b/ },
  { name: 'lukier', category: 'topping',
    regex: /^lukier\b/ },
  { name: 'glazura', category: 'topping',
    regex: /^glazura\b/ },
  { name: 'posypka', category: 'topping',
    regex: /^posypka\b/ },

  // — Marinades — only when title indicates a marinade-as-recipe
  { name: 'marynata', category: 'marinade',
    regex: /^marynata\b/ },
  { name: 'marynata-do-na', category: 'marinade',
    regex: /^[a-z\s]{0,40}\bmarynat[ay]\s+(do|na)\b/ },

  // — Sauce-context "X to/for X" — only when X = component-target —
  // "Krem do/pod tortu/ciasta" — explicitly a topping, not a soup
  { name: 'krem-do-pod', category: 'sauce-glaze',
    regex: /^krem (do|pod)\b/ },
  // "Sos do/na X" — already covered for existing SAUCE; this catches stragglers
  // None expected after exclusion of full SAUCE-tagged recipes
];

// ─── EXCLUSION guards ────────────────────────────────────────────────────────
// If the normalized title matches ANY guard, skip — even if a HIGH pattern
// matched. Prevents reclassifying full meals as components.

const FULL_MEAL_EXCLUSIONS: RegExp[] = [
  // "Schab/kurczak/X w sosie Y" — full meal with sauce
  /\b w sosie\b/,
  /\bz sosem\b/,
  /\bw winegrecie\b/,
  /\bw majonezie\b/,
  /\bz pesto\b/,
  // Dish indicators
  /\b(z makaronem|z ryzem|z ziemniakami|z kasza|z kaszami|z kasz[ae]?\s|z fasola|z soczewica)\b/,
  /\b(na obiad|na sniadanie|na kolacje)\b/,
  /\b(danie|porcja|posilek|kanapka|kanapki)\b/,
];

// ─── MEDIUM-confidence patterns ──────────────────────────────────────────────
// Ambiguous — could be standalone snack OR a spread. Send to admin review.

const MEDIUM_PATTERNS: Pattern[] = [
  { name: 'hummus', category: 'spread',
    regex: /^(hummus|humus)\b/ },
  { name: 'guacamole', category: 'spread',
    regex: /^guacamole\b/ },
  { name: 'twarozek', category: 'spread',
    regex: /^twarozek\b/ },
  { name: 'pasztet', category: 'spread',
    regex: /^pasztet\b/ },
  { name: 'salsa', category: 'sauce-glaze',
    regex: /^salsa\b/ },
  { name: 'tzatziki', category: 'spread',
    regex: /^tzatziki\b/ },
  { name: 'dip', category: 'sauce-glaze',
    regex: /^dip\b/ },
  { name: 'aioli', category: 'sauce-glaze',
    regex: /^aioli\b/ },
  { name: 'tapenada', category: 'spread',
    regex: /^(tapenada|tapenade)\b/ },
  { name: 'chimichurri', category: 'sauce-glaze',
    regex: /^chimichurri\b/ },
  { name: 'harissa', category: 'sauce-glaze',
    regex: /^harissa\b/ },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  title: string;
  normalizedTitle: string;
  currentMealType: string;
  matchedPattern: string;
  category: string;
  tier: 'HIGH' | 'MEDIUM';
}

// ─── Main scan ────────────────────────────────────────────────────────────────

async function scan(): Promise<Candidate[]> {
  const recipes = await prisma.recipe.findMany({
    where: {
      isActive: true,
      source: { in: ['imported', 'manual'] },
      // Skip recipes already correctly tagged.
      mealType: { notIn: ['SAUCE', 'SIDE_DISH'] },
    },
    select: { id: true, title: true, mealType: true },
  });

  const candidates: Candidate[] = [];

  for (const r of recipes) {
    const normalized = normalizeProductName(r.title);

    // Hard exclusion check first — if any exclusion fires, skip entirely.
    if (FULL_MEAL_EXCLUSIONS.some((re) => re.test(normalized))) {
      continue;
    }

    // Try HIGH patterns first
    let matched = false;
    for (const p of HIGH_PATTERNS) {
      if (p.regex.test(normalized)) {
        candidates.push({
          id: r.id,
          title: r.title,
          normalizedTitle: normalized,
          currentMealType: r.mealType,
          matchedPattern: p.name,
          category: p.category,
          tier: 'HIGH',
        });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Try MEDIUM patterns
    for (const p of MEDIUM_PATTERNS) {
      if (p.regex.test(normalized)) {
        candidates.push({
          id: r.id,
          title: r.title,
          normalizedTitle: normalized,
          currentMealType: r.mealType,
          matchedPattern: p.name,
          category: p.category,
          tier: 'MEDIUM',
        });
        break;
      }
    }
  }

  return candidates;
}

// ─── Apply HIGH ──────────────────────────────────────────────────────────────

async function applyHigh(candidates: Candidate[]): Promise<number> {
  const high = candidates.filter((c) => c.tier === 'HIGH');
  let updated = 0;

  for (const c of high) {
    await prisma.$transaction([
      prisma.recipe.update({
        where: { id: c.id },
        data: { mealType: 'SAUCE' },
      }),
      prisma.auditLog.create({
        data: {
          action: 'RECLASSIFY_COMPONENT',
          resourceType: 'RECIPE',
          resourceId: c.id,
          metadata: {
            from: c.currentMealType,
            to: 'SAUCE',
            pattern: c.matchedPattern,
            category: c.category,
            title: c.title,
          },
        },
      }),
    ]);

    updated++;
    if (updated % 20 === 0) {
      console.log(`  Updated ${updated}/${high.length}...`);
    }
  }

  return updated;
}

// ─── Apply MEDIUM (write to review queue) ───────────────────────────────────

async function applyMedium(candidates: Candidate[]): Promise<number> {
  const medium = candidates.filter((c) => c.tier === 'MEDIUM');
  if (medium.length === 0) return 0;

  // Skip already-recorded issues for the same recipes
  const existing = await prisma.dataQualityIssue.findMany({
    where: {
      entityType: 'Recipe',
      issueCode: 'RECIPE_POSSIBLE_COMPONENT',
      isResolved: false,
      entityId: { in: medium.map((c) => c.id) },
    },
    select: { entityId: true },
  });
  const existingIds = new Set(existing.map((e) => e.entityId));

  const toCreate = medium.filter((c) => !existingIds.has(c.id));

  if (toCreate.length === 0) return 0;

  await prisma.dataQualityIssue.createMany({
    data: toCreate.map((c) => ({
      entityType: 'Recipe',
      entityId: c.id,
      field: 'mealType',
      severity: 'WARNING',
      issueCode: 'RECIPE_POSSIBLE_COMPONENT',
      description: `"${c.title}" — niejednoznaczne (${c.matchedPattern}): może być komponentem (sos/spread) lub samodzielną przekąską. Obecny mealType: ${c.currentMealType}`,
      suggestedFix: `Zdecyduj czy zmienić mealType na SAUCE/SIDE_DISH (komponent), zostawić jako ${c.currentMealType} (samodzielny posiłek), lub przepisać tytuł jednoznacznie`,
      isResolved: false,
    })),
  });

  return toCreate.length;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Faza A.2 v2: Reclassify component recipes (multi-tier) ===');
  console.log(`Mode: ${APPLY ? 'LIVE (writes)' : 'DRY RUN'}`);
  if (SKIP_MEDIUM) console.log('Skipping MEDIUM tier (--skip-medium)');
  console.log('');

  const candidates = await scan();

  const high = candidates.filter((c) => c.tier === 'HIGH');
  const medium = candidates.filter((c) => c.tier === 'MEDIUM');

  console.log(`HIGH confidence (auto-reclassify):  ${high.length}`);
  console.log(`MEDIUM confidence (review queue):   ${medium.length}\n`);

  if (high.length > 0) {
    // HIGH — by category
    console.log('--- HIGH by category ---');
    const byCat = new Map<string, number>();
    for (const c of high) byCat.set(c.category, (byCat.get(c.category) ?? 0) + 1);
    for (const [k, n] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(15)} → ${n}`);
    }

    // HIGH — by pattern
    console.log('\n--- HIGH by pattern ---');
    const byPat = new Map<string, number>();
    for (const c of high) byPat.set(c.matchedPattern, (byPat.get(c.matchedPattern) ?? 0) + 1);
    for (const [k, n] of [...byPat.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(28)} → ${n}`);
    }

    // HIGH — full sample
    console.log('\n--- HIGH (full list) ---');
    for (const c of high) {
      console.log(`  [${c.matchedPattern.padEnd(22)}] ${c.currentMealType.padEnd(18)} → SAUCE  ${c.title}`);
    }
  }

  if (medium.length > 0) {
    console.log('\n--- MEDIUM by pattern ---');
    const byPat = new Map<string, number>();
    for (const c of medium) byPat.set(c.matchedPattern, (byPat.get(c.matchedPattern) ?? 0) + 1);
    for (const [k, n] of [...byPat.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(15)} → ${n}`);
    }

    console.log('\n--- MEDIUM sample (first 30) ---');
    for (const c of medium.slice(0, 30)) {
      console.log(`  [${c.matchedPattern.padEnd(15)}] ${c.currentMealType.padEnd(18)}  ${c.title}`);
    }
  }

  if (!APPLY) {
    console.log('\n(dry-run — pass --apply to write)\n');
    console.log('  --apply              → reclassify HIGH + write MEDIUM to review queue');
    console.log('  --apply --skip-medium → reclassify HIGH only\n');
    return;
  }

  console.log('\nApplying HIGH-confidence reclassifications...');
  const highUpdated = await applyHigh(candidates);
  console.log(`Reclassified ${highUpdated} recipes to mealType=SAUCE.`);

  if (!SKIP_MEDIUM) {
    console.log('\nWriting MEDIUM-confidence to review queue (DataQualityIssue)...');
    const mediumWritten = await applyMedium(candidates);
    console.log(`Wrote ${mediumWritten} new RECIPE_POSSIBLE_COMPONENT issues.`);
  }

  console.log('\nDone.\n');
}

main()
  .catch((err) => { console.error('FAILED:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
