/**
 * Scraper for ilewazy.pl — Polish food product database
 * Extracts: product name, macros per 100g, household portions, categories
 * Output: data/ilewazy-raw.json
 *
 * Usage: node scripts/scrape-ilewazy.js
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://ilewazy.pl';
const CONCURRENCY = 5; // parallel requests
const DELAY_MS = 300; // delay between batches

const CATEGORIES = [
  'bakalie-i-nasiona',
  'mieso-i-wedliny',
  'nabial-i-jaja',
  'napoje',
  'owoce',
  'produkty-gotowe',
  'produkty-zbozowe',
  'ryby',
  'slodycze-i-przekaski',
  'tluszcze',
  'warzywa',
  'wykonane-przez-izabele',
];

// Navigation/non-product slugs to exclude
const EXCLUDE_SLUGS = new Set([
  'produkty', 'dziennik', 'przelicznik', 'porownaj', 'porady',
  'slownik', 'lista-przebojow', 'co-jak-i-dlaczego-wazymy',
  'zasady-komentowania-na-ilewazypl', 'kontakt', 'kalkulator',
  'o-stronie',
]);

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: 15000 }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${BASE_URL}${res.headers.location}`;
        fetchPage(redirectUrl).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    request.on('error', (err) => reject(err));
    request.on('timeout', () => { request.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract product slugs from a category page HTML
 */
function extractProductSlugs(html) {
  const slugs = new Set();
  // Match href="/some-slug" pattern — product URLs are single-segment slugs
  const regex = /href="\/([a-z0-9][a-z0-9-]*[a-z0-9])"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const slug = match[1];
    if (!EXCLUDE_SLUGS.has(slug) && !slug.startsWith('kategoria') && !slug.includes('/')) {
      slugs.add(slug);
    }
  }
  return [...slugs];
}

/**
 * Get max page from pagination
 */
function getMaxPage(html) {
  const regex = /data-page="(\d+)"/g;
  let maxPage = 1;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const page = parseInt(match[1], 10);
    if (page > maxPage) maxPage = page;
  }
  return maxPage;
}

/**
 * Extract product data from product page HTML
 */
function extractProductData(html, slug) {
  // Extract DATA.json_data.product JSON
  const productMatch = html.match(/DATA\.json_data\.product\s*=\s*(\{.*?\});/);
  if (!productMatch) return null;

  let productJson;
  try {
    productJson = JSON.parse(productMatch[1]);
  } catch {
    console.warn(`  [WARN] Failed to parse JSON for /${slug}`);
    return null;
  }

  // Extract product name from <title> or <h1>
  let name = '';
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    // Title format: "Product Name - ile waży?" or similar
    name = titleMatch[1].replace(/\s*[-–|].*$/, '').trim();
  }
  if (!name) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (h1Match) name = h1Match[1].trim();
  }

  // Extract category from breadcrumb or DATA
  let category = '';
  const categoryMatch = html.match(/href="\/kategoria\/([a-z0-9-]+)"/);
  if (categoryMatch) category = categoryMatch[1];

  // Parse macros per 100g
  const macros = {
    kcalPer100g: parseFloat(productJson.en) || 0,
    proteinPer100g: parseFloat(productJson.bi) || 0,
    fatPer100g: parseFloat(productJson.tl) || 0,
    carbsPer100g: parseFloat(productJson.we) || 0,
    fiberPer100g: parseFloat(productJson.bl) || 0,
    saltPer100g: parseFloat(productJson.sa) || 0,
    sugarsPer100g: productJson.si !== null ? parseFloat(productJson.si) || 0 : null,
    saturatedFatPer100g: parseFloat(productJson.fa) || 0,
  };

  // Parse household portions (units)
  const portions = [];
  if (productJson.un && typeof productJson.un === 'object') {
    for (const [key, unit] of Object.entries(productJson.un)) {
      portions.push({
        portionKey: key,
        portionName: unit.unit_name,
        weightG: parseFloat(unit.unit_weight) || 0,
        postName: unit.post_name || null,
      });
    }
  }

  return {
    sourceId: productJson.id,
    slug,
    name,
    category,
    macros,
    portions,
  };
}

/**
 * Gather all product slugs from a category (all pages)
 */
async function gatherCategorySlugs(categorySlug) {
  const url = `${BASE_URL}/kategoria/${categorySlug}`;
  const html = await fetchPage(url);
  if (!html) return [];

  const maxPage = getMaxPage(html);
  const allSlugs = new Set(extractProductSlugs(html));

  // Fetch remaining pages
  for (let page = 2; page <= maxPage; page++) {
    await sleep(DELAY_MS);
    const pageUrl = `${BASE_URL}/kategoria/${categorySlug}/page/${page}`;
    const pageHtml = await fetchPage(pageUrl);
    if (!pageHtml) break;
    const slugs = extractProductSlugs(pageHtml);
    if (slugs.length === 0) break;
    slugs.forEach((s) => allSlugs.add(s));
  }

  return [...allSlugs];
}

/**
 * Process product slugs in parallel batches
 */
