/**
 * Verify GPT output quality for recipes.
 *
 * Scans all active recipes for common GPT failure modes and writes
 * DataQualityIssue records so admins can review/fix them.
 *
 * Issue codes generated:
 *   RECIPE_NO_STEPS             — 0 instruction steps (scrape/GPT failure)
 *   RECIPE_GENERIC_STEPS        — only 1 step with very short text (placeholder)
 *   RECIPE_INCOMPLETE_STEPS     — multiple steps but total text < 200 chars
 *   RECIPE_SHALLOW_STEPS        — ≥3 steps but average length < 40 chars
 *   RECIPE_GENERIC_ONLY_STEPS   — every step matches a generic verb pattern
 *   RECIPE_ZERO_KCAL            — snapshot exists but kcal = 0
 *   RECIPE_LOW_INGREDIENT_MATCH — <50% ingredients matched to CleanProduct
 *   RECIPE_NO_SNAPSHOT          — recipe has ingredients but no nutrition snapshot
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/verify-recipe-gpt-quality.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/verify-recipe-gpt-quality.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register src/scripts/verify-recipe-gpt-quality.ts --clear  (remove existing unresolved recipe issues first)
 */

import { prisma } from '@db';

const DRY_RUN = process.argv.includes('--dry-run');
const CLEAR_FIRST = process.argv.includes('--clear');

const MIN_INGREDIENT_MATCH_RATE = 0.5; // 50%

// Faza B.1: Incomplete steps detection
const MIN_TOTAL_STEP_CHARS = 200;
const MIN_AVG_STEP_CHARS = 40;
const GENERIC_STEP_RE = /^(wymieszać|wymieszaj|podawać|podawaj|doprawić|dopraw|polać|polej|udekorować|udekoruj|schłodzić|schłodź|odstawić|odstaw|przykryć|przykryj|zmiksować|zmiksuj|gotowe|smacznego|wstaw\s+do\s+lodówki)\.?$/i;

