/**
 * Normalize unlinked ingredient names via GPT-4.1-mini, then match to CleanProduct.
 * Creates missing CleanProduct entries for unmatched ingredients.
 *
 * Usage:
 *   node scripts/gpt-normalize-ingredients.js [--dry-run] [--limit 100]
 */

const { PrismaClient } = require("@prisma/client");
const { OpenAI } = require("openai");
const crypto = require("crypto");
require("dotenv").config({ path: __dirname + "/../apps/backend/.env" });

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1], 10)
  : 0;

const BATCH_SIZE = 40;
const GPT_MODEL = "gpt-4.1-mini";

const stats = {
  totalNames: 0,
  gptCalls: 0,
  totalInput: 0,
  totalOutput: 0,
  matched: 0,
  created: 0,
  unmatched: 0,
  ingredientsLinked: 0,
};

const SYSTEM_PROMPT = `Jesteś asystentem kulinarnym. Dostajesz JSON array nazw składników z przepisów.
Dla każdego zwróć znormalizowaną nazwę produktu spożywczego (mianownik, liczba pojedyncza).

Zasady:
- Usuń ilości, miary, opisy przygotowania
- Forma mianownika: "czosnku" → "czosnek", "soli" → "sól"
- Składniki złożone rozdziel: "sól i pieprz" → ["sól", "pieprz"]
- Zachowaj warianty: "papryka wędzona" ≠ "papryka słodka"
- "2 ząbki czosnku" → ["czosnek"]
- "natka pietruszki" → ["natka pietruszki"]
- "proszek do pieczenia i soda po łyżeczce" → ["proszek do pieczenia", "soda oczyszczona"]
- "oliwa" → ["oliwa z oliwek"]

Odpowiedz WYŁĄCZNIE JSON: [["produkt1"], ["produkt1", "produkt2"], ...]
Array o tej samej długości co wejście. Indeksy muszą się zgadzać.`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0142/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

async function normalizeBatch(names) {
  const response = await openai.chat.completions.create({
    model: GPT_MODEL,
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(names) },
    ],
  });

  stats.gptCalls++;
  stats.totalInput += response.usage.prompt_tokens;
  stats.totalOutput += response.usage.completion_tokens;

  const content = response.choices[0].message.content.trim();
  try {
    return JSON.parse(content);
  } catch (e) {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    console.error("  GPT parse error:", content.substring(0, 200));
    return null;
  }
}

async function findProduct(normalizedName, productIndex) {
  const lower = normalizedName.toLowerCase().trim();
  if (lower.length < 2) return null;

  // 1. Exact match
  if (productIndex.has(lower)) {
    const p = productIndex.get(lower);
    return { id: p.id, name: p.name, sim: 1.0 };
  }

  // 2. Best contains match
  let bestMatch = null;
  let bestSim = 0;
  for (const [pLower, p] of productIndex) {
    if (pLower === lower) { bestMatch = p; bestSim = 1.0; break; }
    // Product name starts with our name, or vice versa
    if (pLower.startsWith(lower + " ") || pLower.startsWith(lower + ",")) {
      const sim = lower.length / pLower.length;
      if (sim > bestSim) { bestMatch = p; bestSim = sim; }
    }
    if (lower.startsWith(pLower + " ") || lower.startsWith(pLower + ",")) {
      const sim = pLower.length / lower.length;
      if (sim > bestSim) { bestMatch = p; bestSim = sim; }
    }
  }
  if (bestMatch && bestSim >= 0.6) {
    return { id: bestMatch.id, name: bestMatch.name, sim: bestSim };
  }

  // 3. Trigram similarity
  try {
    const result = await prisma.$queryRawUnsafe(
      `SELECT id, name, similarity(LOWER(name), LOWER($1)) AS sim
       FROM "CleanProduct"
       WHERE similarity(LOWER(name), LOWER($1)) > 0.5
       ORDER BY sim DESC LIMIT 1`,
      normalizedName
    );
    if (result.length > 0) {
      return { id: result[0].id, name: result[0].name, sim: parseFloat(result[0].sim) };
    }
  } catch (e) {}

  return null;
}

