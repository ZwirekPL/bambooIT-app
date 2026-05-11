/**
 * Normalize Recipe.category values in the database.
 *
 * Scrapers pull categories from breadcrumbs, tags, and JSON-LD — resulting in
 * inconsistent casing, missing Polish diacritics, and site-specific naming.
 * This script maps all variants to canonical lowercase Polish labels.
 *
 * Canonical categories:
 *   śniadania | zupy | dania główne | sałatki | kanapki | przekąski |
 *   desery | napoje | makarony | dania z ryżu | ryby i owoce morza |
 *   drób | mięso | wegetariańskie | wegańskie | inne
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/normalize-recipe-categories.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/normalize-recipe-categories.ts --dry-run
 */

import { prisma } from '@db';

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Canonical category map ────────────────────────────────────────────────────
// key: regex or exact string to match (case-insensitive, trimmed)
// value: canonical label

const CANONICAL_CATEGORIES: Array<{ pattern: RegExp; canonical: string }> = [
  // Breakfast
  { pattern: /^śniadani[ae]?$/i,            canonical: 'śniadania' },
  { pattern: /^sniadani[ae]?$/i,            canonical: 'śniadania' },
  { pattern: /^breakfast$/i,                canonical: 'śniadania' },
  { pattern: /^II?\s*śniadani[ae]?$/i,      canonical: 'śniadania' },
  { pattern: /^drugie\s*śniadani[ae]?$/i,   canonical: 'śniadania' },

  // Soups
  { pattern: /^zup[ayię]$/i,               canonical: 'zupy' },
  { pattern: /^krem$/i,                    canonical: 'zupy' },
  { pattern: /^zupy\s*i\s*kremy$/i,        canonical: 'zupy' },
  { pattern: /^zupy\s*krem$/i,             canonical: 'zupy' },
  { pattern: /^soup[s]?$/i,               canonical: 'zupy' },

  // Main courses
  { pattern: /^dania\s*główne?$/i,          canonical: 'dania główne' },
  { pattern: /^dania\s*glowne?$/i,          canonical: 'dania główne' },
  { pattern: /^danie\s*główne?$/i,          canonical: 'dania główne' },
  { pattern: /^obiad[y]?$/i,               canonical: 'dania główne' },
  { pattern: /^main\s*course[s]?$/i,       canonical: 'dania główne' },
  { pattern: /^dania\s*główne?\s*i\s*.+$/i, canonical: 'dania główne' },
  { pattern: /^dania\s*obiadowe?$/i,        canonical: 'dania główne' },
  { pattern: /^kolacj[ae]?$/i,             canonical: 'dania główne' },
  { pattern: /^kolacje$/i,                 canonical: 'dania główne' },

  // Salads
  { pattern: /^sałatk[aię]$/i,             canonical: 'sałatki' },
  { pattern: /^salatk[aię]$/i,             canonical: 'sałatki' },
  { pattern: /^salad[s]?$/i,              canonical: 'sałatki' },

  // Sandwiches / wraps
  { pattern: /^kanapk[aię]$/i,             canonical: 'kanapki' },
  { pattern: /^kanapki\s*i\s*.+$/i,        canonical: 'kanapki' },
  { pattern: /^wrap[sy]?$/i,              canonical: 'kanapki' },
  { pattern: /^tortilla[sy]?$/i,          canonical: 'kanapki' },

  // Snacks / appetizers
  { pattern: /^przekąsk[ai]$/i,            canonical: 'przekąski' },
  { pattern: /^przekask[ai]$/i,            canonical: 'przekąski' },
  { pattern: /^snack[s]?$/i,              canonical: 'przekąski' },
  { pattern: /^przekąski\s*i\s*.+$/i,      canonical: 'przekąski' },
  { pattern: /^appetizer[s]?$/i,          canonical: 'przekąski' },
  { pattern: /^podwieczorek$/i,            canonical: 'przekąski' },

  // Desserts
  { pattern: /^desery?$/i,                canonical: 'desery' },
  { pattern: /^deser$/i,                  canonical: 'desery' },
  { pattern: /^dessert[s]?$/i,            canonical: 'desery' },
  { pattern: /^ciast[oae]$/i,             canonical: 'desery' },
  { pattern: /^ciasta\s*i\s*desery?$/i,   canonical: 'desery' },
  { pattern: /^słodko[sś]ci$/i,           canonical: 'desery' },

  // Drinks
  { pattern: /^napoj[eę]$/i,              canonical: 'napoje' },
  { pattern: /^napoje?$/i,                canonical: 'napoje' },
  { pattern: /^drink[s]?$/i,             canonical: 'napoje' },
  { pattern: /^smoothie[s]?$/i,          canonical: 'napoje' },
  { pattern: /^koktajl[e]?$/i,           canonical: 'napoje' },
  { pattern: /^shake[s]?$/i,             canonical: 'napoje' },
  { pattern: /^sok[i]?$/i,               canonical: 'napoje' },

  // Pasta
  { pattern: /^makarony?$/i,              canonical: 'makarony' },
  { pattern: /^pasta[s]?$/i,             canonical: 'makarony' },
  { pattern: /^dania\s*z\s*makaron[u]?$/i, canonical: 'makarony' },

  // Rice dishes
  { pattern: /^dania\s*z\s*ryż[u]?$/i,   canonical: 'dania z ryżu' },
  { pattern: /^ryż$/i,                   canonical: 'dania z ryżu' },
  { pattern: /^rice$/i,                  canonical: 'dania z ryżu' },

  // Fish & seafood
  { pattern: /^ryby?$/i,                 canonical: 'ryby i owoce morza' },
  { pattern: /^ryby\s*i\s*owoce\s*morza$/i, canonical: 'ryby i owoce morza' },
  { pattern: /^owoce\s*morza$/i,          canonical: 'ryby i owoce morza' },
  { pattern: /^fish$/i,                  canonical: 'ryby i owoce morza' },
  { pattern: /^seafood$/i,               canonical: 'ryby i owoce morza' },

  // Poultry
  { pattern: /^drób$/i,                  canonical: 'drób' },
  { pattern: /^kurczak$/i,               canonical: 'drób' },
  { pattern: /^poultry$/i,               canonical: 'drób' },
  { pattern: /^dania\s*z\s*kurczak[a]?$/i, canonical: 'drób' },
  { pattern: /^dania\s*z\s*drob[iu]$/i,   canonical: 'drób' },

  // Meat
  { pattern: /^mięso$/i,                 canonical: 'mięso' },
  { pattern: /^mieso$/i,                 canonical: 'mięso' },
  { pattern: /^wołowina$/i,              canonical: 'mięso' },
  { pattern: /^wieprzowina$/i,           canonical: 'mięso' },
  { pattern: /^meat$/i,                  canonical: 'mięso' },
  { pattern: /^dania\s*mięsne?$/i,        canonical: 'mięso' },

  // Vegetarian
  { pattern: /^wegetariań?skie?$/i,      canonical: 'wegetariańskie' },
  { pattern: /^vegetarian$/i,            canonical: 'wegetariańskie' },
  { pattern: /^dania\s*wegetariań?skie?$/i, canonical: 'wegetariańskie' },

  // Vegan
  { pattern: /^wegań?skie?$/i,           canonical: 'wegańskie' },
  { pattern: /^vegan$/i,                 canonical: 'wegańskie' },
  { pattern: /^dania\s*wegań?skie?$/i,    canonical: 'wegańskie' },

  // Sauces / sides
  { pattern: /^sosy?$/i,                 canonical: 'sosy i dodatki' },
  { pattern: /^sauce[s]?$/i,            canonical: 'sosy i dodatki' },
  { pattern: /^dodatki?$/i,              canonical: 'sosy i dodatki' },
  { pattern: /^side\s*dish(es)?$/i,      canonical: 'sosy i dodatki' },
];

