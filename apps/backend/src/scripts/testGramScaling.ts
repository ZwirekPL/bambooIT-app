/**
 * Live test: smart gram scaling on a real diet plan from the database.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/testGramScaling.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../../.env' });

import { prisma } from '@db';
import { decryptJson } from '../utils/encryption';
import { computeNutritionFromIngredients, isV2Plan } from '../services/nutritionCalculator.service';
import { smartScaleContent } from '../services/gramScaling.service';
import type { PlanContent, PlanDay } from '../services/planValidation.service';

function dayKcal(day: PlanDay): number {
  let total = 0;
  for (const meal of day.meals) {
    for (const item of meal.items) {
      total += item.kcal || 0;
    }
  }
  return Math.round(total);
}

function dayMacros(day: PlanDay) {
  let protein = 0, fat = 0, carbs = 0;
  for (const meal of day.meals) {
    for (const item of meal.items) {
      protein += item.protein || 0;
      fat += item.fat || 0;
      carbs += item.carbs || 0;
    }
  }
  return { protein: Math.round(protein), fat: Math.round(fat), carbs: Math.round(carbs) };
}

async function main() {
  // Find the most recent GENERATED plan with content
  // Accept optional plan ID from command line
  const planIdArg = process.argv[2];
  const skipCount = parseInt(process.argv[3] ?? '0', 10);
  const plan = planIdArg
    ? await prisma.dietPlan.findUnique({ where: { id: planIdArg } })
    : await prisma.dietPlan.findFirst({
        where: {
          status: { in: ['GENERATED', 'REVIEWED', 'PUBLISHED', 'SENT'] },
          content: { not: undefined },
        },
        orderBy: { createdAt: 'desc' },
        skip: skipCount,
      });

  if (!plan) {
    console.log('❌ Brak planu w bazie danych.');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n📋 Plan: ${plan.id}`);
  console.log(`   Status: ${plan.status}, Model: ${plan.aiModel}`);
  console.log(`   Utworzony: ${plan.createdAt.toISOString()}`);
  console.log(`   Pacjent: ${plan.patientId}`);

  // Fetch nutrition targets separately
  const nutritionTargets = await prisma.nutritionTargets.findFirst({
    where: { patientId: plan.patientId },
    orderBy: { createdAt: 'desc' },
  });
  const targetKcal = nutritionTargets?.targetKcal ?? plan.kcal ?? 0;
  const targetProtein = nutritionTargets?.targetProteinG ?? 0;
  const targetFat = nutritionTargets?.targetFatG ?? 0;
  const targetCarbs = nutritionTargets?.targetCarbsG ?? 0;
  console.log(`   Target: ${targetKcal} kcal | B ${targetProtein}g | T ${targetFat}g | W ${targetCarbs}g`);

  // Decrypt content
  const content = decryptJson(plan.content) as PlanContent;
  if (!content?.days?.length) {
    console.log('❌ Plan nie ma danych days.');
    await prisma.$disconnect();
    return;
  }

  console.log(`   Dni: ${content.days.length}`);
  // Check if plan has ingredients at all (V2 or V2+kcal)
  const firstItem = content.days[0]?.meals?.[0]?.items?.[0] as unknown as Record<string, unknown> | undefined;
  const hasIngredients = Array.isArray(firstItem?.ingredients) && (firstItem.ingredients as unknown[]).length > 0;
  console.log(`   Has ingredients: ${hasIngredients}`);

  // Step 1: Always compute nutrition from ingredients to get nutrientMap
  let enrichedContent = content;
  let nutrientMap: Map<string, { kcalPer100g: number; proteinPer100g: number; fatPer100g: number; carbsPer100g: number }>;

  if (hasIngredients) {
    console.log('\n🔬 Obliczanie wartości odżywczych z bazy CleanProduct...');
    const result = await computeNutritionFromIngredients(content);
    enrichedContent = result.enrichedContent;
    nutrientMap = result.nutrientMap;
    console.log(`   Matched: ${result.report.matchedCount}/${result.report.totalIngredients}`);
    console.log(`   Fallback: ${result.report.fallbackCount}, Unknown: ${result.report.unmatchedCount}`);
    if (result.report.unmatchedNames.length > 0) {
      console.log(`   Unmatched: ${result.report.unmatchedNames.slice(0, 10).join(', ')}`);
    }
  } else {
    nutrientMap = new Map();
    console.log('\n⚠️  Plan bez ingredients — smart scaling niedostępny.');
  }

  // Step 2: Show BEFORE
  console.log('\n' + '═'.repeat(80));
  console.log('  PRZED skalowaniem (po computeNutrition):');
  console.log('═'.repeat(80));
  const tolerance = 0.10;
  let daysInRange = 0;
  for (const day of enrichedContent.days) {
    const kcal = dayKcal(day);
    const macros = dayMacros(day);
    const diff = targetKcal > 0 ? ((kcal - targetKcal) / targetKcal * 100) : 0;
    const inRange = Math.abs(diff) <= tolerance * 100;
    if (inRange) daysInRange++;
    const mark = inRange ? '✅' : '❌';
    console.log(`  ${mark} ${day.day.padEnd(14)} ${String(kcal).padStart(5)} kcal (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%)  B ${String(macros.protein).padStart(3)}g  T ${String(macros.fat).padStart(3)}g  W ${String(macros.carbs).padStart(3)}g`);
  }
  console.log(`  Dni w zakresie ±${tolerance * 100}%: ${daysInRange}/${enrichedContent.days.length}`);

  // Step 3: Smart scale
  if (targetKcal <= 0) {
    console.log('\n❌ Brak target kcal — nie mogę skalować.');
    await prisma.$disconnect();
    return;
  }

  console.log('\n🔧 Uruchamiam smartScaleContent...');
  const { scaledContent, report } = smartScaleContent(enrichedContent, nutrientMap, {
    targetKcal,
    tolerance: 0.05,
  });

  // Step 4: Show AFTER
  console.log('\n' + '═'.repeat(80));
  console.log('  PO skalowaniu:');
  console.log('═'.repeat(80));
  let daysInRangeAfter = 0;
  for (const day of scaledContent.days) {
    const kcal = dayKcal(day);
    const macros = dayMacros(day);
    const diff = ((kcal - targetKcal) / targetKcal * 100);
    const inRange = Math.abs(diff) <= tolerance * 100;
    if (inRange) daysInRangeAfter++;
    const mark = inRange ? '✅' : '⚠️';
    console.log(`  ${mark} ${day.day.padEnd(14)} ${String(kcal).padStart(5)} kcal (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%)  B ${String(macros.protein).padStart(3)}g  T ${String(macros.fat).padStart(3)}g  W ${String(macros.carbs).padStart(3)}g`);
  }
  console.log(`  Dni w zakresie ±${tolerance * 100}%: ${daysInRangeAfter}/${scaledContent.days.length}`);

  // Step 5: Summary
  console.log('\n' + '═'.repeat(80));
  console.log('  RAPORT SKALOWANIA:');
  console.log('═'.repeat(80));
  console.log(`  Dni skalowanych: ${report.daysScaled}`);
  console.log(`  Dni pominiętych: ${report.daysSkipped}`);
  console.log(`  Poprawa: ${daysInRange}/${enrichedContent.days.length} → ${daysInRangeAfter}/${scaledContent.days.length} dni w zakresie`);

  for (const d of report.details) {
    if (d.originalKcal !== d.finalKcal) {
      console.log(`  📊 ${d.day}: ${d.originalKcal} → ${d.finalKcal} kcal (${d.scaledIngredients} składników, ${d.fixedIngredients} fixed, ${d.iterations} iter)`);
    }
  }

  // Step 6: Show ingredient changes for first scaled day
  const firstScaledDetail = report.details.find((d) => d.originalKcal !== d.finalKcal);
  if (firstScaledDetail) {
    const dayName = firstScaledDetail.day;
    const origDay = enrichedContent.days.find((d) => d.day === dayName);
    const scaledDay = scaledContent.days.find((d) => d.day === dayName);
    if (origDay && scaledDay) {
      console.log(`\n  📝 Szczegóły zmian dla ${dayName}:`);
      for (let m = 0; m < origDay.meals.length; m++) {
        const origMeal = origDay.meals[m];
        const scaledMeal = scaledDay.meals[m];
        if (!origMeal || !scaledMeal) continue;
        console.log(`     ${origMeal.name}:`);
        for (let i = 0; i < origMeal.items.length; i++) {
          const origItem = origMeal.items[i];
          const scaledItem = scaledMeal.items[i];
          if (!origItem?.ingredients || !scaledItem?.ingredients) continue;
          console.log(`       ${origItem.name}: ${origItem.kcal} → ${scaledItem.kcal} kcal`);
          for (let j = 0; j < origItem.ingredients.length; j++) {
            const origIng = origItem.ingredients[j];
            const scaledIng = scaledItem.ingredients[j];
            if (!origIng || !scaledIng) continue;
            if (origIng.grams !== scaledIng.grams) {
              console.log(`         ${origIng.name}: ${origIng.grams}g → ${scaledIng.grams}g`);
            }
          }
        }
      }
    }
  }

  console.log('\n✅ Test zakończony.\n');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Błąd:', err);
  prisma.$disconnect();
  process.exit(1);
});
