/**
 * Faza D.6 — Seed basic side-dish recipes (CARB_SIDE + VEG_SIDE).
 *
 * Audit revealed critical gaps: only 1 rice, 1 pasta, 1 grain, 2 steamed-veg
 * recipes in the entire pool. The composer (Faza D) needs ≥5 of each so it
 * can give patients dietary variety.
 *
 * This script seeds 15 minimal "single-ingredient" side dishes — the basic
 * neutral accompaniments any dietitian relies on. Each recipe has:
 *   • 1 ingredient (linked to a real CleanProduct with full nutrition data)
 *   • 1-2 brief instruction steps
 *   • Per-serving nutrition computed from CleanProductNutrients × portion grams
 *   • dishCompleteness = CARB_SIDE or VEG_SIDE
 *   • mealType = SIDE_DISH
 *   • servingType = PER_PORTION
 *   • source = 'manual', origin = 'manual'
 *
 * Idempotent: skips recipes whose `slug` already exists.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-basic-side-dishes.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-basic-side-dishes.ts --apply
 */

import { prisma } from '@db';
import type { Prisma } from '@db';

const APPLY = process.argv.includes('--apply');

// ─── Recipe definitions ──────────────────────────────────────────────────────

interface SideDishDef {
  title: string;
  slug: string;
  cleanProductPattern: string;  // ILIKE pattern (preference order applied)
  portionG: number;
  dishCompleteness: 'CARB_SIDE' | 'VEG_SIDE';
  category: string;
  cuisineType: string;
  prepMinutes: number;
  cookMinutes: number;
  steps: string[];
}

