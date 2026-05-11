/**
 * Faza A.2 — Discovery (read-only) — Analyze recipe database to identify
 * potential "component" recipes (sauces, marinades, fillings, doughs, spreads,
 * dips, glazes, side accompaniments) that are mistakenly tagged as full meals.
 *
 * This script writes NOTHING. It produces a multi-angle report so we can
 * design comprehensive reclassification patterns based on actual data.
 *
 * Reports produced:
 *   1. Top title prefixes (first 1-2 words) — distribution of all recipes
 *   2. Low-kcal anomalies — recipes in main meal slots with kcal < 150/serving
 *   3. Classifier disagreements — classifyMealType() says SAUCE/SIDE_DISH/DRINK
 *      but current mealType is BREAKFAST/LUNCH/DINNER/SECOND_BREAKFAST/SUPPER
 *   4. Prepositional patterns — "X do Y", "X na Y", "X pod Y" where Y is
 *      a component-context noun
 *   5. Already-tagged components — count of mealType IN (SAUCE,SIDE_DISH,DRINK)
 *      to know baseline
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/discover-component-recipes.ts
 */

import { prisma } from '@db';
import { normalizeProductName } from '../scraper/utils/productMatcher';
import { classifyMealType } from '../scraper/utils/recipeClassifier';

const FULL_MEAL_TYPES = new Set([
  'BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'DINNER', 'SUPPER',
]);

const COMPONENT_TYPES = new Set(['SAUCE', 'SIDE_DISH', 'DRINK']);

// Suspicious prefixes — recipes whose normalized title starts with one of these
// are worth manual scrutiny. List harvested from common Polish recipe vocabulary
// for sauces, spreads, doughs, fillings, glazes, marinades, dips.
const SUSPICIOUS_PREFIXES = [
  // sauces
  'sos', 'dressing', 'dip', 'salsa', 'pesto', 'aioli', 'majonez', 'musztarda',
  'ketchup', 'tapenada', 'tapenade', 'chutney', 'chimichurri', 'harissa',
  'gremolata', 'romesco', 'tzatziki', 'humus', 'hummus', 'guacamole',
  'winegret', 'vinaigrette',
  // spreads / pastes
  'pasta', 'smalec', 'twarozek', 'past', 'spread', 'krem',
  // doughs / bases
  'ciasto', 'baza', 'spod', 'spod ',
  // fillings / toppings
  'farsz', 'nadzienie', 'panierka', 'polewa', 'glazura', 'lukier', 'posypka',
  'topping', 'dekoracja',
  // marinades
  'marynata', 'zalewa', 'zaprawa',
  // small-portion stocks
  'bulion', 'wywar', 'fond',
  // controversial — flag for review
  'masło', 'maslo', 'oliwa', 'oliwa smakowa',
];

// Component-context nouns — things a component is "for" (do/na/pod X)
const COMPONENT_TARGETS = [
  'kanapek', 'kanapk', 'pizz', 'pierog', 'naleśnik', 'nalesnik',
  'makaron', 'salatk', 'salatki', 'chleba', 'tost', 'tostow',
  'kurczak', 'mięs', 'mies', 'rybi', 'ryb', 'warzyw',
  'ciasta', 'tortu', 'pączk', 'paczk', 'krokiet', 'klusek',
  'ryżu', 'ryzu', 'kasz', 'ziemniak',
];

function getPrefix(normalized: string): string {
  const words = normalized.split(/\s+/);
  return words.slice(0, 2).join(' ');
}

function getFirstWord(normalized: string): string {
  return normalized.split(/\s+/)[0] ?? '';
}

interface RecipeRow {
  id: string;
  title: string;
  mealType: string;
  servings: number;
  kcalPerServing: number | null;
}

