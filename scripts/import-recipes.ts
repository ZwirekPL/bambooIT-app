/**
 * Import recipes from JSON export file (upsert by slug).
 *
 * Usage:
 *   npm run db:import:recipes
 *   npm run db:import:recipes -- --dry-run
 *
 * Input: scripts/data/recipes-export.json
 *
 * Behaviour:
 *   - Slug already exists → UPSERT (update recipe fields + re-sync relations)
 *   - Slug not found     → CREATE
 *   - --dry-run          → report only, no writes
 *
 * Run AFTER import-clean-products (FK dependency: RecipeIngredient.cleanProductId).
 */
import { prisma } from '../packages/database/dist/index.js';
import fs from 'fs';
import path from 'path';

const DRY_RUN = process.argv.includes('--dry-run');

// ─── BUG-3 prevention: inline ingredient-name validation ─────────────────────
// (kept local to avoid pulling in @backend path alias; mirrors validateIngredientName
//  from apps/backend/src/services/planValidation.service.ts — keep in sync if patterns change)
const INGREDIENT_JUNK_PREFIX = /^(?:przyprawy|zioła|dekoracja|dodatki|orzechy|sery|bakali[ae]?|topping|kasze|mączne\s+przekąski|przetwory|marynat[ay])\s*[:\-]/i;
const INGREDIENT_ALLCAPS = /^[A-ZĄĘŁŻŚĆŃÓŹ]{3,8}$/;

function logSuspiciousIngredientName(name: string | null | undefined, ctx: string): void {
  if (!name) return;
  const t = name.trim();
  if (!t) return;
  const reasons: string[] = [];
  if (t.length > 60) reasons.push(`too-long(${t.length})`);
  if (/[:;]/.test(t)) reasons.push('has-colon');
  if (INGREDIENT_JUNK_PREFIX.test(t)) reasons.push('junk-prefix');
  if (INGREDIENT_ALLCAPS.test(t)) reasons.push('all-caps');
  if (reasons.length > 0) {
    console.warn(`[import-recipes] ⚠ suspicious ingredient in ${ctx}: "${t}" — ${reasons.join(', ')}`);
  }
}

interface IngredientData {
  id: string;
  recipeId: string;
  sortOrder: number;
  quantity: number;
  unit: string | null;
  grams: number;
  displayName: string | null;
  isOptional: boolean;
  groupName: string | null;
  notes: string | null;
  retentionFactor: number | null;
  cleanProductId: string | null;
  foodProductId: string | null;
}

interface StepData {
  id: string;
  recipeId: string;
  stepNumber: number;
  instruction: string;
  durationMinutes: number | null;
  phase: string | null;
}

interface NutritionSnapshot {
  id: string;
  recipeId: string;
  [key: string]: unknown;
}

interface AllergenData {
  id: string;
  recipeId: string;
  [key: string]: unknown;
}

interface DietFlagData {
  id: string;
  recipeId: string;
  [key: string]: unknown;
}

interface RecipeExport {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  ingredients: IngredientData[];
  instructionSteps: StepData[];
  nutritionSnapshot: NutritionSnapshot | null;
  allergens: AllergenData[];
  dietFlags: DietFlagData[];
  [key: string]: unknown;
}

function progress(current: number, total: number, label: string) {
  const pct = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
  process.stdout.write(`\r  [${bar}] ${pct}% (${current}/${total}) ${label}   `);
}

async function main() {
  const inPath = path.join(process.cwd(), 'scripts', 'data', 'recipes-export.json');
  if (!fs.existsSync(inPath)) {
    console.error(`File not found: ${inPath}`);
    console.error('Run npm run db:export:recipes first.');
    process.exit(1);
  }

  const recipes: RecipeExport[] = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
  const total = recipes.length;
  console.log(`Importing ${total} recipes... ${DRY_RUN ? '(DRY RUN — no writes)' : ''}`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    progress(i + 1, total, recipe.slug.slice(0, 30));

    if (DRY_RUN) {
      const existing = await prisma.recipe.findUnique({ where: { slug: recipe.slug } });
      existing ? updated++ : created++;
      continue;
    }

    try {
      const {
        id,
        ingredients,
        instructionSteps,
        nutritionSnapshot,
        allergens,
        dietFlags,
        createdAt,
        updatedAt,
        ...recipeData
      } = recipe;

      const existing = await prisma.recipe.findUnique({ where: { slug: recipe.slug } });

      let recipeId: string;

      if (existing) {
        // Update recipe scalar fields
        await prisma.recipe.update({
          where: { slug: recipe.slug },
          data: { ...recipeData },
        });
        recipeId = existing.id;

        // Re-sync relations: delete old, create new
        await prisma.$transaction([
          prisma.recipeIngredient.deleteMany({ where: { recipeId } }),
          prisma.recipeInstructionStep.deleteMany({ where: { recipeId } }),
          prisma.recipeAllergen.deleteMany({ where: { recipeId } }),
          prisma.recipeDietFlag.deleteMany({ where: { recipeId } }),
        ]);
        updated++;
      } else {
        const r = await prisma.recipe.create({ data: { ...recipeData } });
        recipeId = r.id;
        created++;
      }

      // Create ingredients (BUG-3: log warnings for compound/truncated displayName)
      if (ingredients.length > 0) {
        for (const ing of ingredients) {
          logSuspiciousIngredientName(ing.displayName, `recipe "${recipeData.title ?? recipeData.slug}"`);
        }
        await prisma.recipeIngredient.createMany({
          data: ingredients.map(({ id: _id, recipeId: _rid, ...ing }) => ({
            ...ing,
            recipeId,
          })),
        });
      }

      // Create instruction steps
      if (instructionSteps.length > 0) {
        await prisma.recipeInstructionStep.createMany({
          data: instructionSteps.map(({ id: _id, recipeId: _rid, ...step }) => ({
            ...step,
            recipeId,
          })),
        });
      }

      // Nutrition snapshot: upsert
      if (nutritionSnapshot) {
        const { id: _id, recipeId: _rid, ...snapData } = nutritionSnapshot;
        await prisma.recipeNutritionSnapshot.upsert({
          where: { recipeId },
          create: { recipeId, ...snapData },
          update: { ...snapData },
        });
      }

      // Allergens
      if (allergens.length > 0) {
        await prisma.recipeAllergen.createMany({
          data: allergens.map(({ id: _id, recipeId: _rid, ...a }) => ({
            ...a,
            recipeId,
          })),
        });
      }

      // Diet flags
      if (dietFlags.length > 0) {
        await prisma.recipeDietFlag.createMany({
          data: dietFlags.map(({ id: _id, recipeId: _rid, ...f }) => ({
            ...f,
            recipeId,
          })),
        });
      }
    } catch (err) {
      failed++;
      console.error(`\n  ERROR on ${recipe.slug}: ${(err as Error).message}`);
    }
  }

  console.log(`\n\nDone${DRY_RUN ? ' (dry run)' : ''}:`);
  console.log(`  Created : ${created}`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Failed  : ${failed}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
