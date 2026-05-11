/**
 * Enrich Recipe.cookingMethod from instructionSteps text analysis.
 *
 * Parses recipe instructions to detect the primary cooking method.
 * Priority: the method that appears most often or in the last step wins.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/enrich-cooking-method.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/enrich-cooking-method.ts --dry-run
 */

import { prisma } from '@db';

const DRY_RUN = process.argv.includes('--dry-run');

type CookingMethod = 'BAKED' | 'BOILED' | 'FRIED' | 'GRILLED' | 'STEAMED' | 'RAW' | 'OTHER';

const METHOD_PATTERNS: Array<{ method: CookingMethod; patterns: RegExp[] }> = [
  { method: 'FRIED', patterns: [/smaż/i, /podsmaż/i, /obsmaż/i, /frytur/i, /panieruj/i, /na patelni/i, /pan-fr/i, /stir.?fry/i, /przesmaż/i] },
  { method: 'BAKED', patterns: [/piecz/i, /upiecz/i, /zapiecz/i, /zapiekaj/i, /piekarni[ck]/i, /do piekarnika/i, /w piekarniku/i, /170°|180°|190°|200°|220°/] },
  { method: 'BOILED', patterns: [/gotuj/i, /ugotuj/i, /zagotuj/i, /odcedź/i, /w wodzie/i, /na wolnym ogniu/i, /dusz/i, /podgrzej/i, /w garnku/i] },
  { method: 'GRILLED', patterns: [/grilluj/i, /grill/i, /opiekaj na ruszcie/i, /z grilla/i, /na ruszcie/i] },
  { method: 'STEAMED', patterns: [/gotuj na parze/i, /na parze/i, /paruj/i, /parowar/i, /steamer/i] },
  { method: 'RAW', patterns: [/surowy|surowe|surowa/i, /bez gotowania/i, /na surowo/i, /sałatk[aię]/i, /smoothie/i, /koktajl/i] },
];

function detectCookingMethod(instructions: string[]): CookingMethod {
  const text = instructions.join(' ');
  const scores = new Map<CookingMethod, number>();

  for (const { method, patterns } of METHOD_PATTERNS) {
    let count = 0;
    for (const p of patterns) {
      const matches = text.match(new RegExp(p.source, 'gi'));
      if (matches) count += matches.length;
    }
    if (count > 0) scores.set(method, count);
  }

  if (scores.size === 0) return 'OTHER';

  // Return method with highest count
  let best: CookingMethod = 'OTHER';
  let bestScore = 0;
  for (const [method, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = method;
    }
  }
  return best;
}

async function main() {
  console.log(`\n=== Cooking Method Enrichment ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  const recipes = await prisma.recipe.findMany({
    where: { cookingMethod: null, isActive: true },
    select: {
      id: true,
      title: true,
      instructionSteps: {
        select: { instruction: true },
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  console.log(`Recipes without cookingMethod: ${recipes.length}`);

  const updates: Array<{ id: string; title: string; method: CookingMethod }> = [];

  for (const recipe of recipes) {
    const instructions = recipe.instructionSteps.map((s) => s.instruction);
    if (instructions.length === 0) continue;
    const method = detectCookingMethod(instructions);
    updates.push({ id: recipe.id, title: recipe.title, method });
  }

  // Distribution
  const dist = new Map<string, number>();
  for (const u of updates) dist.set(u.method, (dist.get(u.method) ?? 0) + 1);
  console.log('\n--- Method Distribution ---');
  for (const [method, cnt] of [...dist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${method.padEnd(10)} ${cnt}`);
  }

  // Samples
  console.log('\n--- Samples per method ---');
  for (const method of ['FRIED', 'BAKED', 'BOILED', 'GRILLED', 'STEAMED', 'RAW']) {
    const sample = updates.filter((u) => u.method === method).slice(0, 3);
    for (const s of sample) {
      console.log(`  [${method}] ${s.title}`);
    }
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] No changes made.\n`);
    return;
  }

  console.log(`\nApplying ${updates.length} updates...`);
  const BATCH = 100;
  let applied = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((u) => prisma.recipe.update({ where: { id: u.id }, data: { cookingMethod: u.method } })),
    );
    applied += batch.length;
    if (applied % 500 === 0 || applied === updates.length) console.log(`  ${applied} / ${updates.length}`);
  }

  console.log(`\nDone! Updated ${applied} recipes.\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