async function processProductBatch(slugs) {
  const results = [];
  for (let i = 0; i < slugs.length; i += CONCURRENCY) {
    const batch = slugs.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (slug) => {
      try {
        const html = await fetchPage(`${BASE_URL}/${slug}`);
        if (!html) return null;
        return extractProductData(html, slug);
      } catch (err) {
        console.warn(`  [WARN] Error fetching /${slug}: ${err.message}`);
        return null;
      }
    });
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(Boolean));
    if (i + CONCURRENCY < slugs.length) await sleep(DELAY_MS);
    // Progress
    const done = Math.min(i + CONCURRENCY, slugs.length);
    process.stdout.write(`\r  Products fetched: ${done}/${slugs.length}`);
  }
  process.stdout.write('\n');
  return results;
}

/**
 * Deduplicate products by sourceId
 * Some products appear in multiple categories or as different portions of the same product
 */
function deduplicateProducts(products) {
  const byId = new Map();
  const bySlug = new Map();
  const duplicates = { byId: 0, bySlug: 0 };

  for (const product of products) {
    // Prefer dedup by sourceId
    if (product.sourceId) {
      if (byId.has(product.sourceId)) {
        const existing = byId.get(product.sourceId);
        // Merge portions from duplicate entries
        const existingPortionKeys = new Set(existing.portions.map((p) => p.portionKey));
        for (const portion of product.portions) {
          if (!existingPortionKeys.has(portion.portionKey)) {
            existing.portions.push(portion);
          }
        }
        // Keep the category from the first occurrence, add secondary if different
        if (product.category && product.category !== existing.category) {
          if (!existing.categories) existing.categories = [existing.category];
          if (!existing.categories.includes(product.category)) {
            existing.categories.push(product.category);
          }
        }
        duplicates.byId++;
        continue;
      }
      byId.set(product.sourceId, product);
    }

    // Also track by slug as backup
    if (bySlug.has(product.slug)) {
      duplicates.bySlug++;
      continue;
    }
    bySlug.set(product.slug, product);
  }

  return {
    products: [...byId.values()],
    duplicates,
  };
}

async function main() {
  console.log('=== ilewazy.pl Scraper ===\n');

  // Step 1: Gather all product slugs from all categories
  console.log('Step 1: Gathering product URLs from categories...\n');
  const categoryProducts = {};
  const allSlugs = new Set();

  for (const cat of CATEGORIES) {
    process.stdout.write(`  [${cat}] `);
    const slugs = await gatherCategorySlugs(cat);
    categoryProducts[cat] = slugs;
    slugs.forEach((s) => allSlugs.add(s));
    console.log(`${slugs.length} products`);
  }

  const uniqueSlugs = [...allSlugs];
  console.log(`\n  Total unique product URLs: ${uniqueSlugs.length}\n`);

  // Step 2: Fetch each product page and extract data
  console.log('Step 2: Fetching product pages...\n');
  const rawProducts = await processProductBatch(uniqueSlugs);
  console.log(`\n  Successfully extracted: ${rawProducts.length} products\n`);

  // Assign categories from category scan (some products may have been in multiple)
  const slugToCategories = {};
  for (const [cat, slugs] of Object.entries(categoryProducts)) {
    for (const slug of slugs) {
      if (!slugToCategories[slug]) slugToCategories[slug] = [];
      if (!slugToCategories[slug].includes(cat)) slugToCategories[slug].push(cat);
    }
  }
  for (const product of rawProducts) {
    if (slugToCategories[product.slug]) {
      product.categories = slugToCategories[product.slug];
      if (!product.category) product.category = product.categories[0];
    }
  }

  // Step 3: Deduplicate
  console.log('Step 3: Deduplicating...\n');
  const { products, duplicates } = deduplicateProducts(rawProducts);
  console.log(`  Duplicates removed: ${duplicates.byId} (by ID) + ${duplicates.bySlug} (by slug)`);
  console.log(`  Unique products after dedup: ${products.length}\n`);

  // Step 4: Save to file
  const outputDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'ilewazy-raw.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    scrapedAt: new Date().toISOString(),
    source: 'ilewazy.pl',
    totalProducts: products.length,
    categories: CATEGORIES,
    products,
  }, null, 2), 'utf-8');
  console.log(`  Saved to: ${outputPath}\n`);

  // Step 5: Report
  console.log('=== REPORT ===\n');
  console.log(`  Unique products: ${products.length}`);

  // Count by category
  const catCounts = {};
  for (const p of products) {
    const cat = p.category || 'unknown';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
  console.log('\n  Products per category:');
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }

  // Portions stats
  const withPortions = products.filter((p) => p.portions.length > 0).length;
  const totalPortions = products.reduce((sum, p) => sum + p.portions.length, 0);
  console.log(`\n  Products with portions: ${withPortions} (${Math.round(withPortions / products.length * 100)}%)`);
  console.log(`  Total portion entries: ${totalPortions}`);

  // Missing data
  const missingKcal = products.filter((p) => !p.macros.kcalPer100g).length;
  const missingProtein = products.filter((p) => !p.macros.proteinPer100g).length;
  const missingName = products.filter((p) => !p.name).length;
  console.log(`\n  Missing data:`);
  console.log(`    No kcal: ${missingKcal}`);
  console.log(`    No protein: ${missingProtein}`);
  console.log(`    No name: ${missingName}`);

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
