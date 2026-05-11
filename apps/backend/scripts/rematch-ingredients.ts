/**
 * Re-match unlinked RecipeIngredients to CleanProducts.
 *
 * Extracts the core product name from descriptive displayNames
 * (e.g. "6 łyżek mąki pszennej" → "mąka pszenna") and uses
 * fuzzy matching to find the best CleanProduct.
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/rematch-ingredients.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import {
  fuzzyMatchProduct,
  getCanonicalProductNames,
  normalizeProductName,
} from '../src/services/productNameStandardization.service';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Name extraction patterns ────────────────────────────────────────────────

/** Remove quantity prefixes: "2 łyżki cukru" → "cukru" */
function stripQuantityPrefix(name: string): string {
  return name
    // "1/2 łyżeczki X" or "2 łyżki X"
    .replace(/^[\d.,/]+\s*(pełn[aey]ch?\s+)?(łyżk[aiy]|łyżeczk[aiy]|szklan[aieky]+|szt\.?|ząbk?[iówy]*|garś[ćc]|pęcz[eków]+|plastr[aówy]*|gałąz[eką]+|krop[el]+|szczyp[ta]*|lask[aiy]|listkó?w?|kostk[aiy])\s+/i, '')
    // "200 g X" or "500 ml X"
    .replace(/^[\d.,]+\s*(g|mg|ml|kg|l|dag)\b\s*/i, '')
    // leading numbers without unit: "2 ząbki czosnku" → already handled
    .replace(/^[\d.,/]+\s+/, '')
    .trim();
}