async function main() {
  console.log('\n=== Discovery: Component recipes audit (read-only) ===\n');

  const recipes = await prisma.recipe.findMany({
    where: { isActive: true, source: { in: ['imported', 'manual'] } },
    select: {
      id: true,
      title: true,
      mealType: true,
      servings: true,
      nutritionSnapshot: { select: { kcal: true } },
    },
  });

  const rows: RecipeRow[] = recipes.map((r) => ({
    id: r.id,
    title: r.title,
    mealType: r.mealType,
    servings: r.servings,
    kcalPerServing: r.nutritionSnapshot ? Number(r.nutritionSnapshot.kcal) : null,
  }));

  console.log(`Total active human-curated recipes: ${rows.length}\n`);

  // ─── Report 0: Baseline mealType distribution ───────────────────────────
  console.log('--- Report 0: Current mealType distribution ---');
  const mealHist = new Map<string, number>();
  for (const r of rows) {
    mealHist.set(r.mealType, (mealHist.get(r.mealType) ?? 0) + 1);
  }
  for (const [m, n] of [...mealHist.entries()].sort((a, b) => b[1] - a[1])) {
    const flag = COMPONENT_TYPES.has(m) ? '  [COMPONENT]' : FULL_MEAL_TYPES.has(m) ? '  [full meal]' : '';
    console.log(`  ${m.padEnd(20)} → ${String(n).padStart(5)}${flag}`);
  }

  // ─── Report 1: Top title prefixes ───────────────────────────────────────
  console.log('\n--- Report 1: Top first-word prefixes (top 40) ---');
  const prefixHist = new Map<string, number>();
  for (const r of rows) {
    const first = getFirstWord(normalizeProductName(r.title));
    prefixHist.set(first, (prefixHist.get(first) ?? 0) + 1);
  }
  const topPrefixes = [...prefixHist.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);
  for (const [p, n] of topPrefixes) {
    const flag = SUSPICIOUS_PREFIXES.includes(p) ? '  ★ SUSPICIOUS' : '';
    console.log(`  ${p.padEnd(20)} → ${String(n).padStart(4)}${flag}`);
  }

  // ─── Report 2: Suspicious prefix matches ─────────────────────────────────
  console.log('\n--- Report 2: Recipes matching SUSPICIOUS first words ---');
  const suspiciousByPrefix = new Map<string, RecipeRow[]>();
  for (const r of rows) {
    const first = getFirstWord(normalizeProductName(r.title));
    if (SUSPICIOUS_PREFIXES.includes(first)) {
      if (!suspiciousByPrefix.has(first)) suspiciousByPrefix.set(first, []);
      suspiciousByPrefix.get(first)!.push(r);
    }
  }
  const suspiciousTotal = [...suspiciousByPrefix.values()].reduce((s, arr) => s + arr.length, 0);
  console.log(`Total: ${suspiciousTotal} recipes\n`);
  for (const [prefix, list] of [...suspiciousByPrefix.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const inComponent = list.filter((r) => COMPONENT_TYPES.has(r.mealType)).length;
    const inFullMeal = list.filter((r) => FULL_MEAL_TYPES.has(r.mealType)).length;
    const inOther = list.length - inComponent - inFullMeal;
    console.log(`  ${prefix.padEnd(20)} ${String(list.length).padStart(4)}  (component: ${inComponent}, full-meal: ${inFullMeal}, other: ${inOther})`);
  }

  // ─── Report 3: Low-kcal anomalies ───────────────────────────────────────
  console.log('\n--- Report 3: Low kcal/serving in main meal slots (<150 kcal) ---');
  const lowKcal = rows.filter((r) =>
    FULL_MEAL_TYPES.has(r.mealType)
    && r.kcalPerServing !== null
    && r.kcalPerServing > 0
    && r.kcalPerServing < 150
  );
  console.log(`Total: ${lowKcal.length} recipes\n`);
  console.log('Sample (first 25):');
  for (const r of lowKcal.slice(0, 25)) {
    console.log(`  [${r.mealType.padEnd(18)} | ${String(Math.round(r.kcalPerServing!)).padStart(3)} kcal/serv]  ${r.title}`);
  }

  // ─── Report 4: Classifier disagreements ─────────────────────────────────
  console.log('\n--- Report 4: classifyMealType() says component, current is full meal ---');
  const disagreements: Array<RecipeRow & { classifierType: string; classifierConfidence: string }> = [];
  for (const r of rows) {
    if (!FULL_MEAL_TYPES.has(r.mealType)) continue;
    const report = classifyMealType(r.title, r.kcalPerServing);
    if (COMPONENT_TYPES.has(report.mealType)) {
      disagreements.push({
        ...r,
        classifierType: report.mealType,
        classifierConfidence: report.confidence,
      });
    }
  }
  console.log(`Total: ${disagreements.length} recipes\n`);
  console.log('Sample (first 30):');
  for (const r of disagreements.slice(0, 30)) {
    console.log(`  [${r.mealType.padEnd(18)} → ${r.classifierType.padEnd(10)} ${r.classifierConfidence}]  ${r.title}`);
  }

  // Group disagreements by reason
  console.log('\nDisagreements by classifier output:');
  const byType = new Map<string, number>();
  for (const r of disagreements) {
    const key = `${r.classifierType} (${r.classifierConfidence})`;
    byType.set(key, (byType.get(key) ?? 0) + 1);
  }
  for (const [k, n] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(28)} → ${n}`);
  }

  // ─── Report 5: Prepositional pattern "X do Y" / "X na Y" / "X pod Y" ────
  console.log('\n--- Report 5: Recipes with "X do/na/pod Y" where Y is a component target ---');
  const targetRe = new RegExp(`\\b(do|na|pod)\\s+(${COMPONENT_TARGETS.join('|')})\\w*`);
  const prepoMatches = rows.filter((r) => targetRe.test(normalizeProductName(r.title)));
  console.log(`Total: ${prepoMatches.length} recipes\n`);
  console.log('Sample (first 30):');
  for (const r of prepoMatches.slice(0, 30)) {
    console.log(`  [${r.mealType.padEnd(18)}]  ${r.title}`);
  }

  // ─── Report 6: Cross-section — strong signals (multiple flags) ──────────
  console.log('\n--- Report 6: HIGH-CONFIDENCE candidates (≥2 signals: low kcal + classifier + prepo) ---');
  const highConfidence: RecipeRow[] = [];
  for (const r of rows) {
    if (!FULL_MEAL_TYPES.has(r.mealType)) continue;
    let signals = 0;

    // Signal 1: classifier says component
    const cls = classifyMealType(r.title, r.kcalPerServing);
    if (COMPONENT_TYPES.has(cls.mealType) && cls.confidence === 'HIGH') signals++;

    // Signal 2: low kcal
    if (r.kcalPerServing !== null && r.kcalPerServing > 0 && r.kcalPerServing < 150) signals++;

    // Signal 3: prepositional pattern
    if (targetRe.test(normalizeProductName(r.title))) signals++;

    // Signal 4: suspicious prefix
    const first = getFirstWord(normalizeProductName(r.title));
    if (SUSPICIOUS_PREFIXES.includes(first)) signals++;

    if (signals >= 2) highConfidence.push(r);
  }
  console.log(`Total: ${highConfidence.length} recipes\n`);
  for (const r of highConfidence.slice(0, 30)) {
    console.log(`  [${r.mealType.padEnd(18)} | ${r.kcalPerServing ? String(Math.round(r.kcalPerServing)).padStart(4) + ' kcal' : '   no kcal'}]  ${r.title}`);
  }

  console.log('\n=== End of discovery ===\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
