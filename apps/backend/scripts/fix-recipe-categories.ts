/**
 * Fix null categories for ai_generated recipes.
 * Assigns category based on title keywords.
 *
 * Usage: npx ts-node scripts/fix-recipe-categories.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CategoryRule {
  pattern: RegExp;
  category: string;
}

const CATEGORY_RULES: CategoryRule[] = [
  // soup
  { pattern: /zupa|krem z|rosół|barszcz|chłodnik|żurek/i, category: 'soup' },
  // breakfast
  { pattern: /owsiank|muesli|granola|croissant|jajecznic|omlet|śniadani/i, category: 'breakfast' },
  // drink / smoothie
  { pattern: /smoothie|koktajl|shake|sok |napój|drink|kompot/i, category: 'drink' },
  // snack
  { pattern: /hummus|kanapk|wrap|twaróg z |jogurt |\btost\b|sałatka owocowa/i, category: 'snack' },
  // dessert
  { pattern: /deser|ciast|muffin|browni|pudding|mus |krem |panna cotta|tiramisu/i, category: 'dessert' },
  // main (must come before side_dish to avoid false matches like "surówka" in main dishes)
  { pattern: /pierś|filet|schab|udziec|kaczk|dorsz|łosoś|mintaj|sałatka z|duszony|pieczony|gotowany|kasza|ziemniak|makaron|ryż|ciecierzyc|soczewic|warzywa duszone/i, category: 'main' },
  // side_dish
  { pattern: /surówk|sos |dip |pesto|dressing/i, category: 'side_dish' },
];

function inferCategory(title: string): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(title)) {
      return rule.category;
    }
  }
  return 'main'; // safe default for ai_generated recipes
}

async function main() {
  const recipes = await prisma.recipe.findMany({
    where: { category: null },
    select: { id: true, title: true },
  });

  console.log(`Found ${recipes.length} recipes with null category\n`);

  const updates: { id: string; title: string; category: string }[] = [];

  for (const r of recipes) {
    const category = inferCategory(r.title);
    updates.push({ id: r.id, title: r.title, category });
    console.log(`  ${r.title} → ${category}`);
  }

  console.log(`\nApplying ${updates.length} updates...`);

  await prisma.$transaction(
    updates.map((u) =>
      prisma.recipe.update({
        where: { id: u.id },
        data: { category: u.category },
      }),
    ),
  );

  // Verify
  const remaining = await prisma.recipe.count({ where: { category: null } });
  console.log(`\nDone. Recipes with null category remaining: ${remaining}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