// Category guessing for new products
function guessCategory(name) {
  const n = name.toLowerCase();
  if (n.match(/mleko|śmietan|jogurt|kefir|serek|twaróg|mascarpone|ricotta|mozzarella|parmezan|cheddar|gouda|feta|camembert|brie|ser /)) return "nabial-i-jaja";
  if (n.match(/jaj[ko]|białk[oa]|żółtk[oa]/)) return "nabial-i-jaja";
  if (n.match(/masło|margaryn/)) return "nabial-i-jaja";
  if (n.match(/kurczak|indyk|wołowin|wieprzow|szynk|boczek|kiełbas|salami|parówk|mięs/)) return "mieso-i-wedliny";
  if (n.match(/łosoś|dorsz|tuńczyk|krewet|małż|kalmary|śledź|makrela|pstrąg|ryb/)) return "ryby-i-owoce-morza";
  if (n.match(/marchew|cebul|czosn|pomidor|ogórek|papryk|bakłażan|cukini|szpinak|sałat|kapust|brokuł|kalafior|seler|pietruszk|por|burak|rzodkiew|dyni|batata?|ziemniak|groszek|fasol|bób|soczewic|ciecierzyc|botwi/)) return "warzywa";
  if (n.match(/jabłk|gruszk|banan|pomarańcz|cytryn|limonk|truskawk|malin|borówk|jagod|winogren|brzoskwini|morela?|śliwk|wiśni|mango|ananas|awokado|kokos|fig/)) return "owoce";
  if (n.match(/mąk[ai]|ryż|makar|kasz|płatk|owsian|kukurydz|bulgur|kuskus|quinoa|amarantu/)) return "produkty-zbozowe";
  if (n.match(/chleb|bułk|bagiet|tortill|naleśnik|ciast|bajgiel/)) return "produkty-zbozowe";
  if (n.match(/oliw|olej|ocet|sos |ketchup|musztard|majonez|pesto/)) return "sosy-i-przyprawy";
  if (n.match(/sól|pieprz|oregano|bazylia|tymianek|rozmaryn|majeran|kurkum|cynamon|imbir|gałka|kminek|kmin|curry|chili|papryka|ziele angielskie|liść laurowy|wanili|szafran|kolendra|koperek|szczypiorek|natka|mięta|lubczyk/)) return "sosy-i-przyprawy";
  if (n.match(/cukier|miód|syrop|dżem|czekolad|kakao|proszek do pieczenia|soda|żelatyn|drożdż|ekstrakt/)) return "produkty-zbozowe";
  if (n.match(/orzech|migdał|orzeszy|pestki|ziarna|nasion|sezam|słonecznik|siemię/)) return "bakalie-i-nasiona";
  if (n.match(/wino|piwo|wódk|rum|koniak|likier|prosecco|aperol/)) return "napoje";
  if (n.match(/woda|sok|herbat|kawa|mleko kokos/)) return "napoje";
  return "inne";
}

