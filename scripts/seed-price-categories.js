/**
 * 37.6.2 — Seed price categories on CleanProduct.
 * Tags top products by heuristic price category.
 * Run: node scripts/seed-price-categories.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BUDGET_KEYWORDS = [
  'jajko', 'jaja', 'kurczak', 'pierś z kurczaka', 'udko', 'twaróg', 'ser biały',
  'fasola', 'soczewica', 'groch', 'ciecierzyca', 'ryż', 'makaron', 'kasza',
  'marchew', 'cebula', 'kapusta', 'ziemniaki', 'buraki', 'por',
  'płatki owsiane', 'mąka', 'chleb', 'mleko', 'kefir', 'jogurt naturalny',
  'banan', 'jabłko', 'olej', 'masło', 'smalec',
  'parówki', 'kiełbasa', 'tuńczyk w puszce', 'sardynki',
];

const PREMIUM_KEYWORDS = [
  'łosoś', 'dorsz', 'krewetki', 'małże', 'ośmiornica', 'kalmary',
  'awokado', 'quinoa', 'komosa ryżowa', 'orzechy makadamia', 'orzechy nerkowca',
  'stek', 'wołowina', 'polędwica wołowa', 'jagnięcina', 'cielęcina',
  'szparagi', 'karczochy', 'trufle', 'szafran',
  'mascarpone', 'gorgonzola', 'camembert', 'brie', 'parmezan',
  'oliwa z oliwek extra', 'olej kokosowy', 'masło klarowane ghee',
  'migdały', 'pistacje', 'orzechy pekan',
  'jagody goji', 'spirulina', 'chlorella', 'matcha',
  'prosciutto', 'jamón', 'szynka parmeńska',
];

async function main() {
  console.log('Seeding price categories...');

  // Reset all to STANDARD first
  await prisma.cleanProduct.updateMany({ data: { priceCategory: 'STANDARD' } });

  let budgetCount = 0;
  let premiumCount = 0;

  for (const keyword of BUDGET_KEYWORDS) {
    const result = await prisma.cleanProduct.updateMany({
      where: {
        name: { contains: keyword, mode: 'insensitive' },
        priceCategory: 'STANDARD',
      },
      data: { priceCategory: 'BUDGET' },
    });
    budgetCount += result.count;
  }

  for (const keyword of PREMIUM_KEYWORDS) {
    const result = await prisma.cleanProduct.updateMany({
      where: {
        name: { contains: keyword, mode: 'insensitive' },
        priceCategory: 'STANDARD',
      },
      data: { priceCategory: 'PREMIUM' },
    });
    premiumCount += result.count;
  }

  const total = await prisma.cleanProduct.count();
  console.log(`Done! Budget: ${budgetCount}, Premium: ${premiumCount}, Standard: ${total - budgetCount - premiumCount}, Total: ${total}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
