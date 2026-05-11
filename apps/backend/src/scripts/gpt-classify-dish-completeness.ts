/**
 * Faza C.2 etap 3 — GPT-assisted classification for the 162 ambiguous recipes
 * left as dishCompleteness=NULL after the rule-based pass.
 *
 * Strategy
 * --------
 * For each NULL recipe, ask GPT-4.1-mini to classify into:
 *   COMPLETE_MEAL | MAIN_DISH | CARB_SIDE | VEG_SIDE | COMPONENT
 * with a confidence (0–1) and a short reason.
 *
 * Confidence routing:
 *   ≥ 0.8 → auto-apply: write dishCompleteness to Recipe
 *   < 0.8 → record DataQualityIssue (RECIPE_DISH_COMPLETENESS_REVIEW)
 *           for the dietitian to confirm in admin UI
 *
 * Cost (estimate gpt-4.1-mini @ $0.40/1M input + $1.60/1M output):
 *   ~162 recipes × ~700 tokens prompt + ~120 tokens output ≈ 134k tokens
 *   ≈ $0.06–0.10 total. Cheap enough to run twice if needed.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/gpt-classify-dish-completeness.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/gpt-classify-dish-completeness.ts --apply
 *   npx ts-node -r tsconfig-paths/register src/scripts/gpt-classify-dish-completeness.ts --apply --limit 5
 */

import 'dotenv/config';
import { prisma } from '@db';
import { callOpenAI, isOpenAiConfigured } from '../services/openai.service';

const APPLY = process.argv.includes('--apply');
const LIMIT_FLAG_INDEX = process.argv.indexOf('--limit');
const LIMIT = LIMIT_FLAG_INDEX > -1 && process.argv[LIMIT_FLAG_INDEX + 1]
  ? parseInt(process.argv[LIMIT_FLAG_INDEX + 1]!, 10)
  : null;

const MODEL = 'gpt-4.1-mini';
const AUTO_APPLY_CONFIDENCE_THRESHOLD = 0.8;

const SYSTEM_PROMPT = `Jesteś dietetycznym klasyfikatorem przepisów kulinarnych. Twoje zadanie:
przypisać przepisowi jedną z 5 kategorii określających jego rolę w posiłku.

KATEGORIE:
- COMPLETE_MEAL: pacjent może zjeść samodzielnie i ma zbilansowany posiłek
  (np. owsianka z owocami, omlet z warzywami, zupa z makaronem i klopskami,
  sałatka z kurczakiem, gulasz, risotto, racuchy z owocami).
- MAIN_DISH: przepis zawiera białko ale wymaga uzupełnienia węglowodanami
  i/lub warzywami (np. kotlet schabowy solo, polędwiczki w sosie, smażony łosoś).
- CARB_SIDE: dodatek węglowodanowy — ziemniaki, kasza, ryż, makaron, kluski,
  rösti, kopytka. Tylko jako uzupełnienie main_dish.
- VEG_SIDE: dodatek warzywny — sałatka, surówka, warzywa na parze, mizeria.
  Tylko jako uzupełnienie main_dish.
- COMPONENT: nigdy nie jest pełnym posiłkiem — sos, marynata, polewa, farsz,
  smarowidła, dressing, dipy, panierka.

Zwróć JSON o strukturze:
{ "completeness": "...", "confidence": 0.0–1.0, "reason": "krótkie polskie uzasadnienie" }

Nie wymyślaj pól. Confidence < 0.7 jeśli przepis jest dwuznaczny.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    completeness: {
      type: 'string',
      enum: ['COMPLETE_MEAL', 'MAIN_DISH', 'CARB_SIDE', 'VEG_SIDE', 'COMPONENT'],
    },
    confidence: { type: 'number' },
    reason: { type: 'string' },
  },
  required: ['completeness', 'confidence', 'reason'],
  additionalProperties: false,
};

interface RecipeForClassification {
  id: string;
  title: string;
  mealType: string;
  servings: number;
  kcalPerServing: number | null;
  ingredients: Array<{ name: string; grams: number }>;
  firstSteps: string[];
}

interface ClassificationResult {
  recipeId: string;
  title: string;
  mealType: string;
  completeness: 'COMPLETE_MEAL' | 'MAIN_DISH' | 'CARB_SIDE' | 'VEG_SIDE' | 'COMPONENT';
  confidence: number;
  reason: string;
  costUsd: number;
}

async function loadRecipes(): Promise<RecipeForClassification[]> {
  const rows = await prisma.recipe.findMany({
    where: {
      isActive: true,
      dishCompleteness: null,
    },
    select: {
      id: true,
      title: true,
      mealType: true,
      servings: true,
      nutritionSnapshot: { select: { kcal: true } },
      ingredients: {
        select: {
          grams: true,
          displayName: true,
          cleanProduct: { select: { name: true } },
          foodProduct: { select: { name: true } },
        },
        orderBy: { grams: 'desc' },
        take: 8, // top 8 by weight
      },
      instructionSteps: {
        select: { instruction: true },
        orderBy: { stepNumber: 'asc' },
        take: 2, // first 2 steps
      },
    },
    take: LIMIT ?? undefined,
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    mealType: r.mealType,
    servings: r.servings,
    kcalPerServing: r.nutritionSnapshot ? Number(r.nutritionSnapshot.kcal) : null,
    ingredients: r.ingredients.map((i) => ({
      name: i.displayName ?? i.cleanProduct?.name ?? i.foodProduct?.name ?? 'unknown',
      grams: Math.round(Number(i.grams)),
    })),
    firstSteps: r.instructionSteps.map((s) => s.instruction),
  }));
}

function buildUserPrompt(r: RecipeForClassification): string {
  const ingredientsList = r.ingredients
    .map((i) => `- ${i.name} (${i.grams}g)`)
    .join('\n');
  const stepsList = r.firstSteps
    .map((s, i) => `${i + 1}. ${s.length > 200 ? s.slice(0, 200) + '...' : s}`)
    .join('\n');

  return `Przepis do klasyfikacji:

