/**
 * Clean and normalize Open Food Facts Poland data.
 * - Deduplicate by brand+name
 * - Normalize Polish names
 * - Map allergens_tags → EU 14 codes
 * - Parse quantity → packageWeightG
 * - Parse serving_size → servingWeightG
 *
 * Output: data/cleaned-retail-products.json
 *
 * Usage: node scripts/clean-off-poland.js
 */

const path = require('path');
const fs = require('fs');

// ─── EU 14 allergen mapping ───────────────────────────────────────────
const ALLERGEN_MAP = {
  'en:gluten': 'GLUTEN',
  'en:cereals-containing-gluten': 'GLUTEN',
  'en:wheat': 'GLUTEN',
  'en:barley': 'GLUTEN',
  'en:rye': 'GLUTEN',
  'en:oats': 'GLUTEN',
  'en:spelt': 'GLUTEN',
  'en:kamut': 'GLUTEN',
  'en:crustaceans': 'CRUSTACEANS',
  'en:eggs': 'EGGS',
  'en:fish': 'FISH',
  'en:peanuts': 'PEANUTS',
  'en:soybeans': 'SOYBEANS',
  'en:soya': 'SOYBEANS',
  'en:milk': 'MILK',
  'en:lactose': 'MILK',
  'en:nuts': 'TREE_NUTS',
  'en:almonds': 'TREE_NUTS',
  'en:hazelnuts': 'TREE_NUTS',
  'en:walnuts': 'TREE_NUTS',
  'en:cashew-nuts': 'TREE_NUTS',
  'en:pecan-nuts': 'TREE_NUTS',
  'en:brazil-nuts': 'TREE_NUTS',
  'en:pistachio-nuts': 'TREE_NUTS',
  'en:macadamia-nuts': 'TREE_NUTS',
  'en:celery': 'CELERY',
  'en:mustard': 'MUSTARD',
  'en:sesame-seeds': 'SESAME',
  'en:sulphur-dioxide-and-sulphites': 'SULPHITES',
  'en:sulphites': 'SULPHITES',
  'en:lupin': 'LUPIN',
  'en:lupine': 'LUPIN',
  'en:molluscs': 'MOLLUSCS',
};

function mapAllergens(tags) {
  const allergens = new Set();
  for (const tag of tags) {
    const code = ALLERGEN_MAP[tag.toLowerCase()];
    if (code) allergens.add(code);
  }
  return [...allergens];
}

function mapTraces(tags) {
  const traces = new Set();
  for (const tag of tags) {
    const code = ALLERGEN_MAP[tag.toLowerCase()];
    if (code) traces.add(code);
  }
  return [...traces];
}

/**
 * Normalize a Polish product name
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    // Fix common encoding issues
    .replace(/Ã³/g, 'ó')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Å‚/g, 'ł')
    .replace(/Å›/g, 'ś')
    .replace(/Å¼/g, 'ż')
    .replace(/Å¹/g, 'ź')
    .replace(/Ä‡/g, 'ć')
    .replace(/Ä™/g, 'ę')
    .replace(/Ä…/g, 'ą')
    .replace(/Å„/g, 'ń')
    .trim();
}

/**
 * Create a dedup key from brand + normalized name
 */
function dedupKey(product) {
  const brand = (product.brands || '').toLowerCase().trim();
  const name = product.name.toLowerCase().trim();
  return `${brand}|||${name}`;
}

