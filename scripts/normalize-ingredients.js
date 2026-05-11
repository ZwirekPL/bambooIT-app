/**
 * Normalize unlinked recipe ingredient names and match to CleanProduct.
 *
 * Phase 1: Rule-based normalization (regex)
 * Phase 2: pg_trgm fuzzy matching against CleanProduct.name
 * Phase 3: Report unmatched for manual review / GPT fallback
 *
 * Usage:
 *   node scripts/normalize-ingredients.js [--dry-run] [--limit 100]
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1], 10)
  : 0;

// ── Normalization rules ─────────────────────────────────────────────────────

// Units/measures to strip
const MEASURES = [
  "łyżk[aię]?(?:czk[aię])?",
  "łyżeczk[aię]?",
  "szklank[aię]?",
  "szczyp[tay]?(?:ek)?",
  "garść",
  "porcj[aię]?",
  "plaster(?:ek|ki|ków)?",
  "ząb(?:ek|ki|ków)?",
  "kawałe?k(?:ów)?",
  "listek|listki|liście|liści",
  "gałązk[aię]?",
  "pęcze?k(?:ów)?",
  "opakowanie|opakowania",
  "puszk[aię]?",
  "saszetk[aię]?",
  "torebk[aię]?",
  "butelk[aię]?",
  "kropla|krople|kropli",
  "sztuk[aię]?|szt",
].join("|");

const MEASURE_RE = new RegExp(
  `(?:^|\\s)(?:(?:pół|półtor[ay]|ćwierć|\\d+[/.,]?\\d*)\\s*)?(?:${MEASURES})(?:\\s|$)`,
  "gi"
);

// Quantity patterns
const QUANTITY_PATTERNS = [
  /^\d+[/.,]?\d*\s*(g|kg|ml|l|dag|dkg)\b\s*/i,       // "60 g", "200 ml"
  /^(?:pół|półtor[ay]|ćwierć)\s+/i,                    // "pół"
  /^\d+[/.,]?\d*\s*/,                                   // "2 ", "1/2 "
  /^(?:po\s+)?\d+[/.,]?\d*\s*/i,                       // "po 2"
  /^około\s+/i,                                          // "około"
  /^do\s+\d+/i,                                          // "do 200 g"
  /^ok\.\s*/i,                                           // "ok. 2"
];

// Suffix patterns to strip
const SUFFIX_PATTERNS = [
  /\s*[-–]\s*(?:do\s+)?\d+[/.,]?\d*\s*(?:g|kg|ml|l|dag|szt|sztuk)?\s*$/i,  // "- 200 g"
  /\s*[-–]\s*(?:opcjonalnie|do smaku|lub więcej|według uznania|do dekoracji).*$/i,
  /\s*\(.*\)\s*$/,                                      // "(opcjonalnie)"
  /\s*[-–]\s*około\s+.+$/i,                             // "- około 1 łyżka"
  /\s+do\s+smaku\s*$/i,                                 // "do smaku"
  /\s+do\s+dekoracji\s*$/i,                             // "do dekoracji"
  /\s+(?:ewentualnie|opcjonalnie)\s*$/i,
];

// Prefix junk
const PREFIX_PATTERNS = [
  /^przyprawy:\s*/i,
  /^ewentualnie:\s*/i,
  /^dodatkowo:\s*/i,
  /^(?:po\s+)?(?:pół|półtor[ay])?\s*(?:płask[aą])?/i,
];

/**
 * Split compound ingredients like "sól i pieprz", "kurkuma, kmin, chili"
 * Returns array of ingredient name strings
 */
function splitCompound(name) {
  // If has comma or "i " or "oraz", try splitting
  if (name.match(/,\s*| i | oraz /)) {
    // But NOT if part of a product name like "sól i pieprz" meaning both together
    // Split on comma and " i "
    const parts = name.split(/,\s*|\s+i\s+|\s+oraz\s+/).map(s => s.trim()).filter(s => s.length > 1);
    if (parts.length > 1 && parts.every(p => p.length < 40)) {
      return parts;
    }
  }
  return [name];
}

/**
 * Normalize a single ingredient display name to a clean product name
 */
function normalizeIngredientName(raw) {
  let name = raw.trim().toLowerCase();

  // Remove quantity prefixes like "2 łyżki", "100 g"
  name = name.replace(MEASURE_RE, " ");

  for (const pat of QUANTITY_PATTERNS) {
    name = name.replace(pat, "");
  }

  // Remove suffix patterns
  for (const pat of SUFFIX_PATTERNS) {
    name = name.replace(pat, "");
  }

  // Remove prefix junk
  for (const pat of PREFIX_PATTERNS) {
    name = name.replace(pat, "");
  }

  // Remove leftover units
  name = name.replace(/\b\d+[/.,]?\d*\s*(?:g|kg|ml|l|dag|dkg|szt)\b/gi, "");
  name = name.replace(/\bXXL\b/gi, "");

  // Clean up whitespace
  name = name.replace(/\s+/g, " ").trim();

  // Remove leading/trailing punctuation
  name = name.replace(/^[,;:\-–\s]+|[,;:\-–\s]+$/g, "").trim();

  return name;
}