Tytuł: ${r.title}
Obecny mealType: ${r.mealType}
Liczba porcji: ${r.servings}
Kcal/porcja: ${r.kcalPerServing ?? 'brak danych'}

Składniki (top 8 wagowo):
${ingredientsList || '(brak)'}

Pierwsze 2 kroki:
${stepsList || '(brak)'}

Zwróć JSON z klasyfikacją.`;
}

async function classifyOne(r: RecipeForClassification): Promise<ClassificationResult> {
  const userPrompt = buildUserPrompt(r);

  const result = await callOpenAI({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    model: MODEL,
    temperature: 0.2,
    maxTokens: 400,
    jsonSchema: RESPONSE_SCHEMA,
  });

  const parsed = result.content as {
    completeness: ClassificationResult['completeness'];
    confidence: number;
    reason: string;
  };

  return {
    recipeId: r.id,
    title: r.title,
    mealType: r.mealType,
    completeness: parsed.completeness,
    confidence: parsed.confidence,
    reason: parsed.reason,
    costUsd: result.estimatedCostUsd,
  };
}

async function main() {
  if (!isOpenAiConfigured()) {
    console.error('OPENAI_API_KEY is not set in apps/backend/.env');
    process.exit(1);
  }

  console.log('\n=== Faza C.2 etap 3 — GPT classification of NULL dishCompleteness ===');
  console.log(`Mode: ${APPLY ? 'LIVE (writes)' : 'DRY RUN'}`);
  console.log(`Model: ${MODEL}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);
  console.log('');

  const recipes = await loadRecipes();
  console.log(`Recipes to classify: ${recipes.length}\n`);

  if (recipes.length === 0) {
    console.log('Nothing to do.\n');
    return;
  }

  const results: ClassificationResult[] = [];
  let totalCost = 0;
  let i = 0;

  for (const r of recipes) {
    try {
      const res = await classifyOne(r);
      results.push(res);
      totalCost += res.costUsd;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [error] ${r.title}: ${msg}`);
    }
    i++;
    if (i % 20 === 0) {
      console.log(`  Classified ${i}/${recipes.length}, running cost: $${totalCost.toFixed(4)}`);
    }
  }

  console.log(`\nTotal cost: $${totalCost.toFixed(4)}\n`);

  // ─── Distribution ───────────────────────────────────────────────────────
  console.log('--- Distribution ---');
  const compHist = new Map<string, number>();
  for (const r of results) {
    compHist.set(r.completeness, (compHist.get(r.completeness) ?? 0) + 1);
  }
  for (const [k, n] of [...compHist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(15)} → ${n}`);
  }

  console.log('\n--- Confidence distribution ---');
  const high = results.filter((r) => r.confidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD).length;
  const low = results.length - high;
  console.log(`  HIGH (≥ ${AUTO_APPLY_CONFIDENCE_THRESHOLD}, auto-apply):  ${high}`);
  console.log(`  LOW (< ${AUTO_APPLY_CONFIDENCE_THRESHOLD}, → DataQualityIssue): ${low}`);

  // ─── Sample outputs ─────────────────────────────────────────────────────
  console.log('\n--- HIGH confidence sample (first 10) ---');
  for (const r of results.filter((x) => x.confidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD).slice(0, 10)) {
    console.log(`  [${r.completeness.padEnd(14)} conf=${r.confidence.toFixed(2)}] ${r.title}`);
    console.log(`    → ${r.reason}`);
  }

  if (low > 0) {
    console.log('\n--- LOW confidence sample (first 10) ---');
    for (const r of results.filter((x) => x.confidence < AUTO_APPLY_CONFIDENCE_THRESHOLD).slice(0, 10)) {
      console.log(`  [${r.completeness.padEnd(14)} conf=${r.confidence.toFixed(2)}] ${r.title}`);
      console.log(`    → ${r.reason}`);
    }
  }

  if (!APPLY) {
    console.log('\n(dry-run — pass --apply to write)\n');
    return;
  }

  // ─── Apply ──────────────────────────────────────────────────────────────
  console.log('\nApplying writes...');

  const highConfidence = results.filter((r) => r.confidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD);
  const lowConfidence = results.filter((r) => r.confidence < AUTO_APPLY_CONFIDENCE_THRESHOLD);

  // High → write dishCompleteness + AuditLog
  for (const r of highConfidence) {
    await prisma.$transaction([
      prisma.recipe.update({
        where: { id: r.recipeId },
        data: { dishCompleteness: r.completeness },
      }),
      prisma.auditLog.create({
        data: {
          action: 'GPT_CLASSIFY_DISH_COMPLETENESS',
          resourceType: 'RECIPE',
          resourceId: r.recipeId,
          metadata: {
            completeness: r.completeness,
            confidence: r.confidence,
            reason: r.reason,
            model: MODEL,
            title: r.title,
          },
        },
      }),
    ]);
  }
  console.log(`  Auto-applied ${highConfidence.length} HIGH-confidence classifications.`);

  // Low → DataQualityIssue (skip if already recorded)
  if (lowConfidence.length > 0) {
    const existing = await prisma.dataQualityIssue.findMany({
      where: {
        entityType: 'Recipe',
        issueCode: 'RECIPE_DISH_COMPLETENESS_REVIEW',
        isResolved: false,
        entityId: { in: lowConfidence.map((r) => r.recipeId) },
      },
      select: { entityId: true },
    });
    const existingIds = new Set(existing.map((e) => e.entityId));
    const toCreate = lowConfidence.filter((r) => !existingIds.has(r.recipeId));

    if (toCreate.length > 0) {
      await prisma.dataQualityIssue.createMany({
        data: toCreate.map((r) => ({
          entityType: 'Recipe',
          entityId: r.recipeId,
          field: 'dishCompleteness',
          severity: 'WARNING',
          issueCode: 'RECIPE_DISH_COMPLETENESS_REVIEW',
          description: `"${r.title}" — GPT zaproponował ${r.completeness} z confidence ${r.confidence.toFixed(2)}: ${r.reason}`,
          suggestedFix: `Zatwierdź lub zmień dishCompleteness ręcznie w admin UI`,
          isResolved: false,
        })),
      });
      console.log(`  Wrote ${toCreate.length} LOW-confidence to review queue (RECIPE_DISH_COMPLETENESS_REVIEW).`);
    } else {
      console.log(`  All ${lowConfidence.length} LOW-confidence already in queue.`);
    }
  }

  console.log(`\nDone. Total OpenAI cost: $${totalCost.toFixed(4)}\n`);
}

main()
  .catch((err) => { console.error('FAILED:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
