/**
 * Integration test — DB-first diet generation with real data.
 * Run: npx ts-node --esm scripts/test-db-diet.ts
 */
import { prisma } from '../packages/database/dist/index.js';

// We can't import TS services directly, so we'll test the core queries manually

async function main() {
  console.log('=== DB-FIRST DIET GENERATION — INTEGRATION TEST ===\n');

  // 1. Check recipe pool
  const totalRecipes = await prisma.recipe.count({ where: { isActive: true, source: { in: ['imported', 'manual'] } } });
  console.log(`Przepisów w puli (imported+manual, active): ${totalRecipes}`);

  if (totalRecipes === 0) {
    console.error('BRAK PRZEPISÓW! DB-first nie zadziała.');
    return;
  }

  // 2. Check nutrition snapshots
  const withSnapshot = await prisma.recipe.count({
    where: { isActive: true, source: { in: ['imported', 'manual'] }, nutritionSnapshot: { isNot: null } },
  });
  const withoutSnapshot = totalRecipes - withSnapshot;
  console.log(`  Z snapshotem odżywczym: ${withSnapshot} (${(withSnapshot/totalRecipes*100).toFixed(0)}%)`);
  console.log(`  Bez snapshotu: ${withoutSnapshot}`);

  // 3. Check per mealType coverage
  console.log('\nPokrycie per mealType:');
  const mealTypes = ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'DINNER', 'SUPPER', 'SNACK', 'DESSERT', 'DRINK', 'SAUCE', 'SIDE_DISH'];
  for (const mt of mealTypes) {
    const count = await prisma.recipe.count({
      where: {
        isActive: true,
        source: { in: ['imported', 'manual'] },
        mealType: mt as any,
        nutritionSnapshot: { isNot: null },
      },
    });
    const emoji = count >= 20 ? '✅' : count >= 5 ? '⚠️' : '❌';
    console.log(`  ${emoji} ${mt}: ${count} przepisów`);
  }

  // 4. Simulate a candidate query for each main meal type
  console.log('\nSymulacja zapytań kandydatów (target: 2000 kcal/dzień, 5 posiłków):');
  const targets = [
    { mealType: 'BREAKFAST', kcal: 500, label: 'Śniadanie (500 kcal)' },
    { mealType: 'SNACK', kcal: 200, label: 'Drugie śniadanie (200 kcal)' },
    { mealType: 'LUNCH', kcal: 700, label: 'Obiad (700 kcal)' },
    { mealType: 'SNACK', kcal: 200, label: 'Podwieczorek (200 kcal)' },
    { mealType: 'DINNER', kcal: 400, label: 'Kolacja (400 kcal)' },
  ];

  let totalCandidates = 0;
  for (const t of targets) {
    const tolerance = 0.30;
    const minKcal = Math.round(t.kcal * (1 - tolerance));
    const maxKcal = Math.round(t.kcal * (1 + tolerance));

    const candidates = await prisma.recipe.findMany({
      where: {
        isActive: true,
        source: { in: ['imported', 'manual'] },
        mealType: t.mealType as any,
        nutritionSnapshot: {
          kcal: { gte: minKcal, lte: maxKcal },
        },
      },
      select: {
        id: true,
        title: true,
        nutritionSnapshot: { select: { kcal: true, protein_g: true, fat_g: true, carbs_g: true } },
      },
      take: 10,
      orderBy: { qualityScore: 'desc' },
    });

    const emoji = candidates.length >= 5 ? '✅' : candidates.length >= 1 ? '⚠️' : '❌';
    console.log(`  ${emoji} ${t.label} (${minKcal}-${maxKcal} kcal): ${candidates.length} kandydatów`);
    if (candidates.length > 0) {
      const top = candidates[0];
      const snap = top.nutritionSnapshot;
      console.log(`     Top: "${top.title}" — ${Number(snap?.kcal ?? 0).toFixed(0)} kcal, B:${Number(snap?.protein_g ?? 0).toFixed(0)}g, T:${Number(snap?.fat_g ?? 0).toFixed(0)}g, W:${Number(snap?.carbs_g ?? 0).toFixed(0)}g`);
    }
    totalCandidates += candidates.length;
  }

  // 5. Check ingredient matching (how many ingredients have cleanProductId)
  console.log('\nDopasowanie składników do produktów:');
  const totalIngredients = await prisma.recipeIngredient.count({
    where: { recipe: { isActive: true, source: { in: ['imported', 'manual'] } } },
  });
  const matchedIngredients = await prisma.recipeIngredient.count({
    where: {
      recipe: { isActive: true, source: { in: ['imported', 'manual'] } },
      OR: [
        { cleanProductId: { not: null } },
        { foodProductId: { not: null } },
      ],
    },
  });
  console.log(`  Łącznie: ${totalIngredients}, Dopasowanych: ${matchedIngredients} (${(matchedIngredients/totalIngredients*100).toFixed(1)}%)`);

  // 6. Check if any patient has nutrition targets
  const patientsWithTargets = await prisma.nutritionTargets.count();
  console.log(`\nPacjentów z NutritionTargets: ${patientsWithTargets}`);

  if (patientsWithTargets > 0) {
    const sample = await prisma.nutritionTargets.findFirst({
      include: { patient: { select: { firstName: true, userId: true } } },
    });
    if (sample) {
      console.log(`  Przykład: ${sample.patient.firstName ?? 'Anonim'} — ${sample.targetKcal} kcal, B:${sample.targetProteinG}g, T:${sample.targetFatG}g, W:${sample.targetCarbsG}g`);
    }
  }

  // 7. Verdict
  console.log('\n=== WERDYKT ===');
  const issues: string[] = [];
  if (totalRecipes < 100) issues.push(`Za mało przepisów (${totalRecipes}, potrzeba min ~100)`);
  if (withoutSnapshot > totalRecipes * 0.1) issues.push(`${withoutSnapshot} przepisów bez snapshotu odżywczego`);
  if (totalCandidates < 15) issues.push(`Za mało kandydatów na posiłki (${totalCandidates}/50 slotów)`);
  if (matchedIngredients / totalIngredients < 0.5) issues.push(`Tylko ${(matchedIngredients/totalIngredients*100).toFixed(0)}% składników dopasowanych do produktów`);

  if (issues.length === 0) {
    console.log('✅ DB-first powinno działać poprawnie!');
  } else {
    console.log('⚠️ Problemy do rozwiązania:');
    for (const issue of issues) console.log(`  - ${issue}`);
    console.log('\nDB-first może działać z ograniczeniami. Niektóre sloty mogą zostać puste (pokrycie < 100%).');
  }
}

main()
  .catch(e => { console.error('BŁĄD:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