/** Remove parenthetical notes and qualifiers */
function stripNotes(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')                    // (opcjonalnie), (500 g)
    .replace(/\s*[-–—]\s*do \w+/gi, '')         // "- do dekoracji"
    .replace(/\s*(opcjonalnie|do smaku|do dekoracji|do podania|wg uznania)/gi, '')
    .replace(/\s*(lub|albo)\s+.*/gi, '')        // "X lub Y" → just X
    .replace(/\s*[,;].*$/g, '')                 // strip after comma
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract core product name from descriptive displayName */
function extractCoreName(displayName: string): string {
  let name = displayName.trim();

  // Skip very short or empty
  if (name.length < 2) return name;

  name = stripNotes(name);
  name = stripQuantityPrefix(name);

  // "z pierwszego tłoczenia" → "oliwa"
  name = name.replace(/z pierwszego tłoczenia/i, '').trim();
  // "świeżego rozmarynu" → "rozmaryn"
  name = name.replace(/^śwież[aeygo]+\s+/i, '').trim();
  // "gorzkiego kakao" → "kakao"
  name = name.replace(/^(gorzki|gorzkie|gorzkiego)\s+/i, '').trim();
  // "posiekanego X" → "X"
  name = name.replace(/^(posiekan[yaeog]+|pokrojon[yaeog]+|startego|drobno)\s+/i, '').trim();

  // Common specific fixes
  const SPECIFIC_MAP: Record<string, string> = {
    // Przyprawy i dodatki (dopełniacz → mianownik)
    'cukru': 'cukier',
    'cukru wanilinowego': 'cukier wanilinowy',
    'cukru pudru': 'cukier puder',
    'proszku do pieczenia': 'proszek do pieczenia',
    'sody oczyszczonej': 'soda oczyszczona',
    'kakao': 'kakao',
    'cynamonu': 'cynamon',
    'czosnku': 'czosnek',
    'ząbek czosnku': 'czosnek',
    'ząbki czosnku': 'czosnek',
    'rozmarynu': 'rozmaryn',
    'suszonego rozmarynu': 'rozmaryn',
    'soli': 'sól',
    'pieprzu': 'pieprz',
    'pieprzu czarnego': 'pieprz czarny',
    'oliwy': 'oliwa z oliwek',
    'oliwy truflowej': 'oliwa z oliwek',
    'masła': 'masło',
    'mąki pszennej': 'mąka pszenna',
    'mąki pszennej tortowej': 'mąka pszenna',
    'mąki': 'mąka pszenna',
    'kawy rozpuszczalnej': 'kawa rozpuszczalna',
    'budyń śmietankowy': 'budyń',
    'białej ryby ze skórką': 'ryba biała',
    'białej ryby': 'ryba biała',
    'bazylii': 'bazylia',
    'szparagów': 'szparag',
    'papryka': 'papryka czerwona',
    'papryki': 'papryka czerwona',
    'mielonej papryki': 'papryka mielona',
    'słodkiej papryki': 'papryka mielona słodka',
    'czerwonej papryki': 'papryka mielona',
    // Sosy i płyny
    'sosu sojowego': 'sos sojowy',
    'sosu worcester': 'sos worcestershire',
    'octu': 'ocet',
    'octu jabłkowego': 'ocet jabłkowy',
    'octu balsamicznego': 'ocet balsamiczny',
    'mleka': 'mleko',
    'mleka kokosowego': 'mleko kokosowe',
    'śmietany': 'śmietana',
    'śmietanki': 'śmietana',
    // Zioła i przyprawy
    'listki laurowe': 'liść laurowy',
    'listek laurowy': 'liść laurowy',
    'liście laurowe': 'liść laurowy',
    'oregano': 'oregano',
    'tymianku': 'tymianek',
    'natki pietruszki': 'natka pietruszki',
    'pietruszki': 'pietruszka',
    'koperku': 'koperek',
    'szczypiorku': 'szczypiorek',
    'kolendry': 'kolendra',
    'kminu': 'kmin',
    'kurkumy': 'kurkuma',
    'imbiru': 'imbir',
    'chili': 'papryczka chili',
    'papryczki chili': 'papryczka chili',
    'musztardy': 'musztarda',
    'musztardy dijon': 'musztarda dijon',
    // Tłuszcze
    'oleju': 'olej rzepakowy',
    'oleju kokosowego': 'olej kokosowy',
    'oleju sezamowego': 'olej sezamowy',
    'oleju rzepakowego': 'olej rzepakowy',
    // Nabiał
    'jajka': 'jajko kurze',
    'jajek': 'jajko kurze',
    'jogurtu': 'jogurt naturalny',
    'jogurtu naturalnego': 'jogurt naturalny',
    'twarogu': 'twaróg',
    'sera': 'ser żółty',
    'żółtego sera': 'ser żółty',
    'parmezanu': 'parmezan',
    // Inne
    'wody': 'woda',
    'miodu': 'miód',
    'żelatyny': 'żelatyna',
    'drożdży': 'drożdże',
    'mąki ziemniaczanej': 'mąka ziemniaczana',
    'skrobi ziemniaczanej': 'mąka ziemniaczana',
  };

  const normalized = name.toLowerCase().trim();
  if (SPECIFIC_MAP[normalized]) {
    return SPECIFIC_MAP[normalized];
  }

  // Polish genitive → nominative: strip common suffixes
  // "cukru" → "cukier" is already in map, but generic approach:
  name = name
    .replace(/ów$/i, 'y')     // "szparagów" → "szparagy" (close enough for fuzzy)
    .replace(/ek$/i, 'ka')    // "listków" → not great, skip
    ;

  return name;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 100;
const MIN_CONFIDENCE = 0.60;

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Load canonical products
  const canonical = await getCanonicalProductNames();
  console.log(`Loaded ${canonical.length} canonical products\n`);

  // Find all unmatched ingredients
  const unmatched = await prisma.recipeIngredient.findMany({
    where: { cleanProductId: null },
    select: { id: true, displayName: true, recipeId: true },
  });
  console.log(`Found ${unmatched.length} unmatched ingredients\n`);

  let matched = 0;
  let failed = 0;
  let skipped = 0;
  const matchedNames = new Map<string, { product: string; confidence: number; count: number }>();

  for (let i = 0; i < unmatched.length; i += BATCH_SIZE) {
    const batch = unmatched.slice(i, i + BATCH_SIZE);
    const updates: Array<{ id: string; cleanProductId: string }> = [];

    for (const ing of batch) {
      const raw = ing.displayName ?? '';
      if (!raw || raw.length < 2) {
        skipped++;
        continue;
      }

      const coreName = extractCoreName(raw);
      if (!coreName || coreName.length < 2) {
        skipped++;
        continue;
      }

      const result = fuzzyMatchProduct(coreName, canonical);

      if (result && result.productId && result.confidence >= MIN_CONFIDENCE) {
        updates.push({ id: ing.id, cleanProductId: result.productId });
        matched++;

        // Track for reporting
        const key = normalizeProductName(coreName);
        const existing = matchedNames.get(key);
        if (!existing || result.confidence > existing.confidence) {
          matchedNames.set(key, {
            product: result.canonicalName ?? coreName,
            confidence: result.confidence,
            count: (existing?.count ?? 0) + 1,
          });
        } else {
          existing.count++;
        }
      } else {
        failed++;
        if (failed <= 30) {
          console.log(`  MISS: "${raw}" → core: "${coreName}" → no match (best: ${result?.canonicalName ?? 'none'}, conf: ${result?.confidence?.toFixed(2) ?? 'N/A'})`);
        }
      }
    }

    // Apply updates
    if (!DRY_RUN && updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.recipeIngredient.update({
            where: { id: u.id },
            data: { cleanProductId: u.cleanProductId },
          }),
        ),
      );
    }

    console.log(`  Processed ${Math.min(i + BATCH_SIZE, unmatched.length)}/${unmatched.length} — matched: ${matched}, failed: ${failed}, skipped: ${skipped}`);
  }

  console.log(`\n=== Results ===`);
  console.log(`Matched: ${matched} (${((matched / unmatched.length) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);

  // Top matched names
  const topMatches = [...matchedNames.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20);
  console.log(`\nTop matched (by frequency):`);
  topMatches.forEach(([name, info]) => {
    console.log(`  ${name} → ${info.product} (conf: ${info.confidence.toFixed(2)}, count: ${info.count})`);
  });

  // Final stats
  const remaining = await prisma.recipeIngredient.count({ where: { cleanProductId: null } });
  console.log(`\nRemaining unmatched: ${remaining}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
