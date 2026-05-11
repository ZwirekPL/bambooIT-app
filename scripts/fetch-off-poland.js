/**
 * Fetches Open Food Facts products sold in Poland via their search API.
 * Filters, extracts relevant fields, rejects products without name/macros.
 * Output: data/off-poland-raw.json
 *
 * Usage: node scripts/fetch-off-poland.js
 */

const https = require('https');
const path = require('path');
const fs = require('fs');

const PAGE_SIZE = 100; // OFF API max
const DELAY_MS = 500; // politeness delay between pages
const FIELDS = [
  'code', 'product_name_pl', 'product_name', 'brands',
  'quantity', 'serving_size', 'categories_tags',
  'allergens_tags', 'traces_tags', 'nutriments',
].join(',');

const SEARCH_URL = `https://world.openfoodfacts.org/cgi/search.pl?action=process&tagtype_0=countries&tag_contains_0=contains&tag_0=poland&page_size=${PAGE_SIZE}&json=1&fields=${FIELDS}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('Timeout')); });
  });
}

/**
 * Parse quantity string → grams (e.g. "200g" → 200, "1.5 l" → 1500)
 */
function parseWeight(str) {
  if (!str) return null;
  const s = str.toLowerCase().trim();

  // Match patterns like "200g", "200 g", "1.5l", "500ml", "1,5 kg"
  const match = s.match(/^([\d.,]+)\s*(kg|g|ml|l|cl)\b/);
  if (!match) return null;

  const value = parseFloat(match[1].replace(',', '.'));
  if (isNaN(value)) return null;

  const unit = match[2];
  switch (unit) {
    case 'kg': return Math.round(value * 1000);
    case 'g': return Math.round(value);
    case 'l': return Math.round(value * 1000); // approximate: 1ml ≈ 1g
    case 'ml': return Math.round(value);
    case 'cl': return Math.round(value * 10);
    default: return null;
  }
}

/**
 * Extract and normalize a single product from OFF API response
 */
function extractProduct(raw) {
  const name = raw.product_name_pl || raw.product_name || '';
  const n = raw.nutriments || {};

  // Macros per 100g
  const kcal = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? null;
  const protein = n.proteins_100g ?? null;
  const fat = n.fat_100g ?? null;
  const carbs = n.carbohydrates_100g ?? null;
  const fiber = n.fiber_100g ?? null;
  const sugars = n.sugars_100g ?? null;
  const salt = n.salt_100g ?? null;
  const saturatedFat = n['saturated-fat_100g'] ?? null;

  return {
    barcode: raw.code || null,
    name: name.trim(),
    brands: (raw.brands || '').trim() || null,
    quantity: (raw.quantity || '').trim() || null,
    servingSize: (raw.serving_size || '').trim() || null,
    packageWeightG: parseWeight(raw.quantity),
    servingWeightG: parseWeight(raw.serving_size),
    categoriesTags: raw.categories_tags || [],
    allergensTags: raw.allergens_tags || [],
    tracesTags: raw.traces_tags || [],
    macros: {
      kcalPer100g: kcal !== null ? parseFloat(kcal) || 0 : null,
      proteinPer100g: protein !== null ? parseFloat(protein) || 0 : null,
      fatPer100g: fat !== null ? parseFloat(fat) || 0 : null,
      carbsPer100g: carbs !== null ? parseFloat(carbs) || 0 : null,
      fiberPer100g: fiber !== null ? parseFloat(fiber) || 0 : null,
      sugarsPer100g: sugars !== null ? parseFloat(sugars) || 0 : null,
      saltPer100g: salt !== null ? parseFloat(salt) || 0 : null,
      saturatedFatPer100g: saturatedFat !== null ? parseFloat(saturatedFat) || 0 : null,
    },
  };
}

/**
 * Check if a product should be kept (has name and at least some macros)
 */
function isValid(product) {
  if (!product.name) return false;
  const m = product.macros;
  // Reject if both kcal and protein are missing/zero
  if ((m.kcalPer100g === null || m.kcalPer100g === 0) &&
      (m.proteinPer100g === null || m.proteinPer100g === 0)) {
    return false;
  }
  return true;
}

async function main() {
  console.log('=== Open Food Facts Poland Fetcher ===\n');

  // First request to get total count
  console.log('Fetching page 1...');
  const firstPage = await fetchJson(`${SEARCH_URL}&page=1`);
  if (!firstPage || !firstPage.products) {
    console.error('Failed to fetch first page');
    process.exit(1);
  }

  const totalCount = firstPage.count;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  console.log(`Total Polish products in OFF: ${totalCount}`);
  console.log(`Pages to fetch: ${totalPages}\n`);

  const allProducts = [];
  let rejected = { noName: 0, noMacros: 0 };

  // Process first page
  for (const raw of firstPage.products) {
    const product = extractProduct(raw);
    if (isValid(product)) {
      allProducts.push(product);
    } else {
      if (!product.name) rejected.noName++;
      else rejected.noMacros++;
    }
  }

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    await sleep(DELAY_MS);
    process.stdout.write(`\r  Fetching page ${page}/${totalPages} (products so far: ${allProducts.length})`);

    let retries = 3;
    let pageData = null;
    while (retries > 0) {
      try {
        pageData = await fetchJson(`${SEARCH_URL}&page=${page}`);
        break;
      } catch (err) {
        retries--;
        if (retries === 0) {
          console.warn(`\n  [WARN] Failed to fetch page ${page} after 3 retries: ${err.message}`);
        } else {
          await sleep(2000);
        }
      }
    }

    if (!pageData || !pageData.products || pageData.products.length === 0) {
      // OFF API sometimes returns empty after ~10k results
      if (page > 100) {
        console.log(`\n  [INFO] Empty response at page ${page}, stopping.`);
        break;
      }
      continue;
    }

    for (const raw of pageData.products) {
      const product = extractProduct(raw);
      if (isValid(product)) {
        allProducts.push(product);
      } else {
        if (!product.name) rejected.noName++;
        else rejected.noMacros++;
      }
    }
  }
  process.stdout.write('\n\n');

  // Deduplicate by barcode
  console.log('Deduplicating by barcode...');
  const seen = new Set();
  const unique = [];
  let dupes = 0;
  for (const p of allProducts) {
    if (p.barcode && seen.has(p.barcode)) {
      dupes++;
      continue;
    }
    if (p.barcode) seen.add(p.barcode);
    unique.push(p);
  }
  console.log(`  Duplicates removed: ${dupes}`);
  console.log(`  Unique products: ${unique.length}\n`);

  // Save
  const outputDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'off-poland-raw.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    source: 'Open Food Facts',
    license: 'ODbL (Open Database License)',
    attribution: 'Data from Open Food Facts (https://openfoodfacts.org) — ODbL',
    totalInApi: totalCount,
    totalAfterFilter: unique.length,
    products: unique,
  }, null, 2), 'utf-8');
  console.log(`Saved to: ${outputPath}\n`);

  // Report
  console.log('=== REPORT ===\n');
  console.log(`  Total in OFF API (Poland): ${totalCount}`);
  console.log(`  After filtering: ${unique.length}`);
  console.log(`  Rejected - no name: ${rejected.noName}`);
  console.log(`  Rejected - no macros: ${rejected.noMacros}`);
  console.log(`  Duplicates (barcode): ${dupes}`);

  // Completeness stats
  const withFullMacros = unique.filter((p) => {
    const m = p.macros;
    return m.kcalPer100g !== null && m.proteinPer100g !== null &&
           m.fatPer100g !== null && m.carbsPer100g !== null;
  }).length;
  const withAllergens = unique.filter((p) => p.allergensTags.length > 0).length;
  const withServing = unique.filter((p) => p.servingWeightG !== null).length;
  const withPackage = unique.filter((p) => p.packageWeightG !== null).length;
  const withBrands = unique.filter((p) => p.brands !== null).length;

  console.log(`\n  Completeness:`);
  console.log(`    Full macros (kcal+B+T+W): ${withFullMacros} (${Math.round(withFullMacros / unique.length * 100)}%)`);
  console.log(`    With allergens: ${withAllergens} (${Math.round(withAllergens / unique.length * 100)}%)`);
  console.log(`    With serving size: ${withServing} (${Math.round(withServing / unique.length * 100)}%)`);
  console.log(`    With package weight: ${withPackage} (${Math.round(withPackage / unique.length * 100)}%)`);
  console.log(`    With brands: ${withBrands} (${Math.round(withBrands / unique.length * 100)}%)`);

  // Top categories
  const catCounts = {};
  for (const p of unique) {
    for (const tag of p.categoriesTags.slice(0, 3)) { // top 3 categories per product
      catCounts[tag] = (catCounts[tag] || 0) + 1;
    }
  }
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log(`\n  Top 15 categories:`);
  for (const [cat, count] of topCats) {
    console.log(`    ${cat}: ${count}`);
  }

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
