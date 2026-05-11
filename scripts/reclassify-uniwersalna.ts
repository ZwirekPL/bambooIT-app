/**
 * Reclassify the 14 active recipes with cuisineType='uniwersalna' to either
 * 'polska' or 'inna' (P0.2 — Recipe Overhaul Master Plan 2026-04-29).
 *
 * Rationale: 'uniwersalna' is being dropped from the cuisine taxonomy in P0.3.
 * Each entry below was hand-classified per the plan rule:
 *   "polish staples → polska, mixed → inna"
 *
 * The mapping is keyed by recipe id and validated against the current title to
 * abort if the underlying recipe was renamed or replaced unexpectedly.
 *
 * Usage:
 *   npx ts-node --esm scripts/reclassify-uniwersalna.ts             # dry-run
 *   npx ts-node --esm scripts/reclassify-uniwersalna.ts --apply     # write
 */

import { prisma } from '../packages/database/dist/index.js';

interface Reclassification {
  id: string;
  expectedTitle: string;
  newCuisine: 'polska' | 'inna';
  rationale: string;
}

// Hand-classified 2026-04-29. Keep alphabetical by title for diffability.
const PLAN: Reclassification[] = [
  { id: 'cmn33rjxj00c0uyu0inutnvtq', expectedTitle: 'Gotowana pierś z kurczaka z kaszą jaglaną i jarmużem', newCuisine: 'polska', rationale: 'kasza jaglana = PL grain staple' },
  { id: 'cmn33rjko004duyu0wpm2ngdu', expectedTitle: 'Jajecznica ze szpinakiem i pomidorem na chlebie',     newCuisine: 'polska', rationale: 'jajecznica = klasyczne PL śniadanie' },
  { id: 'cmn33rjr00066uyu0raireypu', expectedTitle: 'Jogurt naturalny z bananem i pestkami słonecznika',   newCuisine: 'inna',   rationale: 'mixed/generic breakfast' },
  { id: 'cmn33rjd20019uyu0ku74z1iy', expectedTitle: 'Jogurt naturalny z borówkami i pestkami słonecznika', newCuisine: 'inna',   rationale: 'mixed/generic breakfast' },
  { id: 'cmn33rjs90076uyu0dgy7za46', expectedTitle: 'Muesli z jogurtem i borówkami',                       newCuisine: 'inna',   rationale: 'muesli = swiss/german, mixed' },
  { id: 'cmn33rjw200aouyu0iv4mzljl', expectedTitle: 'Muesli z jogurtem i czerwonymi porzeczkami',          newCuisine: 'inna',   rationale: 'muesli = swiss/german, mixed' },
  { id: 'cmn33rjik002muyu0f7aryk4e', expectedTitle: 'Owsianka z bananem i pestkami słonecznika',           newCuisine: 'inna',   rationale: 'banan = non-PL ingredient → mixed' },
  { id: 'cmn33rjt1007uuyu0gi6vjmw0', expectedTitle: 'Owsianka z brzoskwinią i pestkami słonecznika',       newCuisine: 'inna',   rationale: 'brzoskwinia = mixed' },
  { id: 'cmn33rjtt008iuyu0zxojmmup', expectedTitle: 'Pieczony filet z mintaja z ziemniakami i brokułami',  newCuisine: 'polska', rationale: 'mintaj+ziemniaki = klasyczny PL obiad rybny' },
  { id: 'cmn33rjl1004tuyu0nt3bbe6m', expectedTitle: 'Sałatka owocowa z borówkami i brzoskwinią',           newCuisine: 'inna',   rationale: 'fruit salad = generic' },
  { id: 'cmn33rjvb009yuyu0pp2p9p08', expectedTitle: 'Sałatka owocowa z brzoskwinią UFO i bananem',         newCuisine: 'inna',   rationale: 'fruit salad = generic' },
  { id: 'cmn33rji50028uyu0bpiv1prl', expectedTitle: 'Sałatka z tuńczykiem, jajkiem i warzywami',           newCuisine: 'inna',   rationale: 'no PL signature; nicoise-adjacent → mixed' },
  { id: 'cmn33rjtf0087uyu084in3n2a', expectedTitle: 'Smoothie z bananem i borówkami',                      newCuisine: 'inna',   rationale: 'smoothie = US import' },
  { id: 'cmn33rjx500bpuyu0zox4mq2k', expectedTitle: 'Twaróg z borówkami i pestkami słonecznika',           newCuisine: 'polska', rationale: 'twaróg = PL śniadanie staple' },
];

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  console.log('=== Reclassify cuisineType=uniwersalna ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Mode: ${APPLY ? 'APPLY (writes to DB)' : 'DRY-RUN (no writes)'}`);
  console.log(`Targets in plan: ${PLAN.length}\n`);

  // Sanity 1: ensure no other recipe still has cuisineType='uniwersalna'.
  const remainingUniversal = await prisma.recipe.findMany({
    where: { isActive: true, cuisineType: 'uniwersalna' },
    select: { id: true, title: true },
  });
  const planIds = new Set(PLAN.map((p) => p.id));
  const orphans = remainingUniversal.filter((r) => !planIds.has(r.id));
  if (orphans.length > 0) {
    console.log('ABORT: active recipes with cuisineType=uniwersalna outside the plan:');
    orphans.forEach((r) => console.log(`  ${r.id} | ${r.title}`));
    process.exit(2);
  }
  if (remainingUniversal.length !== PLAN.length) {
    console.log(
      `WARN: plan has ${PLAN.length} entries but DB has ${remainingUniversal.length} active uniwersalna recipes. ` +
        `Some plan rows may already be classified.`,
    );
  }

  let polska = 0;
  let inna = 0;
  let skipped = 0;
  let mismatches = 0;

  for (const p of PLAN) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: p.id },
      select: { id: true, title: true, cuisineType: true, isActive: true },
    });
    if (!recipe) {
      console.log(`  [skip] ${p.id} — not found in DB`);
      skipped++;
      continue;
    }
    if (recipe.title !== p.expectedTitle) {
      console.log(`  [MISMATCH] ${p.id}`);
      console.log(`    expected: "${p.expectedTitle}"`);
      console.log(`    actual:   "${recipe.title}"`);
      mismatches++;
      continue;
    }
    if (!recipe.isActive) {
      console.log(`  [skip] ${p.id} — not active`);
      skipped++;
      continue;
    }
    if (recipe.cuisineType === p.newCuisine) {
      console.log(`  [noop] ${p.id} | already '${p.newCuisine}' | ${recipe.title}`);
      skipped++;
      continue;
    }

    console.log(
      `  [${APPLY ? 'apply' : 'plan '}] ${p.id} | ${recipe.cuisineType ?? 'NULL'} → ${p.newCuisine} | ${recipe.title}`,
    );
    console.log(`         reason: ${p.rationale}`);

    if (APPLY) {
      await prisma.recipe.update({
        where: { id: p.id },
        data: { cuisineType: p.newCuisine },
      });
    }

    if (p.newCuisine === 'polska') polska++;
    else inna++;
  }

  if (mismatches > 0) {
    console.log(`\n=== ABORT ===`);
    console.log(`${mismatches} title mismatch(es). DB recipe(s) renamed since plan was authored.`);
    console.log(`Refusing to ${APPLY ? 'write' : 'plan'} updates. Resolve manually before re-running.`);
    process.exit(3);
  }

  console.log(`\n=== Summary ===`);
  console.log(`polska: ${polska}`);
  console.log(`inna:   ${inna}`);
  console.log(`skipped (not found / already classified): ${skipped}`);
  if (!APPLY) console.log('\n(dry-run — re-run with --apply to write)');

  // Post-condition: with --apply, no active uniwersalna recipe should remain.
  if (APPLY) {
    const after = await prisma.recipe.count({
      where: { isActive: true, cuisineType: 'uniwersalna' },
    });
    console.log(`\nPost-apply: active recipes still cuisineType='uniwersalna' = ${after} (expected 0)`);
  }
}

main()
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
