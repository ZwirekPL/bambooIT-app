/**
 * Fix Recipe enums — normalize Polish free-text values to enum codes.
 *
 * Fields:
 *   category   (String?)          → "main" | "soup" | "salad" | "dessert" | "other"
 *   difficulty (RecipeDifficulty) → EASY | MEDIUM | HARD
 *   mealType   (RecipeMealType)   → BREAKFAST | LUNCH | DINNER | SNACK | ...
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register scripts/fix-recipe-enums.ts
 */

import { prisma } from '../packages/database/dist/index.js';

// ─── Mappings ────────────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  'dania główne': 'main',
  'danie główne': 'main',
  'zupy': 'soup',
  'zupa': 'soup',
  'sałatki': 'salad',
  'sałatka': 'salad',
  'salatki': 'salad',
  'salatka': 'salad',
  'desery': 'dessert',
  'deser': 'dessert',
  'inne': 'other',
  'śniadania': 'breakfast',
  'śniadanie': 'breakfast',
  'sniadania': 'breakfast',
  'napoje': 'drink',
  'napój': 'drink',
  'napoj': 'drink',
  'przekąski': 'snack',
  'przekąska': 'snack',
  'przekaski': 'snack',
  'dodatki': 'side_dish',
  'dodatek': 'side_dish',
};

const DIFFICULTY_MAP: Record<string, string> = {
  'łatwy': 'EASY',
  'łatwe': 'EASY',
  'latwy': 'EASY',
  'prosty': 'EASY',
  'proste': 'EASY',
  'szybki': 'EASY',
  'szybkie': 'EASY',
  'easy': 'EASY',
  'średni': 'MEDIUM',
  'sredni': 'MEDIUM',
  'medium': 'MEDIUM',
  'trudny': 'HARD',
  'trudne': 'HARD',
  'hard': 'HARD',
};

const MEAL_TYPE_MAP: Record<string, string> = {
  'śniadanie': 'BREAKFAST',
  'sniadanie': 'BREAKFAST',
  'breakfast': 'BREAKFAST',
  'drugie śniadanie': 'SECOND_BREAKFAST',
  'drugie sniadanie': 'SECOND_BREAKFAST',
  'obiad': 'LUNCH',
  'lunch': 'LUNCH',
  'kolacja': 'DINNER',
  'dinner': 'DINNER',
  'podwieczorek': 'SUPPER',
  'supper': 'SUPPER',
  'przekąska': 'SNACK',
  'przekaska': 'SNACK',
  'snack': 'SNACK',
  'deser': 'DESSERT',
  'dessert': 'DESSERT',
  'napój': 'DRINK',
  'napoj': 'DRINK',
  'drink': 'DRINK',
  'sos': 'SAUCE',
  'sauce': 'SAUCE',
  'dodatek': 'SIDE_DISH',
  'side_dish': 'SIDE_DISH',
};

const VALID_CATEGORIES = ['main', 'soup', 'salad', 'dessert', 'other', 'breakfast', 'drink', 'snack', 'side_dish'];

// ─── Fix category (String field — standard Prisma) ──────────────────────────

async function fixCategory(): Promise<void> {
  console.log('\n═══ CATEGORY (String field) ═══');

  const recipes = await prisma.recipe.findMany({
    where: { category: { not: null } },
    select: { id: true, category: true },
  });

  console.log(`Znaleziono ${recipes.length} przepisów z category != null`);

  let updated = 0;
  const unmapped = new Map<string, number>();

  for (const r of recipes) {
    const raw = (r.category ?? '').trim().toLowerCase();
    if (!raw) continue;

    // Already a valid value — skip
    if (VALID_CATEGORIES.includes(raw) && r.category === raw) continue;

    const mapped = CATEGORY_MAP[raw];
    if (mapped && r.category !== mapped) {
      await prisma.recipe.update({
        where: { id: r.id },
        data: { category: mapped },
      });
      updated++;
    } else if (!mapped && !VALID_CATEGORIES.includes(raw)) {
      unmapped.set(r.category!, (unmapped.get(r.category!) ?? 0) + 1);
    }
  }

  console.log(`Zaktualizowano: ${updated}`);
  if (unmapped.size > 0) {
    console.log('Niezmapowane wartości:');
    for (const [val, count] of unmapped) {
      console.log(`  "${val}" × ${count}`);
    }
  }
}

// ─── Fix enum fields via raw SQL ────────────────────────────────────────────
// PostgreSQL enum columns reject non-enum values, so Polish text can only
// exist if data was inserted via raw SQL or if the schema was previously a
// plain String. We cast to text for comparison and back to enum for update.

async function fixEnumField(
  label: string,
  mapping: Record<string, string>,
  columnName: string,
  enumTypeName: string,
): Promise<void> {
  console.log(`\n═══ ${label} (enum: ${enumTypeName}) ═══`);

  // Get all distinct values as text
  const rows = await prisma.$queryRawUnsafe<Array<{ val: string }>>(
    `SELECT DISTINCT "${columnName}"::text AS val FROM "Recipe" WHERE "${columnName}" IS NOT NULL`,
  );

  const distinctValues = rows.map((r) => r.val);
  console.log(`Distinct wartości w DB: [${distinctValues.join(', ')}]`);

  const validEnumValues = new Set(Object.values(mapping));
  let totalUpdated = 0;
  const unmapped: string[] = [];

  for (const val of distinctValues) {
    const lower = val.trim().toLowerCase();
    const mapped = mapping[lower];

    if (mapped && mapped !== val) {
      // Update via raw SQL with proper enum cast
      const count: number = await prisma.$executeRawUnsafe(
        `UPDATE "Recipe" SET "${columnName}" = $1::text::"${enumTypeName}" WHERE "${columnName}"::text = $2`,
        mapped,
        val,
      );
      console.log(`  "${val}" → "${mapped}": ${count} rekordów`);
      totalUpdated += count;
    } else if (!mapped && !validEnumValues.has(val)) {
      unmapped.push(val);
    }
  }

  console.log(`Zaktualizowano łącznie: ${totalUpdated}`);
  if (unmapped.length > 0) {
    console.log(`Niezmapowane wartości: ${JSON.stringify(unmapped)}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Fix Recipe Enums ===');
  console.log(`Data: ${new Date().toISOString()}`);

  const total = await prisma.recipe.count();
  console.log(`Łączna liczba przepisów w bazie: ${total}`);

  await fixCategory();
  await fixEnumField('DIFFICULTY', DIFFICULTY_MAP, 'difficulty', 'RecipeDifficulty');
  await fixEnumField('MEAL_TYPE', MEAL_TYPE_MAP, 'mealType', 'RecipeMealType');

  console.log('\n=== Gotowe ===');
}

main()
  .catch((err) => {
    console.error('Błąd:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