function main() {
  console.log('=== OFF Poland Cleaner ===\n');

  const raw = require(path.join(__dirname, '..', 'data', 'off-poland-raw.json'));
  console.log(`Input: ${raw.products.length} products\n`);

  // Step 1: Normalize names
  console.log('Step 1: Normalizing names...');
  for (const p of raw.products) {
    p.name = normalizeName(p.name);
  }

  // Step 2: Deduplicate by brand+name
  console.log('Step 2: Deduplicating by brand+name...');
  const seen = new Map();
  const unique = [];
  let dupes = 0;
  for (const p of raw.products) {
    const key = dedupKey(p);
    if (seen.has(key)) {
      dupes++;
      // Merge: keep the one with more data
      const existing = seen.get(key);
      if (!existing.allergensTags.length && p.allergensTags.length) {
        existing.allergensTags = p.allergensTags;
      }
      if (!existing.servingWeightG && p.servingWeightG) {
        existing.servingWeightG = p.servingWeightG;
        existing.servingSize = p.servingSize;
      }
      continue;
    }
    seen.set(key, p);
    unique.push(p);
  }
  console.log(`  Duplicates removed: ${dupes}`);
  console.log(`  Unique: ${unique.length}\n`);

  // Step 3: Map allergens
  console.log('Step 3: Mapping allergens to EU 14...');
  for (const p of unique) {
    p.allergensEU14 = mapAllergens(p.allergensTags || []);
    p.tracesEU14 = mapTraces(p.tracesTags || []);
  }

  // Step 4: Map categories to Polish
  // OFF categories are in English tag format — we'll keep them as-is for now
  // (category normalization happens at import time)

  // Step 5: Build output
  console.log('Step 4: Building output...\n');
  const cleaned = unique.map(p => ({
    barcode: p.barcode,
    name: p.name,
    brands: p.brands,
    quantity: p.quantity,
    servingSize: p.servingSize,
    packageWeightG: p.packageWeightG,
    servingWeightG: p.servingWeightG,
    categoriesTags: p.categoriesTags || [],
    allergensEU14: p.allergensEU14,
    tracesEU14: p.tracesEU14,
    macros: p.macros,
  }));

  // Save
  const outputPath = path.join(__dirname, '..', 'data', 'cleaned-retail-products.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    cleanedAt: new Date().toISOString(),
    source: 'Open Food Facts',
    license: 'ODbL (Open Database License)',
    attribution: 'Data from Open Food Facts (https://openfoodfacts.org) — ODbL',
    totalProducts: cleaned.length,
    products: cleaned,
  }, null, 2), 'utf-8');
  console.log(`Saved to: ${outputPath}\n`);

  // Report
  console.log('=== REPORT ===\n');
  console.log(`  Total cleaned products: ${cleaned.length}`);
  console.log(`  Duplicates removed: ${dupes}`);

  const withAllergens = cleaned.filter(p => p.allergensEU14.length > 0).length;
  const withTraces = cleaned.filter(p => p.tracesEU14.length > 0).length;
  const withServing = cleaned.filter(p => p.servingWeightG !== null).length;
  const withPackage = cleaned.filter(p => p.packageWeightG !== null).length;
  const withFullMacros = cleaned.filter(p => {
    const m = p.macros;
    return m.kcalPer100g !== null && m.proteinPer100g !== null &&
           m.fatPer100g !== null && m.carbsPer100g !== null;
  }).length;

  console.log(`\n  Completeness:`);
  console.log(`    Full macros (kcal+B+T+W): ${withFullMacros} (${Math.round(withFullMacros / cleaned.length * 100)}%)`);
  console.log(`    With EU 14 allergens: ${withAllergens} (${Math.round(withAllergens / cleaned.length * 100)}%)`);
  console.log(`    With traces: ${withTraces} (${Math.round(withTraces / cleaned.length * 100)}%)`);
  console.log(`    With serving size: ${withServing} (${Math.round(withServing / cleaned.length * 100)}%)`);
  console.log(`    With package weight: ${withPackage} (${Math.round(withPackage / cleaned.length * 100)}%)`);

  // Allergen distribution
  const allergenCounts = {};
  for (const p of cleaned) {
    for (const a of p.allergensEU14) {
      allergenCounts[a] = (allergenCounts[a] || 0) + 1;
    }
  }
  console.log(`\n  Allergen distribution:`);
  for (const [a, count] of Object.entries(allergenCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${a}: ${count}`);
  }

  console.log('\n=== Done ===');
}

main();
