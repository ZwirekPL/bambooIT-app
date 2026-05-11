/**
 * Match ilewazy.pl products ↔ USDA SR Legacy + Foundation
 * Phase 1: Algorithmic matching (fuzzy + translations)
 * Phase 2: AI matching with Sonnet (requires ANTHROPIC_API_KEY)
 *
 * Output: data/matched-base-products.json
 *
 * Usage:
 *   node scripts/match-ilewazy-usda.js              # algorithmic only
 *   ANTHROPIC_API_KEY=sk-... node scripts/match-ilewazy-usda.js --ai   # with AI
 */

const path = require('path');
const fs = require('fs');
const https = require('https');

// ─── Config ────────────────────────────────────────────────────────────
const AI_MODE = process.argv.includes('--ai');
const AI_BATCH_SIZE = 30;
const AI_DELAY_MS = 1000;

// ─── Category mapping: USDA → 12 Polish ilewazy categories ────────────
const USDA_TO_PL_CATEGORY = {
  'Baked Products': 'produkty-zbozowe',
  'Beef Products': 'mieso-i-wedliny',
  'Beverages': 'napoje',
  'Breakfast Cereals': 'produkty-zbozowe',
  'Cereal Grains and Pasta': 'produkty-zbozowe',
  'Dairy and Egg Products': 'nabial-i-jaja',
  'Fats and Oils': 'tluszcze',
  'Finfish and Shellfish Products': 'ryby',
  'Fruits and Fruit Juices': 'owoce',
  'Lamb, Veal, and Game Products': 'mieso-i-wedliny',
  'Legumes and Legume Products': 'warzywa',
  'Meals, Entrees, and Side Dishes': 'produkty-gotowe',
  'Nut and Seed Products': 'bakalie-i-nasiona',
  'Pork Products': 'mieso-i-wedliny',
  'Poultry Products': 'mieso-i-wedliny',
  'Sausages and Luncheon Meats': 'mieso-i-wedliny',
  'Snacks': 'slodycze-i-przekaski',
  'Soups, Sauces, and Gravies': 'produkty-gotowe',
  'Spices and Herbs': 'produkty-gotowe',
  'Sweets': 'slodycze-i-przekaski',
  'Vegetables and Vegetable Products': 'warzywa',
  'Baby Foods': 'produkty-gotowe',
  'Fast Foods': 'produkty-gotowe',
  'Restaurant Foods': 'produkty-gotowe',
  'American Indian/Alaska Native Foods': 'produkty-gotowe',
};

// ─── Nutrient IDs in USDA ──────────────────────────────────────────────
const NUTRIENT_MAP = {
  1008: 'kcalPer100g',       // Energy (kcal)
  1003: 'proteinPer100g',    // Protein
  1004: 'fatPer100g',        // Total fat
  1005: 'carbsPer100g',      // Carbohydrates
  1079: 'fiberPer100g',      // Fiber
  2000: 'sugarsPer100g',     // Sugars
  1093: 'sodiumMg',          // Sodium
  1258: 'saturatedFatPer100g', // Saturated fat
  // Micronutrients
  1092: 'potassiumMg',
  1087: 'calciumMg',
  1090: 'magnesiumMg',
  1089: 'ironMg',
  1095: 'zincMg',
  1106: 'vitaminAUg',        // Vitamin A (RAE)
  1162: 'vitaminCMg',
  1114: 'vitaminDUg',        // Vitamin D (D2+D3)
  1109: 'vitaminEMg',
  1178: 'vitaminB12Ug',
  1177: 'folateMg',          // Actually µg but stored as-is
  1253: 'cholesterolMg',
};