async function main() {
  console.log("=== Ingredient Normalization & Matching ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // Phase 1: Get all unlinked ingredients
  let unlinked = await prisma.recipeIngredient.findMany({
    where: {
      cleanProductId: null,
      foodProductId: null,
      displayName: { not: null },
    },
    select: { id: true, displayName: true, recipeId: true },
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
  });

  console.log(`Unlinked ingredients: ${unlinked.length}`);

  // Phase 2: Normalize names
  const normalized = new Map(); // normalized_name -> [{id, original}]
  let splitCount = 0;

  for (const ing of unlinked) {
    const raw = ing.displayName;
    const cleanName = normalizeIngredientName(raw);
    const parts = splitCompound(cleanName);

    if (parts.length > 1) splitCount++;

    for (const part of parts) {
      if (part.length < 2) continue;
      if (!normalized.has(part)) normalized.set(part, []);
      normalized.get(part).push({ id: ing.id, original: raw });
    }
  }

  console.log(`Unique normalized names: ${normalized.size}`);
  console.log(`Compound ingredients split: ${splitCount}`);

  // Show sample normalizations
  console.log("\n--- Sample normalizations ---");
  let shown = 0;
  for (const [norm, items] of normalized) {
    if (shown >= 30) break;
    const originals = [...new Set(items.map(i => i.original))].slice(0, 3);
    console.log(`  "${originals[0]}" → "${norm}"${originals.length > 1 ? ` (${items.length} instances)` : ""}`);
    shown++;
  }

  // Phase 3: Enable pg_trgm and match
  console.log("\n--- Enabling pg_trgm extension ---");
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

  // Get all CleanProduct names for matching
  console.log("Loading CleanProduct names...");
  const products = await prisma.cleanProduct.findMany({
    select: { id: true, name: true },
  });
  console.log(`CleanProducts: ${products.length}`);

  // Build matching
  console.log("\nMatching...\n");
  let matched = 0;
  let unmatched = 0;
  const unmatchedNames = [];
  const matchResults = []; // {ingredientIds, productId, normalized, productName, similarity}

  for (const [normName, items] of normalized) {
    // Try exact match first (case-insensitive)
    let bestMatch = null;
    let bestSim = 0;

    const lowerNorm = normName.toLowerCase();
    for (const p of products) {
      const lowerP = p.name.toLowerCase();

      // Exact match
      if (lowerP === lowerNorm) {
        bestMatch = p;
        bestSim = 1.0;
        break;
      }

      // Contains match (product name contains normalized or vice versa)
      if (lowerP.includes(lowerNorm) || lowerNorm.includes(lowerP)) {
        const sim = Math.min(lowerNorm.length, lowerP.length) / Math.max(lowerNorm.length, lowerP.length);
        if (sim > bestSim && sim >= 0.5) {
          bestMatch = p;
          bestSim = sim;
        }
      }
    }

    // If no good match yet, use trigram similarity via SQL
    if (!bestMatch || bestSim < 0.6) {
      try {
        const result = await prisma.$queryRawUnsafe(`
          SELECT id, name, similarity(LOWER(name), LOWER($1)) AS sim
          FROM "CleanProduct"
          WHERE similarity(LOWER(name), LOWER($1)) > 0.35
          ORDER BY sim DESC
          LIMIT 1
        `, normName);

        if (result.length > 0 && parseFloat(result[0].sim) > bestSim) {
          bestMatch = { id: result[0].id, name: result[0].name };
          bestSim = parseFloat(result[0].sim);
        }
      } catch (e) {
        // pg_trgm might not work, fallback to contains
      }
    }

    if (bestMatch && bestSim >= 0.4) {
      matched++;
      matchResults.push({
        ingredientIds: items.map(i => i.id),
        productId: bestMatch.id,
        normalized: normName,
        productName: bestMatch.name,
        similarity: bestSim,
      });
    } else {
      unmatched++;
      unmatchedNames.push({ name: normName, count: items.length });
    }
  }

  console.log(`Matched: ${matched} / ${normalized.size} (${Math.round(matched/normalized.size*100)}%)`);
  console.log(`Unmatched: ${unmatched}`);

  // Show top matches
  console.log("\n--- Sample matches ---");
  matchResults
    .sort((a, b) => b.ingredientIds.length - a.ingredientIds.length)
    .slice(0, 20)
    .forEach(m => {
      console.log(`  "${m.normalized}" → "${m.productName}" (sim=${m.similarity.toFixed(2)}, ${m.ingredientIds.length} ingredients)`);
    });

  // Show top unmatched
  console.log("\n--- Top unmatched (need new CleanProduct) ---");
  unmatchedNames
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)
    .forEach(u => {
      console.log(`  "${u.name}" (${u.count} ingredients)`);
    });

  // Phase 4: Apply matches
  if (!DRY_RUN) {
    console.log("\n--- Applying matches ---");
    let applied = 0;
    for (const m of matchResults) {
      if (m.similarity < 0.4) continue; // safety
      await prisma.recipeIngredient.updateMany({
        where: { id: { in: m.ingredientIds } },
        data: { cleanProductId: m.productId },
      });
      applied += m.ingredientIds.length;
    }
    console.log(`Applied: ${applied} ingredient links`);
  }

  // Save unmatched list for review
  const unmatchedReport = unmatchedNames
    .sort((a, b) => b.count - a.count)
    .map(u => `${u.name}\t${u.count}`)
    .join("\n");

  require("fs").writeFileSync(
    "c:/tmp/scraper/unmatched-ingredients.tsv",
    `name\tcount\n${unmatchedReport}`,
    "utf8"
  );
  console.log(`\nUnmatched list saved to c:/tmp/scraper/unmatched-ingredients.tsv`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