async function main() {
  console.log("=== GPT Ingredient Normalization & Matching ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

  // Step 1: Load unlinked ingredients
  console.log("Loading unlinked ingredients...");
  const unlinked = await prisma.recipeIngredient.findMany({
    where: { cleanProductId: null, foodProductId: null, displayName: { not: null } },
    select: { id: true, displayName: true },
  });

  const nameGroups = new Map();
  for (const ing of unlinked) {
    const name = ing.displayName.trim();
    if (!name) continue;
    if (!nameGroups.has(name)) nameGroups.set(name, []);
    nameGroups.get(name).push(ing.id);
  }

  let uniqueNames = [...nameGroups.keys()];
  if (LIMIT > 0) uniqueNames = uniqueNames.slice(0, LIMIT);
  stats.totalNames = uniqueNames.length;

  console.log(`Unlinked ingredients: ${unlinked.length}`);
  console.log(`Unique names: ${stats.totalNames}`);

  // Step 2: Load product index
  console.log("Loading CleanProduct index...");
  const products = await prisma.cleanProduct.findMany({ select: { id: true, name: true } });
  const productIndex = new Map();
  for (const p of products) productIndex.set(p.name.toLowerCase().trim(), p);
  console.log(`CleanProducts: ${products.length}\n`);

  // Step 3: GPT normalization
  // normalized[i] = [prodName1, prodName2, ...]  aligned with uniqueNames[i]
  const allNormalized = new Array(uniqueNames.length).fill(null);

  const totalBatches = Math.ceil(uniqueNames.length / BATCH_SIZE);
  for (let i = 0; i < uniqueNames.length; i += BATCH_SIZE) {
    const batch = uniqueNames.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const pct = Math.round((i / uniqueNames.length) * 100);
    process.stdout.write(`GPT batch ${batchNum}/${totalBatches} (${pct}%)...`);

    try {
      const results = await normalizeBatch(batch);
      if (results && Array.isArray(results) && results.length === batch.length) {
        for (let j = 0; j < batch.length; j++) {
          const r = results[j];
          allNormalized[i + j] = Array.isArray(r) ? r.map(s => s.toLowerCase().trim()) : [String(r).toLowerCase().trim()];
        }
        console.log(` OK (${batch.length})`);
      } else {
        console.log(` MISMATCH (got ${results?.length || 0}, expected ${batch.length})`);
        // Try to salvage what we can
        if (results && Array.isArray(results)) {
          for (let j = 0; j < Math.min(results.length, batch.length); j++) {
            const r = results[j];
            allNormalized[i + j] = Array.isArray(r) ? r.map(s => s.toLowerCase().trim()) : [String(r).toLowerCase().trim()];
          }
        }
      }
    } catch (err) {
      console.log(` ERROR: ${err.message}`);
    }

    await sleep(300);
  }

  const normalizedCount = allNormalized.filter(Boolean).length;
  console.log(`\nNormalized: ${normalizedCount} / ${stats.totalNames}`);

  // Step 4: Match & create missing products
  console.log("\nMatching to CleanProduct...\n");

  const matchMap = new Map(); // original → { productId, productName, sim, normalized }
  const unmatchedProducts = new Map(); // normalizedName → { count, originals }
  const newProductsToCreate = new Map(); // normalizedName → category

  for (let i = 0; i < uniqueNames.length; i++) {
    const original = uniqueNames[i];
    const normalizedArr = allNormalized[i];
    if (!normalizedArr) continue;

    // For compound ingredients (sól i pieprz → [sól, pieprz])
    // We link to the FIRST match found
    let bestMatch = null;
    for (const norm of normalizedArr) {
      const match = await findProduct(norm, productIndex);
      if (match && (!bestMatch || match.sim > bestMatch.sim)) {
        bestMatch = { ...match, normalized: norm };
      }
    }

    if (bestMatch) {
      matchMap.set(original, bestMatch);
      stats.matched++;
    } else {
      // Track unmatched for product creation
      for (const norm of normalizedArr) {
        if (norm.length < 2) continue;
        if (!unmatchedProducts.has(norm)) unmatchedProducts.set(norm, { count: 0, originals: [] });
        const u = unmatchedProducts.get(norm);
        u.count += nameGroups.get(original)?.length || 0;
        u.originals.push(original);
      }
      stats.unmatched++;
    }
  }

  console.log(`Matched: ${stats.matched}`);
  console.log(`Unmatched: ${stats.unmatched}`);
  console.log(`Unique unmatched product names: ${unmatchedProducts.size}`);

  // Show top matches
  console.log("\n--- Top matches ---");
  [...matchMap.entries()]
    .sort((a, b) => (nameGroups.get(b[0])?.length || 0) - (nameGroups.get(a[0])?.length || 0))
    .slice(0, 20)
    .forEach(([orig, m]) => {
      const cnt = nameGroups.get(orig)?.length || 0;
      console.log(`  "${orig}" → [${m.normalized}] → "${m.name}" (sim=${m.sim.toFixed(2)}, ×${cnt})`);
    });

  // Show top unmatched
  console.log("\n--- Top unmatched (will create CleanProduct) ---");
  [...unmatchedProducts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30)
    .forEach(([name, info]) => {
      const cat = guessCategory(name);
      console.log(`  "${name}" → category: ${cat} (×${info.count} ingredients)`);
      newProductsToCreate.set(name, cat);
    });

  // Step 5: Create missing products & link
  if (!DRY_RUN) {
    console.log("\n--- Creating missing CleanProducts ---");
    // Create ALL unmatched, not just top 30
    for (const [name, info] of unmatchedProducts) {
      if (name.length < 2) continue;
      const cat = guessCategory(name);
      const slug = slugify(name);

      // Check if slug already exists
      const existing = await prisma.cleanProduct.findUnique({ where: { slug } });
      if (existing) {
        // Link to existing
        productIndex.set(name.toLowerCase(), existing);
        continue;
      }

      try {
        const product = await prisma.cleanProduct.create({
          data: {
            name: name.charAt(0).toUpperCase() + name.slice(1),
            slug,
            type: "MANUAL",
            category: cat,
            sourcePrimary: "MANUAL",
            qualityScore: 30,
          },
        });
        productIndex.set(name.toLowerCase(), product);
        stats.created++;
      } catch (e) {
        // Slug conflict or other error
        if (!e.message.includes("Unique")) {
          console.error(`  Error creating "${name}":`, e.message);
        }
      }
    }
    console.log(`Created: ${stats.created} new CleanProducts`);

    // Now re-match unmatched ingredients to newly created products
    console.log("\n--- Linking ingredients ---");
    let linked = 0;

    // Link matched
    for (const [original, match] of matchMap) {
      const ids = nameGroups.get(original) || [];
      if (ids.length === 0) continue;
      await prisma.recipeIngredient.updateMany({
        where: { id: { in: ids } },
        data: { cleanProductId: match.productId },
      });
      linked += ids.length;
    }

    // Link previously unmatched (now have products)
    for (let i = 0; i < uniqueNames.length; i++) {
      const original = uniqueNames[i];
      if (matchMap.has(original)) continue; // already linked
      const normalizedArr = allNormalized[i];
      if (!normalizedArr) continue;

      // Find in updated product index
      let found = null;
      for (const norm of normalizedArr) {
        const p = productIndex.get(norm.toLowerCase().trim());
        if (p) { found = p; break; }
      }

      if (found) {
        const ids = nameGroups.get(original) || [];
        if (ids.length > 0) {
          await prisma.recipeIngredient.updateMany({
            where: { id: { in: ids } },
            data: { cleanProductId: found.id },
          });
          linked += ids.length;
        }
      }
    }

    stats.ingredientsLinked = linked;
    console.log(`Linked: ${linked} ingredients`);
  }

  // Save report
  const report = [...unmatchedProducts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, info]) => `${name}\t${guessCategory(name)}\t${info.count}`)
    .join("\n");
  require("fs").writeFileSync(
    "c:/tmp/scraper/unmatched-ingredients-gpt.tsv",
    `normalized_name\tcategory\tingredient_count\n${report}`,
    "utf8"
  );

  const cost = (stats.totalInput * 0.4 + stats.totalOutput * 1.6) / 1_000_000;
  console.log("\n=== DONE ===");
  console.log(`Unique names:       ${stats.totalNames}`);
  console.log(`GPT calls:          ${stats.gptCalls}`);
  console.log(`Matched existing:   ${stats.matched}`);
  console.log(`New products:       ${stats.created}`);
  console.log(`Ingredients linked: ${stats.ingredientsLinked}`);
  console.log(`Tokens: in=${stats.totalInput} out=${stats.totalOutput}`);
  console.log(`Cost: $${cost.toFixed(4)} (~${(cost * 4).toFixed(2)} zł)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