async function main() {
  console.log(`\n=== Recipe GPT Quality Verification ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  if (CLEAR_FIRST && !DRY_RUN) {
    const deleted = await prisma.dataQualityIssue.deleteMany({
      where: { entityType: 'Recipe', isResolved: false },
    });
    console.log(`Cleared ${deleted.count} existing unresolved recipe issues.\n`);
  }

  const recipes = await prisma.recipe.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      instructionSteps: {
        select: { instruction: true },
        orderBy: { stepNumber: 'asc' },
      },
      ingredients: {
        select: { cleanProductId: true },
      },
      nutritionSnapshot: {
        select: { kcal: true },
      },
    },
  });

  console.log(`Scanning ${recipes.length} active recipes...\n`);

  const issues: Array<{
    entityId: string;
    field: string;
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    issueCode: string;
    description: string;
    suggestedFix: string;
  }> = [];

  const stats = {
    noSteps: 0,
    genericSteps: 0,
    incompleteSteps: 0,
    shallowSteps: 0,
    genericOnlySteps: 0,
    zeroKcal: 0,
    lowMatchRate: 0,
    noSnapshot: 0,
  };

  for (const recipe of recipes) {
    const stepCount = recipe.instructionSteps.length;
    const ingredientCount = recipe.ingredients.length;
    const matchedCount = recipe.ingredients.filter((i) => i.cleanProductId !== null).length;
    const matchRate = ingredientCount > 0 ? matchedCount / ingredientCount : 1;

    // RECIPE_NO_STEPS
    if (stepCount === 0) {
      stats.noSteps++;
      issues.push({
        entityId: recipe.id,
        field: 'instructionSteps',
        severity: 'ERROR',
        issueCode: 'RECIPE_NO_STEPS',
        description: `"${recipe.title}" — brak kroków instrukcji (GPT nie wygenerował lub scraper nie pobrał)`,
        suggestedFix: 'Uzupełnij kroki ręcznie lub uruchom ponownie scraping przepisu',
      });
    }

    // RECIPE_GENERIC_STEPS (1 step, text < 30 chars)
    if (stepCount === 1 && recipe.instructionSteps[0].instruction.length < 30) {
      stats.genericSteps++;
      issues.push({
        entityId: recipe.id,
        field: 'instructionSteps',
        severity: 'WARNING',
        issueCode: 'RECIPE_GENERIC_STEPS',
        description: `"${recipe.title}" — tylko 1 krok, bardzo krótki ("${recipe.instructionSteps[0].instruction}")`,
        suggestedFix: 'Sprawdź czy GPT nie wygenerował placeholder; uzupełnij kroki',
      });
    }

    // Faza B.1: Step quality checks (skip when no steps — already covered above).
    if (stepCount > 0) {
      const stepTexts = recipe.instructionSteps.map((s) => s.instruction.trim());
      const totalChars = stepTexts.reduce((sum, t) => sum + t.length, 0);
      const avgChars = totalChars / stepCount;

      // RECIPE_INCOMPLETE_STEPS — total instruction text is too short to be useful.
      // Skip recipes already flagged as RECIPE_GENERIC_STEPS (single short step).
      if (stepCount > 1 && totalChars < MIN_TOTAL_STEP_CHARS) {
        stats.incompleteSteps++;
        issues.push({
          entityId: recipe.id,
          field: 'instructionSteps',
          severity: 'ERROR',
          issueCode: 'RECIPE_INCOMPLETE_STEPS',
          description: `"${recipe.title}" — ${stepCount} kroków, łącznie tylko ${totalChars} znaków (wymóg ≥${MIN_TOTAL_STEP_CHARS}). Pacjent nie wykona tego przepisu.`,
          suggestedFix: 'Uzupełnij kroki ręcznie lub uruchom GPT enrichment dla tego przepisu',
        });
      }

      // RECIPE_SHALLOW_STEPS — many steps but each is too short on average.
      if (stepCount >= 3 && avgChars < MIN_AVG_STEP_CHARS) {
        stats.shallowSteps++;
        issues.push({
          entityId: recipe.id,
          field: 'instructionSteps',
          severity: 'WARNING',
          issueCode: 'RECIPE_SHALLOW_STEPS',
          description: `"${recipe.title}" — ${stepCount} kroków, średnio ${avgChars.toFixed(1)} znaków/krok (wymóg ≥${MIN_AVG_STEP_CHARS}). Kroki zbyt lakoniczne.`,
          suggestedFix: 'Rozszerz kroki o czas, technikę, parametry; lub uruchom GPT enrichment',
        });
      }

      // RECIPE_GENERIC_ONLY_STEPS — every step is just a generic verb ("wymieszać.", "podawać.").
      const allGeneric = stepTexts.every((t) => GENERIC_STEP_RE.test(t));
      if (allGeneric) {
        stats.genericOnlySteps++;
        issues.push({
          entityId: recipe.id,
          field: 'instructionSteps',
          severity: 'ERROR',
          issueCode: 'RECIPE_GENERIC_ONLY_STEPS',
          description: `"${recipe.title}" — wszystkie ${stepCount} kroki to ogólne czasowniki bez kontekstu (np. "Wymieszać. Podawać.")`,
          suggestedFix: 'Przepisz kroki ręcznie — co/ile/jak długo/w jakiej kolejności',
        });
      }
    }

    // RECIPE_LOW_INGREDIENT_MATCH
    if (ingredientCount >= 3 && matchRate < MIN_INGREDIENT_MATCH_RATE) {
      stats.lowMatchRate++;
      issues.push({
        entityId: recipe.id,
        field: 'ingredients',
        severity: matchRate < 0.25 ? 'ERROR' : 'WARNING',
        issueCode: 'RECIPE_LOW_INGREDIENT_MATCH',
        description: `"${recipe.title}" — ${matchedCount}/${ingredientCount} składników (${Math.round(matchRate * 100)}%) dopasowanych do produktów`,
        suggestedFix: 'Uruchom ponownie matching składników lub uzupełnij ręcznie CleanProduct',
      });
    }

    // RECIPE_NO_SNAPSHOT (has ingredients but no snapshot)
    if (!recipe.nutritionSnapshot && ingredientCount > 0) {
      stats.noSnapshot++;
      issues.push({
        entityId: recipe.id,
        field: 'nutritionSnapshot',
        severity: 'WARNING',
        issueCode: 'RECIPE_NO_SNAPSHOT',
        description: `"${recipe.title}" — brak snapshotu odżywczego (${ingredientCount} składników)`,
        suggestedFix: 'Uruchom bulk-recompute-nutrition mode=missing',
      });
    }

    // RECIPE_ZERO_KCAL
    if (recipe.nutritionSnapshot && Number(recipe.nutritionSnapshot.kcal) === 0) {
      stats.zeroKcal++;
      issues.push({
        entityId: recipe.id,
        field: 'nutritionSnapshot.kcal',
        severity: 'ERROR',
        issueCode: 'RECIPE_ZERO_KCAL',
        description: `"${recipe.title}" — snapshot istnieje ale kcal = 0 (składniki nie mają danych odżywczych)`,
        suggestedFix: 'Sprawdź dopasowanie składników do CleanProduct; uruchom przeliczenie',
      });
    }
  }

  // Summary
  console.log('--- Issues found ---');
  console.log(`  No steps:                 ${stats.noSteps}`);
  console.log(`  Generic steps (1):        ${stats.genericSteps}`);
  console.log(`  Incomplete steps (<200ch):${stats.incompleteSteps}`);
  console.log(`  Shallow steps (<40ch/avg):${stats.shallowSteps}`);
  console.log(`  Generic-only steps:       ${stats.genericOnlySteps}`);
  console.log(`  Low match rate:           ${stats.lowMatchRate}`);
  console.log(`  No snapshot:              ${stats.noSnapshot}`);
  console.log(`  Zero kcal:                ${stats.zeroKcal}`);
  console.log(`  Total issues:             ${issues.length}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No DataQualityIssue records written.\n');
    // Print first 10 issues as samples
    console.log('--- Sample issues (first 10) ---');
    for (const issue of issues.slice(0, 10)) {
      console.log(`  [${issue.severity}] ${issue.issueCode}: ${issue.description}`);
    }
    return;
  }

  if (issues.length === 0) {
    console.log('\nNo issues found.\n');
    return;
  }

  console.log(`\nWriting ${issues.length} DataQualityIssue records...`);

  // Load existing unresolved recipe issues to skip duplicates
  const existing = await prisma.dataQualityIssue.findMany({
    where: { entityType: 'Recipe', isResolved: false },
    select: { entityId: true, issueCode: true },
  });
  const existingSet = new Set(existing.map((e) => `${e.entityId}:${e.issueCode}`));

  const toCreate = issues.filter((i) => !existingSet.has(`${i.entityId}:${i.issueCode}`));
  const skipped = issues.length - toCreate.length;
  console.log(`  Skipping ${skipped} already-recorded issues`);
  console.log(`  Creating ${toCreate.length} new issues...`);

  const BATCH = 50;
  let written = 0;
  for (let i = 0; i < toCreate.length; i += BATCH) {
    const batch = toCreate.slice(i, i + BATCH);
    await prisma.dataQualityIssue.createMany({
      data: batch.map((issue) => ({
        entityType: 'Recipe',
        entityId: issue.entityId,
        field: issue.field,
        severity: issue.severity,
        issueCode: issue.issueCode,
        description: issue.description,
        suggestedFix: issue.suggestedFix,
        isResolved: false,
      })),
    });
    written += batch.length;
    if (written % 200 === 0 || written === toCreate.length) {
      console.log(`  ${written} / ${toCreate.length}`);
    }
  }

  console.log(`\nDone! Wrote ${written} new issues (${skipped} already existed).\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
