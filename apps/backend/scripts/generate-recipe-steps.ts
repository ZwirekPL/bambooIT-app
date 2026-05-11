/**
 * Generate instruction steps for recipes that have none.
 *
 * Uses GPT-4.1-mini to produce 3-6 Polish cooking steps per recipe
 * based on the recipe title and ingredient list.
 *
 * Modes:
 *   --missing   Only recipes without any steps (default)
 *   --all       Regenerate for ALL recipes (clears existing steps first)
 *   --dry-run   Show count only, no DB writes
 *
 * Usage (local):
 *   npx ts-node -r tsconfig-paths/register scripts/generate-recipe-steps.ts --missing
 *
 * Usage (production Docker):
 *   docker compose -f docker-compose.prod.yml exec backend \
 *     npx ts-node -r tsconfig-paths/register scripts/generate-recipe-steps.ts --missing
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 5;          // parallel calls per batch (rate-limit safe)
const DELAY_BETWEEN_BATCHES = 500; // ms

interface Step {
  stepNumber: number;
  instruction: string;
  phase: 'prep' | 'cook';
  durationMinutes?: number;
}

async function generateStepsForRecipe(
  title: string,
  ingredients: string[],
): Promise<Step[]> {
  const ingredientList = ingredients.join(', ');

  const prompt = `Jesteś doświadczonym kucharzem. Napisz krótkie, praktyczne instrukcje przygotowania potrawy "${title}".

Składniki: ${ingredientList}

Zasady:
- Podaj 3-6 kroków
- Każdy krok to 1-2 zdania po polsku
- Kroki muszą być konkretne i wykonalne
- Zaznacz fazę każdego kroku: "prep" (przygotowanie składników) lub "cook" (gotowanie/pieczenie/smażenie)
- Opcjonalnie podaj czas kroku w minutach

Odpowiedz TYLKO w formacie JSON (tablica kroków):
[
  { "stepNumber": 1, "instruction": "...", "phase": "prep", "durationMinutes": 5 },
  { "stepNumber": 2, "instruction": "...", "phase": "cook" }
]`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 600,
    response_format: { type: 'json_object' },
  });

  const text = response.choices[0].message.content ?? '{}';
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from OpenAI: ${text.slice(0, 200)}`);
  }

  // Handle both {"steps": [...]} and [...] responses
  const arr = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>).steps)
      ? (parsed as Record<string, unknown>).steps as unknown[]
      : null;

  if (!arr || arr.length === 0) {
    throw new Error(`No steps in response: ${text.slice(0, 200)}`);
  }

  return (arr as Array<Record<string, unknown>>).map((s, i) => ({
    stepNumber: typeof s.stepNumber === 'number' ? s.stepNumber : i + 1,
    instruction: String(s.instruction ?? '').trim(),
    phase: s.phase === 'prep' ? 'prep' : 'cook',
    durationMinutes: typeof s.durationMinutes === 'number' ? s.durationMinutes : undefined,
  })).filter((s) => s.instruction.length > 5);
}

async function main() {
  const mode = process.argv[2] ?? '--missing';

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set');
    process.exit(1);
  }

  // Load recipes
  let recipes: { id: string; title: string; servings: number; ingredients: { displayName: string | null; cleanProduct: { name: string } | null; foodProduct: { name: string } | null }[] }[];

  if (mode === '--all') {
    recipes = await prisma.recipe.findMany({
      where: { isActive: true },
      select: {
        id: true, title: true, servings: true,
        ingredients: {
          select: {
            displayName: true,
            cleanProduct: { select: { name: true } },
            foodProduct: { select: { name: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    console.log(`Mode: all — ${recipes.length} active recipes`);
  } else if (mode === '--dry-run') {
    const count = await prisma.recipe.count({
      where: {
        isActive: true,
        instructionSteps: { none: {} },
      },
    });
    console.log(`Dry run: ${count} active recipes have no steps`);
    await prisma.$disconnect();
    return;
  } else {
    // --missing (default)
    recipes = await prisma.recipe.findMany({
      where: {
        isActive: true,
        instructionSteps: { none: {} },
      },
      select: {
        id: true, title: true, servings: true,
        ingredients: {
          select: {
            displayName: true,
            cleanProduct: { select: { name: true } },
            foodProduct: { select: { name: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    console.log(`Mode: missing — ${recipes.length} recipes have no steps`);
  }

  if (recipes.length === 0) {
    console.log('Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = recipes.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (recipe) => {
        try {
          const ingredientNames = recipe.ingredients
            .map((ing) => ing.displayName ?? ing.cleanProduct?.name ?? ing.foodProduct?.name ?? '')
            .filter((n) => n.length > 0);

          if (ingredientNames.length === 0) {
            console.log(`  SKIP (no ingredients): ${recipe.title}`);
            return;
          }

          const steps = await generateStepsForRecipe(recipe.title, ingredientNames);

          if (steps.length === 0) {
            console.log(`  SKIP (empty steps): ${recipe.title}`);
            return;
          }

          // Clear existing steps if --all mode
          if (mode === '--all') {
            await prisma.recipeInstructionStep.deleteMany({ where: { recipeId: recipe.id } });
          }

          await prisma.recipeInstructionStep.createMany({
            data: steps.map((s) => ({
              recipeId: recipe.id,
              stepNumber: s.stepNumber,
              instruction: s.instruction,
              phase: s.phase,
              durationMinutes: s.durationMinutes ?? null,
            })),
          });

          success++;
        } catch (err) {
          failed++;
          console.error(`  FAIL: ${recipe.title} — ${(err as Error).message}`);
        }
      }),
    );

    const processed = Math.min(i + BATCH_SIZE, recipes.length);
    console.log(`  ${processed}/${recipes.length} — ok: ${success}, fail: ${failed}`);

    if (i + BATCH_SIZE < recipes.length) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES));
    }
  }

  const totalWithSteps = await prisma.recipe.count({
    where: { isActive: true, instructionSteps: { some: {} } },
  });

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
  console.log(`Active recipes with steps: ${totalWithSteps}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
