/**
 * Z4 follow-up — GPT-assisted cuisineType classification for the NULL pool.
 *
 * After Z4's normalize-cuisine pass we have ~35 active recipes with
 * cuisineType=NULL, all flagged as RECIPE_CUISINE_MISSING in
 * DataQualityIssue. Plan said "<10% threshold → manual classification";
 * 35 manual decisions = ~30 min of dietitian time. GPT-4.1-mini does it
 * in seconds for a few cents.
 *
 * Strategy mirrors `gpt-classify-dish-completeness.ts`:
 *   ≥ 0.8 confidence → auto-apply (Recipe.cuisineType + AuditLog +
 *                     resolve RECIPE_CUISINE_MISSING issue)
 *   < 0.8 confidence → leave the existing RECIPE_CUISINE_MISSING open,
 *                     append the GPT suggestion to its description
 *
 * Allowed values (must stay in sync with apps/backend/src/utils/cuisineMapping.ts):
 *   polska, włoska, azjatycka, śródziemnomorska, meksykańska,
 *   indyjska, amerykańska, francuska, inna
 *
 * `uniwersalna` was dropped from the taxonomy (P0.3 — Recipe Overhaul Master
 * Plan 2026-04-29). Cross-cultural dishes are now classified into the closest
 * cuisine; truly ambiguous cases stay LOW confidence and remain in the
 * RECIPE_CUISINE_MISSING queue for manual review (no neutral catch-all).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/gpt-classify-cuisine.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/gpt-classify-cuisine.ts --apply
 *   npx ts-node -r tsconfig-paths/register src/scripts/gpt-classify-cuisine.ts --apply --limit 5
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
const BATCH_ID = '2026-04-28-cuisine-gpt-classify';

type Cuisine =
  | 'polska' | 'włoska' | 'azjatycka' | 'śródziemnomorska' | 'meksykańska'
  | 'indyjska' | 'amerykańska' | 'francuska' | 'inna';

const ALLOWED_CUISINES: Cuisine[] = [
  'polska', 'włoska', 'azjatycka', 'śródziemnomorska', 'meksykańska',
  'indyjska', 'amerykańska', 'francuska', 'inna',
];

const SYSTEM_PROMPT = `Jesteś dietetycznym klasyfikatorem przepisów. Zadanie: określ kuchnię, do której przynależy przepis.

DOZWOLONE WARTOŚCI (9):
- polska: typowe potrawy polskie (pierogi, bigos, schabowy, kotlet mielony, żurek). Tu też trafiają proste polskie śniadania i klasyczne obiady stołówkowe (jajecznica, twaróg z dodatkami, mintaj z ziemniakami, kasze z mięsem).
- włoska: makarony, risotto, pizza margherita, lasagne, pesto, parmezan, mozzarella
- azjatycka: stir-fry, curry tajskie, sushi, ramen, pad thai, ryż jaśminowy z sosem sojowym
- śródziemnomorska: hummus, tabbouleh, gyros, moussaka, falafel, dania greckie/tureckie/libańskie/hiszpańskie
- meksykańska: tacos, burritos, fajitas, guacamole jako baza dania, chili con carne
- indyjska: curry indyjskie, dahl, biryani, samosa, kurczak tikka masala
- amerykańska: burgery, BBQ, pancakes amerykańskie, mac & cheese, smoothies, mac and cheese
- francuska: quiche, ratatouille, beef bourguignon, sufle, sosy bechamel
- inna: skandynawska, afrykańska, południowoamerykańska, inne mało popularne; ORAZ dania bez wyraźnej przynależności kulturowej (owsianka z owocami, jogurt z bakaliami, mussli, sałatka owocowa, kanapki uniwersalne).

Zwróć JSON: { "cuisine": "...", "confidence": 0.0–1.0, "reason": "krótkie polskie uzasadnienie" }

Wymuszony wybór z 9 wartości — żadnego "uniwersalna" / "universal" / catch-all. Dla dań niejednoznacznych użyj "inna" z confidence < 0.7, dietetyk dokończy klasyfikację ręcznie.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    cuisine: { type: 'string', enum: ALLOWED_CUISINES },
    confidence: { type: 'number' },
    reason: { type: 'string' },
  },
  required: ['cuisine', 'confidence', 'reason'],
  additionalProperties: false,
};

interface RecipeForClassification {
  id: string;
  title: string;
  mealType: string;
  ingredients: Array<{ name: string; grams: number }>;
}

interface ClassificationResult {
  recipeId: string;
  title: string;
  mealType: string;
  cuisine: Cuisine;
  confidence: number;
  reason: string;
  costUsd: number;
}

async function loadRecipes(): Promise<RecipeForClassification[]> {
  const rows = await prisma.recipe.findMany({
    where: {
      isActive: true,
      cuisineType: null,
    },
    select: {
      id: true,
      title: true,
      mealType: true,
      ingredients: {
        select: {
          grams: true,
          displayName: true,
          cleanProduct: { select: { name: true } },
          foodProduct: { select: { name: true } },
        },
        orderBy: { grams: 'desc' },
        take: 8,
      },
    },
    take: LIMIT ?? undefined,
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    mealType: r.mealType,
    ingredients: r.ingredients.map((i) => ({
      name: i.displayName ?? i.cleanProduct?.name ?? i.foodProduct?.name ?? 'unknown',
      grams: Math.round(Number(i.grams)),
    })),
  }));
}

function buildUserPrompt(r: RecipeForClassification): string {
  const ingredientsList = r.ingredients
    .map((i) => `- ${i.name} (${i.grams}g)`)
    .join('\n');

  return `Przepis do klasyfikacji kuchni:

Tytuł: ${r.title}
mealType: ${r.mealType}

Składniki (top 8 wagowo):
${ingredientsList || '(brak)'}

Zwróć JSON z klasyfikacją.`;
}

async function classifyOne(r: RecipeForClassification): Promise<ClassificationResult> {
  const result = await callOpenAI({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(r),
    model: MODEL,
    temperature: 0.2,
    maxTokens: 200,
    jsonSchema: RESPONSE_SCHEMA,
  });

  const parsed = result.content as { cuisine: Cuisine; confidence: number; reason: string };

  return {
    recipeId: r.id,
    title: r.title,
    mealType: r.mealType,
    cuisine: parsed.cuisine,
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

  console.log('\n=== GPT cuisine classifier (Z4 follow-up, 2026-04-28) ===');
  console.log(`Mode: ${APPLY ? 'LIVE (writes)' : 'DRY RUN'}`);
  console.log(`Model: ${MODEL}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);
  console.log(`Batch ID: ${BATCH_ID}\n`);

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
    if (i % 10 === 0) {
      console.log(`  Classified ${i}/${recipes.length}, running cost: $${totalCost.toFixed(4)}`);
    }
  }

  console.log(`\nTotal cost: $${totalCost.toFixed(4)}\n`);

  // ─── Distribution ───────────────────────────────────────────────────────
  console.log('--- Distribution ---');
  const hist = new Map<string, number>();
  for (const r of results) hist.set(r.cuisine, (hist.get(r.cuisine) ?? 0) + 1);
  for (const [k, n] of [...hist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} → ${n}`);
  }

  console.log('\n--- Confidence distribution ---');
  const high = results.filter((r) => r.confidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD).length;
  const low = results.length - high;
  console.log(`  HIGH (≥ ${AUTO_APPLY_CONFIDENCE_THRESHOLD}, auto-apply):  ${high}`);
  console.log(`  LOW (< ${AUTO_APPLY_CONFIDENCE_THRESHOLD}, → keep in queue): ${low}`);

  // ─── Sample outputs ─────────────────────────────────────────────────────
  console.log('\n--- HIGH confidence sample (first 10) ---');
  for (const r of results.filter((x) => x.confidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD).slice(0, 10)) {
    console.log(`  [${r.cuisine.padEnd(18)} conf=${r.confidence.toFixed(2)}] ${r.title}`);
    console.log(`    → ${r.reason}`);
  }

  if (low > 0) {
    console.log('\n--- LOW confidence sample (first 10) ---');
    for (const r of results.filter((x) => x.confidence < AUTO_APPLY_CONFIDENCE_THRESHOLD).slice(0, 10)) {
      console.log(`  [${r.cuisine.padEnd(18)} conf=${r.confidence.toFixed(2)}] ${r.title}`);
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

  // High → write cuisineType + AuditLog + resolve any open RECIPE_CUISINE_MISSING.
  for (const r of highConfidence) {
    await prisma.$transaction([
      prisma.recipe.update({
        where: { id: r.recipeId },
        data: { cuisineType: r.cuisine },
      }),
      prisma.auditLog.create({
        data: {
          action: 'GPT_CLASSIFY_CUISINE',
          resourceType: 'RECIPE',
          resourceId: r.recipeId,
          metadata: {
            cuisine: r.cuisine,
            confidence: r.confidence,
            reason: r.reason,
            model: MODEL,
            title: r.title,
            batchId: BATCH_ID,
          },
        },
      }),
      // Resolve any open RECIPE_CUISINE_MISSING for this recipe.
      prisma.dataQualityIssue.updateMany({
        where: {
          entityType: 'Recipe',
          entityId: r.recipeId,
          issueCode: 'RECIPE_CUISINE_MISSING',
          isResolved: false,
        },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy: 'gpt-classifier',
        },
      }),
    ]);
  }
  console.log(`  Auto-applied ${highConfidence.length} HIGH-confidence cuisine assignments + resolved matching RECIPE_CUISINE_MISSING.`);

  // Low → leave the existing RECIPE_CUISINE_MISSING open but append GPT
  // suggestion to its description so the dietitian sees the hint.
  for (const r of lowConfidence) {
    await prisma.dataQualityIssue.updateMany({
      where: {
        entityType: 'Recipe',
        entityId: r.recipeId,
        issueCode: 'RECIPE_CUISINE_MISSING',
        isResolved: false,
      },
      data: {
        suggestedFix: `GPT suggestion (low confidence ${r.confidence.toFixed(2)}): ${r.cuisine} — ${r.reason}. Zatwierdź lub zmień.`,
      },
    });
  }
  if (lowConfidence.length > 0) {
    console.log(`  Annotated ${lowConfidence.length} LOW-confidence rows with GPT suggestion in suggestedFix.`);
  }

  console.log(`\nDone. Total OpenAI cost: $${totalCost.toFixed(4)}\n`);
}

main()
  .catch((err) => { console.error('FAILED:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