// ─── Helpers ───────────────────────────────────────────────────────────

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/[""„]/g, '"')
    .replace(/[(),\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(str) {
  return normalize(str)
    .replace(/[ąà]/g, 'a').replace(/[ćč]/g, 'c').replace(/[ęè]/g, 'e')
    .replace(/[łl]/g, 'l').replace(/[ńñ]/g, 'n').replace(/[óò]/g, 'o')
    .replace(/[śš]/g, 's').replace(/[źżž]/g, 'z').replace(/[ůú]/g, 'u')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract core food name from ilewazy product name
 * Removes quantity prefixes like "10 rodzynek", "3 sztuki..."
 */
function extractCoreName(name) {
  return name
    .replace(/^\d+\s*(sztuk[i]?|plastr[óy]w?|kul[ek]*|kromek|krąż[kó]w?|szt\.?)\s*/i, '')
    .replace(/^\d+\s+/i, '') // remaining leading numbers
    .replace(/^(ile waży|porcja|szklanka|łyżka|garść)\s*/i, '')
    .trim();
}

/**
 * Simple Levenshtein-based similarity (0-1)
 */
function similarity(a, b) {
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const maxLen = Math.max(la, lb);

  // Use set-based word overlap for longer strings
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  const wordSim = (2 * overlap) / (wordsA.size + wordsB.size);

  // Also use character trigram overlap
  const triA = new Set(), triB = new Set();
  for (let i = 0; i <= la - 3; i++) triA.add(a.substring(i, i + 3));
  for (let i = 0; i <= lb - 3; i++) triB.add(b.substring(i, i + 3));
  let triOverlap = 0;
  for (const t of triA) { if (triB.has(t)) triOverlap++; }
  const triSim = triA.size + triB.size > 0 ? (2 * triOverlap) / (triA.size + triB.size) : 0;

  return Math.max(wordSim, triSim);
}

/**
 * Extract USDA nutrients into our format
 */
function extractNutrients(foodNutrients) {
  const result = {};
  for (const fn of foodNutrients) {
    const nid = fn.nutrient?.id;
    const key = NUTRIENT_MAP[nid];
    if (key && fn.amount !== undefined) {
      result[key] = fn.amount;
    }
  }
  // Convert sodium to salt (salt = sodium * 2.5 / 1000 for g)
  if (result.sodiumMg !== undefined) {
    result.saltPer100g = Math.round(result.sodiumMg * 2.5 / 1000 * 1000) / 1000;
  }
  return result;
}

/**
 * Extract USDA food portions
 */
function extractPortions(foodPortions) {
  if (!foodPortions) return [];
  return foodPortions
    .filter(p => p.gramWeight > 0 && p.portionDescription)
    .map(p => ({
      portionName: p.portionDescription || p.modifier || 'portion',
      weightG: p.gramWeight,
      amount: p.amount || 1,
      source: 'USDA',
    }));
}

// ─── Load data ─────────────────────────────────────────────────────────

function loadData() {
  console.log('Loading data...\n');

  const ilewazy = require(path.join(__dirname, '..', 'data', 'ilewazy-raw.json'));
  const srLegacy = require(path.join(__dirname, '..', 'data', 'usda', 'FoodData_Central_sr_legacy_food_json_2018-04.json'));
  const foundation = require(path.join(__dirname, '..', 'data', 'usda', 'FoodData_Central_foundation_food_json_2025-12-18.json'));

  // Load existing translations if available
  let translations = [];
  try {
    translations = require(path.join(__dirname, '..', 'food-names-translated.json'));
  } catch { /* no translations */ }

  // Build translation lookup: namePl → nameEn
  const plToEn = new Map();
  const enToPl = new Map();
  for (const t of translations) {
    if (t.namePl && t.nameEn) {
      plToEn.set(normalize(t.namePl), t.nameEn);
      enToPl.set(normalize(t.nameEn), t.namePl);
    }
  }

  // Combine USDA sources, preferring Foundation data
  const usdaAll = [];
  const seenFdc = new Set();

  for (const f of foundation.FoundationFoods || []) {
    usdaAll.push(f);
    seenFdc.add(f.fdcId);
  }
  for (const f of srLegacy.SRLegacyFoods || []) {
    if (!seenFdc.has(f.fdcId)) {
      usdaAll.push(f);
    }
  }

  console.log(`  ilewazy: ${ilewazy.products.length} products`);
  console.log(`  USDA (combined): ${usdaAll.length} products`);
  console.log(`  Translations: ${translations.length} entries`);

  return { ilewazy: ilewazy.products, usdaAll, plToEn, enToPl };
}

// ─── Build USDA index ──────────────────────────────────────────────────

function buildUsdaIndex(usdaAll, enToPl) {
  return usdaAll.map(f => {
    const descNorm = normalize(f.description);
    const plName = enToPl.get(descNorm) || null;
    return {
      fdcId: f.fdcId,
      description: f.description,
      descNorm,
      plName,
      plNorm: plName ? normalize(plName) : null,
      slug: slugify(f.description),
      category: f.foodCategory?.description || '',
      plCategory: USDA_TO_PL_CATEGORY[f.foodCategory?.description] || 'produkty-gotowe',
      nutrients: extractNutrients(f.foodNutrients || []),
      portions: extractPortions(f.foodPortions),
      dataType: f.dataType,
    };
  });
}

// ─── Algorithmic matching ──────────────────────────────────────────────

function algorithmicMatch(ilewazyProducts, usdaIndex) {
  console.log('\nPhase 1: Algorithmic matching...\n');

  const matched = [];
  const unmatched = [];

  for (const ilp of ilewazyProducts) {
    const coreName = extractCoreName(ilp.name);
    const coreNorm = normalize(coreName);
    const coreSlug = slugify(coreName);

    let bestMatch = null;
    let bestScore = 0;

    for (const usda of usdaIndex) {
      let score = 0;

      // Strategy 1: Compare ilewazy name with USDA Polish translation
      if (usda.plNorm) {
        const s = similarity(coreNorm, usda.plNorm);
        score = Math.max(score, s);
      }

      // Strategy 2: Compare slugs
      const slugSim = similarity(coreSlug, usda.slug);
      score = Math.max(score, slugSim * 0.9); // slight penalty for slug-only match

      // Strategy 3: Category bonus
      if (ilp.category && usda.plCategory === ilp.category) {
        score *= 1.05; // 5% bonus for same category
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { usda, score };
      }
    }

    if (bestMatch && bestScore >= 0.45) {
      matched.push({
        ilewazy: ilp,
        usda: bestMatch.usda,
        matchScore: Math.round(bestScore * 100) / 100,
        matchMethod: 'algorithmic',
      });
    } else {
      unmatched.push(ilp);
    }
  }

  console.log(`  Matched: ${matched.length} (threshold ≥ 0.45)`);
  console.log(`  Unmatched: ${unmatched.length}`);

  return { matched, unmatched };
}

// ─── AI matching (Sonnet) ──────────────────────────────────────────────

function callSonnet(messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages,
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.content?.[0]?.text || '');
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function aiMatch(unmatchedIlewazy, usdaIndex) {
  if (!AI_MODE) return { aiMatched: [], stillUnmatched: unmatchedIlewazy };

  console.log('\nPhase 2: AI matching with Sonnet...\n');

  // Prepare compact USDA reference (name + category only, to fit context)
  const usdaRef = usdaIndex.map((u, i) => `${i}|${u.description}|${u.category}`).join('\n');

  const aiMatched = [];
  const stillUnmatched = [];

  for (let i = 0; i < unmatchedIlewazy.length; i += AI_BATCH_SIZE) {
    const batch = unmatchedIlewazy.slice(i, i + AI_BATCH_SIZE);
    const batchNames = batch.map((p, j) => `${j}|${p.name}|${p.category}`).join('\n');

    process.stdout.write(`\r  AI batch ${Math.floor(i / AI_BATCH_SIZE) + 1}/${Math.ceil(unmatchedIlewazy.length / AI_BATCH_SIZE)}`);

    try {
      const response = await callSonnet([{
        role: 'user',
        content: `Match Polish food products to USDA database entries. For each Polish product, find the best matching USDA product by food type (ignoring brand names).

Polish products (index|name|category):
${batchNames}

USDA products (index|name|category):
${usdaRef}

Return ONLY a JSON array of matches:
[{"pl_idx": 0, "usda_idx": 123, "confidence": 0.8}, ...]

Rules:
- confidence 0.0-1.0 (0.7+ = good match, 0.5-0.7 = partial)
- Skip products with no reasonable match (branded/processed Polish products without USDA equivalent)
- Match by food TYPE not brand (e.g. "Actimel" → "Yogurt, fruit" if similar)
- If multiple USDA products match, pick the most generic one`
      }]);

      // Parse AI response
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const matches = JSON.parse(jsonMatch[0]);
        for (const m of matches) {
          if (m.confidence >= 0.5 && m.usda_idx < usdaIndex.length && m.pl_idx < batch.length) {
            aiMatched.push({
              ilewazy: batch[m.pl_idx],
              usda: usdaIndex[m.usda_idx],
              matchScore: m.confidence,
              matchMethod: 'ai-sonnet',
            });
          } else if (m.pl_idx < batch.length) {
            stillUnmatched.push(batch[m.pl_idx]);
          }
        }
        // Products not in AI response → unmatched
        const matchedIdxs = new Set(matches.map(m => m.pl_idx));
        for (let j = 0; j < batch.length; j++) {
          if (!matchedIdxs.has(j)) stillUnmatched.push(batch[j]);
        }
      } else {
        stillUnmatched.push(...batch);
      }
    } catch (err) {
      console.warn(`\n  [WARN] AI batch failed: ${err.message}`);
      stillUnmatched.push(...batch);
    }

    await sleep(AI_DELAY_MS);
  }
  process.stdout.write('\n');

  console.log(`  AI matched: ${aiMatched.length}`);
  console.log(`  Still unmatched: ${stillUnmatched.length}`);

  return { aiMatched, stillUnmatched };
}

// ─── Merge and deduplicate ─────────────────────────────────────────────

function mergeResults(algoMatched, aiMatched, unmatchedIlewazy, usdaIndex, allMatched) {
  console.log('\nMerging results...\n');

  const products = [];
  const usedUsdaIds = new Set();
  let macroConflicts = 0;

  // Helper: compare macros, flag if >15% difference
  function compareMacros(ilMacros, usdaNutrients) {
    const fields = ['kcalPer100g', 'proteinPer100g', 'fatPer100g', 'carbsPer100g'];
    const conflicts = [];
    for (const field of fields) {
      const ilVal = ilMacros[field];
      const usdaVal = usdaNutrients[field];
      if (ilVal && usdaVal && ilVal > 0 && usdaVal > 0) {
        const diff = Math.abs(ilVal - usdaVal) / Math.max(ilVal, usdaVal);
        if (diff > 0.15) {
          conflicts.push({ field, ilewazy: ilVal, usda: usdaVal, diffPct: Math.round(diff * 100) });
        }
      }
    }
    return conflicts;
  }

  // Process all matched pairs
  const allPairs = [...algoMatched, ...aiMatched];
  for (const { ilewazy: il, usda, matchScore, matchMethod } of allPairs) {
    usedUsdaIds.add(usda.fdcId);

    const conflicts = compareMacros(il.macros, usda.nutrients);
    if (conflicts.length > 0) macroConflicts++;

    // Merge: macros from ilewazy (source of truth), micros from USDA
    const mergedNutrients = { ...il.macros };
    // Add USDA micros
    const microFields = ['potassiumMg', 'calciumMg', 'magnesiumMg', 'ironMg', 'zincMg',
      'vitaminAUg', 'vitaminCMg', 'vitaminDUg', 'vitaminEMg', 'vitaminB12Ug', 'folateMg', 'cholesterolMg', 'sodiumMg'];
    for (const mf of microFields) {
      if (usda.nutrients[mf] !== undefined) {
        mergedNutrients[mf] = usda.nutrients[mf];
      }
    }

    // Merge portions: ilewazy first (Polish names), then USDA
    const portions = [...il.portions];
    const existingKeys = new Set(portions.map(p => p.portionName.toLowerCase()));
    for (const up of usda.portions) {
      if (!existingKeys.has(up.portionName.toLowerCase())) {
        portions.push({ ...up, source: 'USDA' });
      }
    }

    products.push({
      name: il.name,
      nameEn: usda.description,
      slug: il.slug,
      category: il.category,
      categories: il.categories || [il.category],
      type: 'BASE',
      sourcePrimary: 'ILEWAZY',
      sourceSecondary: 'USDA',
      sourceId: il.sourceId,
      usdaFdcId: usda.fdcId,
      matchScore,
      matchMethod,
      macroConflicts: conflicts.length > 0 ? conflicts : undefined,
      hasMicronutrients: true,
      qualityScore: 90,
      nutrients: mergedNutrients,
      portions,
    });
  }

  // Unmatched ilewazy → new Polish products (only macros, no micros)
  for (const il of unmatchedIlewazy) {
    products.push({
      name: il.name,
      nameEn: null,
      slug: il.slug,
      category: il.category,
      categories: il.categories || [il.category],
      type: 'BASE',
      sourcePrimary: 'ILEWAZY',
      sourceSecondary: null,
      sourceId: il.sourceId,
      usdaFdcId: null,
      matchScore: null,
      matchMethod: 'unmatched',
      hasMicronutrients: false,
      qualityScore: 70,
      nutrients: { ...il.macros },
      portions: il.portions,
    });
  }

  // Unmatched USDA → keep with translated name
  let usdaOnly = 0;
  for (const usda of usdaIndex) {
    if (usedUsdaIds.has(usda.fdcId)) continue;

    // Skip branded/processed USDA items that aren't useful
    const desc = usda.description.toLowerCase();
    if (desc.includes('mcdonald') || desc.includes('burger king') || desc.includes('wendy') ||
        desc.includes('pizza hut') || desc.includes('taco bell') || desc.includes('kfc') ||
        desc.includes('subway') || desc.includes('domino') || desc.includes('alaska native') ||
        desc.includes('school lunch') || desc.includes('infant formula')) {
      continue;
    }

    const nutrients = usda.nutrients;
    // Skip if no basic macros
    if (!nutrients.kcalPer100g && !nutrients.proteinPer100g) continue;

    products.push({
      name: usda.plName || usda.description,
      nameEn: usda.description,
      slug: slugify(usda.plName || usda.description),
      category: usda.plCategory,
      categories: [usda.plCategory],
      type: 'BASE',
      sourcePrimary: 'USDA',
      sourceSecondary: null,
      sourceId: null,
      usdaFdcId: usda.fdcId,
      matchScore: null,
      matchMethod: 'usda-only',
      hasMicronutrients: Object.keys(nutrients).some(k =>
        ['potassiumMg', 'calciumMg', 'magnesiumMg', 'ironMg', 'vitaminCMg'].includes(k)),
      qualityScore: 50,
      nutrients,
      portions: usda.portions,
    });
    usdaOnly++;
  }

  console.log(`  Merged matched: ${allPairs.length}`);
  console.log(`  ilewazy-only (Polish): ${unmatchedIlewazy.length}`);
  console.log(`  USDA-only: ${usdaOnly}`);
  console.log(`  Macro conflicts (>15%): ${macroConflicts}`);
  console.log(`  Total products: ${products.length}`);

  return { products, macroConflicts };
}

// ─── Egg normalization ─────────────────────────────────────────────────

function normalizeEggs(products) {
  // Find all egg entries and merge into canonical "Jajko kurze"
  const eggPattern = /\b(egg|jaj[ko]|jajek|jajec)\b/i;
  const chickenEggPattern = /\b(chicken|hen|kurz|kur[ie])\b/i;
  const eggs = products.filter(p =>
    eggPattern.test(p.name) || eggPattern.test(p.nameEn || ''));

  // Don't merge specialty eggs (quail, duck, etc.)
  const specialtyPattern = /\b(quail|duck|goose|przepiór|kacz|gęs|struś)\b/i;
  const chickenEggs = eggs.filter(p =>
    !specialtyPattern.test(p.name) && !specialtyPattern.test(p.nameEn || ''));

  if (chickenEggs.length <= 1) return;

  console.log(`  Egg normalization: found ${chickenEggs.length} chicken egg entries`);
  // We keep them as-is but ensure standard portions exist
  // Standard Polish egg sizes: S(47g), M(53g), L(63g), XL(73g)
  const eggPortions = [
    { portionName: 'Jajko S', weightG: 47, source: 'STANDARD' },
    { portionName: 'Jajko M', weightG: 53, source: 'STANDARD' },
    { portionName: 'Jajko L', weightG: 63, source: 'STANDARD' },
    { portionName: 'Jajko XL', weightG: 73, source: 'STANDARD' },
  ];

  for (const egg of chickenEggs) {
    const existing = new Set(egg.portions.map(p => p.portionName.toLowerCase()));
    for (const ep of eggPortions) {
      if (!existing.has(ep.portionName.toLowerCase())) {
        egg.portions.push(ep);
      }
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log('=== ilewazy ↔ USDA Matcher ===\n');
  console.log(`Mode: ${AI_MODE ? 'Algorithmic + AI (Sonnet)' : 'Algorithmic only'}\n`);

  const { ilewazy, usdaAll, plToEn, enToPl } = loadData();

  // Build USDA index
  console.log('\nBuilding USDA index...');
  const usdaIndex = buildUsdaIndex(usdaAll, enToPl);
  console.log(`  USDA indexed: ${usdaIndex.length} products\n`);

  // Phase 1: Algorithmic matching
  const { matched: algoMatched, unmatched } = algorithmicMatch(ilewazy, usdaIndex);

  // Phase 2: AI matching (if enabled)
  const { aiMatched, stillUnmatched } = await aiMatch(unmatched, usdaIndex);

  // Merge all results
  const { products, macroConflicts } = mergeResults(
    algoMatched, aiMatched, stillUnmatched, usdaIndex, [...algoMatched, ...aiMatched]
  );

  // Normalize eggs
  normalizeEggs(products);

  // Save
  const outputPath = path.join(__dirname, '..', 'data', 'matched-base-products.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    createdAt: new Date().toISOString(),
    mode: AI_MODE ? 'algorithmic+ai' : 'algorithmic',
    stats: {
      totalProducts: products.length,
      matchedIlewazyUsda: algoMatched.length + aiMatched.length,
      ilewazyOnly: stillUnmatched.length,
      usdaOnly: products.filter(p => p.sourcePrimary === 'USDA').length,
      macroConflicts,
    },
    products,
  }, null, 2), 'utf-8');
  console.log(`\nSaved to: ${outputPath}\n`);

  // Report
  console.log('=== REPORT ===\n');
  console.log(`  Total base products: ${products.length}`);
  console.log(`  Matched (ilewazy+USDA): ${algoMatched.length + aiMatched.length}`);
  console.log(`    - Algorithmic: ${algoMatched.length}`);
  console.log(`    - AI: ${aiMatched.length}`);
  console.log(`  ilewazy-only: ${stillUnmatched.length}`);
  console.log(`  USDA-only: ${products.filter(p => p.sourcePrimary === 'USDA').length}`);
  console.log(`  Macro conflicts (>15%): ${macroConflicts}`);

  // Quality distribution
  const q90 = products.filter(p => p.qualityScore === 90).length;
  const q70 = products.filter(p => p.qualityScore === 70).length;
  const q50 = products.filter(p => p.qualityScore === 50).length;
  console.log(`\n  Quality distribution:`);
  console.log(`    90 (matched): ${q90}`);
  console.log(`    70 (ilewazy-only): ${q70}`);
  console.log(`    50 (USDA-only): ${q50}`);

  // Category distribution
  const catCounts = {};
  for (const p of products) {
    catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  }
  console.log(`\n  Products per category:`);
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }

  // With micros
  const withMicro = products.filter(p => p.hasMicronutrients).length;
  console.log(`\n  With micronutrients: ${withMicro} (${Math.round(withMicro / products.length * 100)}%)`);

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