function normalizeCategory(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  for (const { pattern, canonical } of CANONICAL_CATEGORIES) {
    if (pattern.test(trimmed)) return canonical;
  }

  // Fallback: lowercase + trim (at least standardize casing)
  const lower = trimmed.toLowerCase();
  // Polish diacritic normalization for common patterns
  const diacriticFix = lower
    .replace(/sn/g, 'śn')   // "sniadania" → keep as-is, handled above
    .replace(/glowne/g, 'główne')
    .replace(/salatki/g, 'sałatki')
    .replace(/przekaski/g, 'przekąski');

  // If it differs from original, return normalized version
  if (diacriticFix !== lower || lower !== raw) return lower;

  return null; // no change needed
}

async function main() {
  console.log(`\n=== Recipe Category Normalization ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  // Get all distinct categories
  const grouped = await prisma.recipe.groupBy({
    by: ['category'],
    _count: true,
    orderBy: { _count: { category: 'desc' } },
  });

  console.log(`Distinct categories in DB: ${grouped.length}\n`);

  const toUpdate: Array<{ from: string | null; to: string; count: number }> = [];
  const unchanged: Array<{ category: string | null; count: number }> = [];

  for (const { category, _count } of grouped) {
    if (!category) {
      console.log(`  [NULL] ${_count} recipes — skipping`);
      continue;
    }

    const normalized = normalizeCategory(category);
    if (normalized && normalized !== category) {
      toUpdate.push({ from: category, to: normalized, count: _count });
    } else {
      unchanged.push({ category, count: _count });
    }
  }

  console.log('--- Changes planned ---');
  for (const u of toUpdate) {
    console.log(`  "${u.from}" → "${u.to}" (${u.count} recipes)`);
  }

  console.log(`\n--- Unchanged (already canonical or unknown) ---`);
  for (const u of unchanged) {
    console.log(`  "${u.category ?? 'NULL'}" (${u.count} recipes)`);
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] No changes made.\n`);
    return;
  }

  if (toUpdate.length === 0) {
    console.log('\nNothing to update.\n');
    return;
  }

  console.log(`\nApplying ${toUpdate.length} category renames...`);
  let total = 0;
  for (const { from, to, count } of toUpdate) {
    const result = await prisma.recipe.updateMany({
      where: { category: from },
      data: { category: to },
    });
    console.log(`  "${from}" → "${to}": updated ${result.count} / ${count}`);
    total += result.count;
  }

  console.log(`\nDone! Normalized ${total} recipes.\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