const SIDE_DISHES: SideDishDef[] = [
  // ─── CARB_SIDE ─────────────────────────────────────────────────────────
  {
    title: 'Ryż biały gotowany',
    slug: 'ryz-bialy-gotowany',
    cleanProductPattern: 'ryż, biały, long-grain, zwykły, gotowany(a), wzbogacony(a), z sól',
    portionG: 150,
    dishCompleteness: 'CARB_SIDE',
    category: 'side_dish',
    cuisineType: 'polska',
    prepMinutes: 2,
    cookMinutes: 18,
    steps: [
      'Wsyp 75 g suchego ryżu do garnka, zalej 150 ml wody i dodaj szczyptę soli.',
      'Doprowadź do wrzenia, zmniejsz ogień do minimum, przykryj i gotuj 15-18 min do wchłonięcia wody. Pozostaw 5 min pod przykryciem przed podaniem.',
    ],
  },
  {
    title: 'Ryż brązowy gotowany',
    slug: 'ryz-brazowy-gotowany',
    cleanProductPattern: 'ryż, brązowy, long-grain, gotowany',
    portionG: 150,
    dishCompleteness: 'CARB_SIDE',
    category: 'side_dish',
    cuisineType: 'polska',
    prepMinutes: 2,
    cookMinutes: 35,
    steps: [
      'Wsyp 75 g suchego ryżu brązowego do garnka, zalej 200 ml wody i dodaj szczyptę soli.',
      'Doprowadź do wrzenia, zmniejsz ogień, przykryj i gotuj 30-35 min, aż ryż wchłonie wodę i będzie miękki.',
    ],
  },
  {
    title: 'Makaron pełnoziarnisty gotowany',
    slug: 'makaron-pelnoziarnisty-gotowany',
    cleanProductPattern: 'makaron, pełnoziarnisty(a), 51% {{PH_whole wheat}}, remaining unenriched kasza manna, gotowany(a)',
    portionG: 150,
    dishCompleteness: 'CARB_SIDE',
    category: 'side_dish',
    cuisineType: 'wloska',
    prepMinutes: 2,
    cookMinutes: 11,
    steps: [
      'Zagotuj garnek osolonej wody (1 łyżka soli na 1 l).',
      'Wrzuć 75 g suchego makaronu pełnoziarnistego, gotuj 8-11 min al dente. Odcedź i podawaj.',
    ],
  },
  {
    title: 'Makaron pszenny gotowany',
    slug: 'makaron-pszenny-gotowany',
    cleanProductPattern: 'makaron, gotowany(a), wzbogacony(a), bez dodany sól',
    portionG: 150,
    dishCompleteness: 'CARB_SIDE',
    category: 'side_dish',
    cuisineType: 'wloska',
    prepMinutes: 2,
    cookMinutes: 9,
    steps: [
      'Zagotuj duży garnek osolonej wody.',
      'Wrzuć 75 g suchego makaronu, gotuj 7-9 min al dente. Odcedź i wymieszaj z odrobiną oliwy, żeby się nie skleił.',
    ],
  },
  {
    title: 'Kasza jaglana na sypko',
    slug: 'kasza-jaglana-na-sypko',
    cleanProductPattern: 'kasza jaglana, gotowany(a)',
    portionG: 150,
    dishCompleteness: 'CARB_SIDE',
    category: 'side_dish',
    cuisineType: 'polska',
    prepMinutes: 3,
    cookMinutes: 17,
    steps: [
      'Przepłucz 75 g kaszy jaglanej zimną wodą, sparz wrzątkiem (usuwa goryczkę).',
      'Wsyp do garnka, zalej 150 ml wody, dodaj szczyptę soli. Gotuj pod przykryciem na małym ogniu 15-17 min do wchłonięcia wody. Odstaw 5 min.',
    ],
  },
  {
    title: 'Kuskus gotowany',
    slug: 'kuskus-gotowany',
    cleanProductPattern: 'kuskus, gotowany(a)',
    portionG: 150,
    dishCompleteness: 'CARB_SIDE',
    category: 'side_dish',
    cuisineType: 'srodziemnomorska',
    prepMinutes: 1,
    cookMinutes: 6,
    steps: [
      'Zalej 100 g kuskusu 130 ml wrzącej osolonej wody.',
      'Przykryj na 5 min. Spulchnij widelcem przed podaniem.',
    ],
  },
  {
    title: 'Bulgur gotowany',
    slug: 'bulgur-gotowany',
    cleanProductPattern: 'bulgur, suchy',
    portionG: 50,  // 50g dry → ~150g cooked; nutrition computed on dry weight
    dishCompleteness: 'CARB_SIDE',
    category: 'side_dish',
    cuisineType: 'srodziemnomorska',
    prepMinutes: 2,
    cookMinutes: 12,
    steps: [
      'Wsyp 50 g bulguru (suchego) do garnka, zalej 100 ml wody i dodaj szczyptę soli.',
      'Doprowadź do wrzenia, zmniejsz ogień, gotuj pod przykryciem 10-12 min, aż wchłonie wodę (objętość rośnie ~3×). Spulchnij widelcem.',
    ],
  },
  {
    title: 'Ziemniaki gotowane z koperkiem',
    slug: 'ziemniaki-gotowane-z-koperkiem',
    cleanProductPattern: 'ziemniaki, gotowany(a)',
    portionG: 200,
    dishCompleteness: 'CARB_SIDE',
    category: 'side_dish',
    cuisineType: 'polska',
    prepMinutes: 5,
    cookMinutes: 25,
    steps: [
      'Obierz i pokrój 250 g ziemniaków na kawałki. Zalej osoloną wodą i gotuj 20-25 min do miękkości.',
      'Odcedź, posyp świeżym koperkiem.',
    ],
  },
  {
    title: 'Puree ziemniaczane',
    slug: 'puree-ziemniaczane',
    cleanProductPattern: 'ziemniaki, mashed, dehydrated, prepared',
    portionG: 200,
    dishCompleteness: 'CARB_SIDE',
    category: 'side_dish',
    cuisineType: 'polska',
    prepMinutes: 5,
    cookMinutes: 25,
    steps: [
      'Ugotuj 250 g obranych ziemniaków w osolonej wodzie 20-25 min.',
      'Odcedź, dodaj 30 ml mleka i łyżkę masła, ugnieć tłuczkiem na gładką masę. Dopraw solą i pieprzem.',
    ],
  },
  {
    title: 'Makaron ryżowy gotowany',
    slug: 'makaron-ryzowy-gotowany',
    cleanProductPattern: 'makaron ryżowy, gotowany(a)',
    portionG: 150,
    dishCompleteness: 'CARB_SIDE',
    category: 'side_dish',
    cuisineType: 'azjatycka',
    prepMinutes: 2,
    cookMinutes: 5,
    steps: [
      'Zalej 75 g suchego makaronu ryżowego wrzącą wodą.',
      'Pozostaw na 4-5 min, przemieszaj, odcedź.',
    ],
  },

  // ─── VEG_SIDE ──────────────────────────────────────────────────────────
  {
    title: 'Brokuły gotowane na parze',
    slug: 'brokuly-gotowane-na-parze',
    cleanProductPattern: 'brokuł, gotowany(a), gotowany(a), drained, bez sól',
    portionG: 200,
    dishCompleteness: 'VEG_SIDE',
    category: 'side_dish',
    cuisineType: 'polska',
    prepMinutes: 3,
    cookMinutes: 8,
    steps: [
      'Podziel brokuły na różyczki (200 g netto). Umyj.',
      'Gotuj na parze 6-8 min, do uzyskania al dente. Skrop oliwą, dopraw solą i pieprzem.',
    ],
  },
  {
    title: 'Kalafior gotowany',
    slug: 'kalafior-gotowany',
    cleanProductPattern: 'kalafior, gotowany(a), gotowany(a), drained, bez sól',
    portionG: 200,
    dishCompleteness: 'VEG_SIDE',
    category: 'side_dish',
    cuisineType: 'polska',
    prepMinutes: 3,
    cookMinutes: 10,
    steps: [
      'Podziel kalafior na różyczki (200 g netto). Umyj.',
      'Gotuj w osolonej wodzie 8-10 min do miękkości. Odcedź.',
    ],
  },
  {
    title: 'Marchewka gotowana',
    slug: 'marchewka-gotowana',
    cleanProductPattern: 'marchewki, gotowany(a), gotowany(a), drained, bez sól',
    portionG: 200,
    dishCompleteness: 'VEG_SIDE',
    category: 'side_dish',
    cuisineType: 'polska',
    prepMinutes: 5,
    cookMinutes: 15,
    steps: [
      'Obierz i pokrój 250 g marchwi w plasterki.',
      'Gotuj w osolonej wodzie 12-15 min do miękkości. Odcedź, ewentualnie polej masłem.',
    ],
  },
  {
    title: 'Fasolka szparagowa na parze',
    slug: 'fasolka-szparagowa-na-parze',
    cleanProductPattern: 'fasolka szparagowa zielona',
    portionG: 200,
    dishCompleteness: 'VEG_SIDE',
    category: 'side_dish',
    cuisineType: 'polska',
    prepMinutes: 5,
    cookMinutes: 7,
    steps: [
      'Umyj 200 g fasolki szparagowej, odetnij końcówki.',
      'Gotuj na parze 5-7 min do al dente. Polej oliwą, posyp solą i czosnkiem.',
    ],
  },
  {
    title: 'Szpinak duszony',
    slug: 'szpinak-duszony',
    cleanProductPattern: 'szpinak, gotowany(a), gotowany(a), drained, bez sól',
    portionG: 200,
    dishCompleteness: 'VEG_SIDE',
    category: 'side_dish',
    cuisineType: 'polska',
    prepMinutes: 5,
    cookMinutes: 6,
    steps: [
      'Rozgrzej łyżkę oliwy z drobno posiekanym ząbkiem czosnku.',
      'Wrzuć 200 g szpinaku, duś 4-6 min mieszając, aż zwiędnie. Dopraw solą i pieprzem.',
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface CleanProductWithNutrients {
  id: string;
  name: string;
  nutrients: {
    kcalPer100g: Prisma.Decimal;
    proteinPer100g: Prisma.Decimal;
    fatPer100g: Prisma.Decimal;
    carbsPer100g: Prisma.Decimal;
    fiberPer100g: Prisma.Decimal | null;
    saltPer100g: Prisma.Decimal | null;
    sugarsPer100g: Prisma.Decimal | null;
    saturatedFatPer100g: Prisma.Decimal | null;
  } | null;
}

async function findCleanProduct(pattern: string): Promise<CleanProductWithNutrients | null> {
  // Look up by exact name (preferred), then ILIKE fallback.
  const exact = await prisma.cleanProduct.findFirst({
    where: { name: pattern },
    select: {
      id: true, name: true,
      nutrients: { select: {
        kcalPer100g: true, proteinPer100g: true, fatPer100g: true,
        carbsPer100g: true, fiberPer100g: true, saltPer100g: true,
        sugarsPer100g: true, saturatedFatPer100g: true,
      }},
    },
  });
  if (exact?.nutrients) return exact;

  // ILIKE fallback — escape % in pattern was already done at definition site
  const ilike = await prisma.cleanProduct.findFirst({
    where: {
      name: { contains: pattern.replace(/%%/g, '%').slice(0, 60), mode: 'insensitive' },
      nutrients: { isNot: null },
    },
    select: {
      id: true, name: true,
      nutrients: { select: {
        kcalPer100g: true, proteinPer100g: true, fatPer100g: true,
        carbsPer100g: true, fiberPer100g: true, saltPer100g: true,
        sugarsPer100g: true, saturatedFatPer100g: true,
      }},
    },
    orderBy: { qualityScore: 'desc' },
  });
  return ilike;
}

function toNum(d: Prisma.Decimal | null | undefined): number {
  return d == null ? 0 : Number(d);
}

async function main() {
  console.log('\n=== Faza D.6 — Seeding basic side-dish recipes ===');
  console.log(`Mode: ${APPLY ? 'LIVE (writes)' : 'DRY RUN'}\n`);

  let created = 0;
  let skipped = 0;
  let missing = 0;

  for (const def of SIDE_DISHES) {
    // Skip if already exists
    const existing = await prisma.recipe.findUnique({ where: { slug: def.slug }, select: { id: true } });
    if (existing) {
      console.log(`  [skip already exists]  ${def.title}`);
      skipped++;
      continue;
    }

    const cp = await findCleanProduct(def.cleanProductPattern);
    if (!cp || !cp.nutrients) {
      console.log(`  [MISSING CleanProduct] ${def.title}  (pattern: "${def.cleanProductPattern}")`);
      missing++;
      continue;
    }

    // Compute per-serving nutrition: per100g × portionG / 100
    const f = def.portionG / 100;
    const kcal = toNum(cp.nutrients.kcalPer100g) * f;
    const protein = toNum(cp.nutrients.proteinPer100g) * f;
    const fat = toNum(cp.nutrients.fatPer100g) * f;
    const carbs = toNum(cp.nutrients.carbsPer100g) * f;
    const fiber = toNum(cp.nutrients.fiberPer100g) * f;
    const salt = toNum(cp.nutrients.saltPer100g) * f;
    const sugars = toNum(cp.nutrients.sugarsPer100g) * f;
    const satFat = toNum(cp.nutrients.saturatedFatPer100g) * f;

    console.log(`  [${def.dishCompleteness} ${Math.round(kcal).toString().padStart(3)} kcal/p]  ${def.title}`);
    console.log(`    ↳ matched CleanProduct: ${cp.name}`);

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.create({
        data: {
          source: 'manual',
          origin: 'manual',
          aiApproved: false,
          title: def.title,
          slug: def.slug,
          description: `Podstawowy dodatek ${def.dishCompleteness === 'CARB_SIDE' ? 'węglowodanowy' : 'warzywny'} do dań głównych.`,
          category: def.category,
          cuisineType: def.cuisineType,
          mealType: 'SIDE_DISH',
          difficulty: 'EASY',
          prepTimeMinutes: def.prepMinutes,
          cookTimeMinutes: def.cookMinutes,
          totalTimeMinutes: def.prepMinutes + def.cookMinutes,
          servings: 1,
          servingType: 'PER_PORTION',
          dishCompleteness: def.dishCompleteness,
          containsVegetableServing: def.dishCompleteness === 'VEG_SIDE',
          vegetableWeightG: def.dishCompleteness === 'VEG_SIDE' ? def.portionG : 0,
          tags: ['side', 'basic', def.dishCompleteness.toLowerCase()],
          isActive: true,
          qualityScore: 90,
          verificationStatus: 'MANUALLY_VERIFIED',
          mealPrepFriendly: true,
        },
      });

      await tx.recipeIngredient.create({
        data: {
          recipeId: recipe.id,
          cleanProductId: cp.id,
          sortOrder: 0,
          quantity: def.portionG,
          unit: 'g',
          grams: def.portionG,
          isOptional: false,
        },
      });

      for (let i = 0; i < def.steps.length; i++) {
        await tx.recipeInstructionStep.create({
          data: {
            recipeId: recipe.id,
            stepNumber: i + 1,
            instruction: def.steps[i]!,
          },
        });
      }

      await tx.recipeNutritionSnapshot.create({
        data: {
          recipeId: recipe.id,
          // Per-serving (servings = 1 for these basic side recipes)
          kcal: kcal,
          protein_g: protein,
          fat_g: fat,
          carbs_g: carbs,
          fiber_g: fiber || null,
          salt_g: salt || null,
          sugars_g: sugars || null,
          saturatedFat_g: satFat || null,
          // Recipe-wide totals (= per-serving × servings; servings=1 → same)
          totalKcal: kcal,
          totalProtein_g: protein,
          totalFat_g: fat,
          totalCarbs_g: carbs,
        },
      });
    });

    created++;
  }

  console.log(`\nSummary: ${created} created, ${skipped} skipped (already exist), ${missing} missing CleanProduct.`);
  if (!APPLY) {
    console.log('(dry-run — pass --apply to write)\n');
  } else {
    console.log('Done.\n');
  }
}

main()
  .catch((e) => { console.error('FAILED:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
