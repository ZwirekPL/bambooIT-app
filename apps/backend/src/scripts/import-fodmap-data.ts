/**
 * Import FODMAP classification into CleanProduct table.
 *
 * Source: Monash University FODMAP Diet App data (public summaries),
 * King's College London Low FODMAP Diet guidelines (2021).
 *
 * Strategy: Match product name (Polish) against known high/moderate/low FODMAP foods.
 * Products not matched remain NULL (unknown).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/import-fodmap-data.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/import-fodmap-data.ts --dry-run
 */

import { prisma } from '@db';

const DRY_RUN = process.argv.includes('--dry-run');

type FodmapLevel = 'LOW' | 'MODERATE' | 'HIGH';

interface FodmapEntry {
  pattern: RegExp;
  level: FodmapLevel;
  note: string;
}

// ─── FODMAP Reference Table ────────────────────────────────────────────────
// Based on Monash University data + King's College London guidelines
// HIGH = triggers IBS symptoms at normal serving sizes
// MODERATE = safe in small portions
// LOW = safe at normal portions

const FODMAP_TABLE: FodmapEntry[] = [
  // ═══ HIGH FODMAP ═══════════════════════════════════════════════════

  // Fructans (wheat, onion, garlic)
  { pattern: /\bcebul[aięy]\b/i, level: 'HIGH', note: 'fructans (onion)' },
  { pattern: /\bczosn[eio]k/i, level: 'HIGH', note: 'fructans (garlic)' },
  { pattern: /czosnek.*pasta|pasta.*czosnek/i, level: 'HIGH', note: 'fructans (garlic paste)' },
  { pattern: /\bpor\b/i, level: 'HIGH', note: 'fructans (leek)' },
  { pattern: /szalotk/i, level: 'HIGH', note: 'fructans (shallot)' },
  { pattern: /\bpszen[icn]/i, level: 'HIGH', note: 'fructans (wheat)' },
  { pattern: /\bchleb\s*(biał|pszenn|tostow)/i, level: 'HIGH', note: 'fructans (white bread)' },
  { pattern: /\bmąka\s*pszenn/i, level: 'HIGH', note: 'fructans (wheat flour)' },
  { pattern: /mąka\s*tortow/i, level: 'HIGH', note: 'fructans (cake flour)' },

  // GOS (legumes)
  { pattern: /fasol[aęiy](?!\s*(szparagow|zielon))/i, level: 'HIGH', note: 'GOS (beans)' },
  { pattern: /ciecierzyc/i, level: 'HIGH', note: 'GOS (chickpeas)' },
  { pattern: /soczewic/i, level: 'HIGH', note: 'GOS (lentils)' },
  { pattern: /groch(?!ow)/i, level: 'HIGH', note: 'GOS (peas)' },
  { pattern: /hummus/i, level: 'HIGH', note: 'GOS (chickpea-based)' },

  // Lactose (milk, soft cheese, yogurt)
  { pattern: /\bmleko\b(?!\s*(kokos|migdał|owsi|ryżow|sojow|bezlaktoz))/i, level: 'HIGH', note: 'lactose (milk)' },
  { pattern: /śmietan[aęk](?!\s*bezlaktoz)/i, level: 'HIGH', note: 'lactose (cream)' },
  { pattern: /ricotta/i, level: 'HIGH', note: 'lactose (ricotta)' },
  { pattern: /lod[yó](?!\s*bezlaktoz)/i, level: 'HIGH', note: 'lactose (ice cream)' },

  // Fructose excess (apple, pear, mango, honey, HFCS)
  { pattern: /\bjabłk[oa]/i, level: 'HIGH', note: 'fructose (apple)' },
  { pattern: /\bgruszk[aię]/i, level: 'HIGH', note: 'fructose (pear)' },
  { pattern: /\bmango\b/i, level: 'HIGH', note: 'fructose (mango)' },
  { pattern: /\bmiód\b|honey/i, level: 'HIGH', note: 'fructose (honey)' },
  { pattern: /arbuz|watermelon/i, level: 'HIGH', note: 'fructose (watermelon)' },
  { pattern: /\bwiśni[aeę]/i, level: 'HIGH', note: 'polyols (cherry)' },
  { pattern: /czereśni/i, level: 'HIGH', note: 'polyols (cherry)' },

  // Polyols (mushrooms, cauliflower, sweeteners)
  { pattern: /pieczark|grzyb|mushroom/i, level: 'HIGH', note: 'polyols (mushrooms)' },
  { pattern: /kalafior|cauliflower/i, level: 'HIGH', note: 'polyols (cauliflower)' },
  { pattern: /sorbitol|mannitol|ksylitol|xylitol|erytritol|erythritol/i, level: 'HIGH', note: 'polyols (sweetener)' },
  { pattern: /\bśliwk[aię]/i, level: 'HIGH', note: 'polyols (plum)' },
  { pattern: /morela|apricot/i, level: 'HIGH', note: 'polyols (apricot)' },
  { pattern: /suszon.*owoc|dried.*fruit/i, level: 'HIGH', note: 'concentrated FODMAP' },

  // ═══ MODERATE FODMAP ═══════════════════════════════════════════════

  { pattern: /batata?|sweet\s*potato/i, level: 'MODERATE', note: 'moderate fructans' },
  { pattern: /brukselk|brussels/i, level: 'MODERATE', note: 'moderate fructans' },
  { pattern: /burak|beetroot/i, level: 'MODERATE', note: 'moderate fructans/GOS' },
  { pattern: /avocado|awokado/i, level: 'MODERATE', note: 'moderate polyols (sorbitol)' },
  { pattern: /\bbanan/i, level: 'MODERATE', note: 'moderate fructans (ripe)' },
  { pattern: /kukurydz[aę]/i, level: 'MODERATE', note: 'moderate fructans/GOS' },
  { pattern: /żurawina|cranberr/i, level: 'MODERATE', note: 'moderate fructose' },
  { pattern: /edamame/i, level: 'MODERATE', note: 'moderate GOS' },
  { pattern: /chleb\s*(żytni|razow|pełnoziar)/i, level: 'MODERATE', note: 'moderate fructans' },
  { pattern: /kapust[aęy](?!.*kimchi)/i, level: 'MODERATE', note: 'moderate fructans' },

  // ═══ LOW FODMAP ════════════════════════════════════════════════════

  // Proteins (all low FODMAP)
  { pattern: /kurczak|indyk|drob|pierś|udko|chicken|turkey/i, level: 'LOW', note: 'protein (low FODMAP)' },
  { pattern: /wołowin|cielęc|beef|steak/i, level: 'LOW', note: 'protein' },
  { pattern: /wieprzow|szynk[aię]|schab|pork/i, level: 'LOW', note: 'protein' },
  { pattern: /łosoś|dorsz|tuńczyk|pstrąg|makrela|ryb[aęy]|salmon|cod|tuna/i, level: 'LOW', note: 'protein' },
  { pattern: /jaj[koe]|egg/i, level: 'LOW', note: 'protein' },
  { pattern: /tofu(?!.*ferment)/i, level: 'LOW', note: 'firm tofu (low FODMAP)' },

  // Low FODMAP vegetables
  { pattern: /marchew|carrot/i, level: 'LOW', note: 'low FODMAP veg' },
  { pattern: /pomidor|tomato/i, level: 'LOW', note: 'low FODMAP veg' },
  { pattern: /cukini[aię]/i, level: 'LOW', note: 'low FODMAP veg' },
  { pattern: /bakłażan|eggplant/i, level: 'LOW', note: 'low FODMAP veg' },
  { pattern: /szpinak|spinach/i, level: 'LOW', note: 'low FODMAP veg' },
  { pattern: /papryk[aię]|pepper/i, level: 'LOW', note: 'low FODMAP veg' },
  { pattern: /ogórek|cucumber/i, level: 'LOW', note: 'low FODMAP veg' },
  { pattern: /sałat[aęy]|lettuce/i, level: 'LOW', note: 'low FODMAP veg' },
  { pattern: /szparag|asparagus/i, level: 'LOW', note: 'low FODMAP veg (tips only)' },
  { pattern: /brokul|broccoli/i, level: 'LOW', note: 'low FODMAP veg (heads)' },
  { pattern: /dynia|pumpkin/i, level: 'LOW', note: 'low FODMAP veg' },
  { pattern: /ziemniak(?!.*słodk)/i, level: 'LOW', note: 'potato (low FODMAP)' },
  { pattern: /imbir|ginger/i, level: 'LOW', note: 'low FODMAP spice' },
  { pattern: /jarmuż|kale/i, level: 'LOW', note: 'low FODMAP veg' },

  // Low FODMAP fruits
  { pattern: /truskawk|strawberr/i, level: 'LOW', note: 'low FODMAP fruit' },
  { pattern: /malin[aiy]|raspberry/i, level: 'LOW', note: 'low FODMAP fruit' },
  { pattern: /jagod[aiy]|blueberr|borówk/i, level: 'LOW', note: 'low FODMAP fruit' },
  { pattern: /cytryn[aiy]|lemon/i, level: 'LOW', note: 'low FODMAP fruit' },
  { pattern: /pomarańcz|orange/i, level: 'LOW', note: 'low FODMAP fruit' },
  { pattern: /winogrono|grape(?!fruit)/i, level: 'LOW', note: 'low FODMAP fruit' },
  { pattern: /kiwi/i, level: 'LOW', note: 'low FODMAP fruit' },
  { pattern: /ananas|pineapple/i, level: 'LOW', note: 'low FODMAP fruit' },

  // Low FODMAP dairy
  { pattern: /masło|butter/i, level: 'LOW', note: 'low lactose' },
  { pattern: /parmezan|cheddar|gouda|mozzarella|feta|brie|camembert/i, level: 'LOW', note: 'hard cheese (low lactose)' },
  { pattern: /mleko\s*(bezlaktoz|lactose.?free)/i, level: 'LOW', note: 'lactose-free milk' },
  { pattern: /jogurt\s*(bezlaktoz|grec)/i, level: 'LOW', note: 'Greek yogurt/lactose-free' },

  // Low FODMAP grains
  { pattern: /ryż|rice/i, level: 'LOW', note: 'low FODMAP grain' },
  { pattern: /owsian|oat(?!meal)/i, level: 'LOW', note: 'oats (low FODMAP)' },
  { pattern: /quinoa|komosa/i, level: 'LOW', note: 'low FODMAP grain' },
  { pattern: /kasza\s*gryczan|buckwheat/i, level: 'LOW', note: 'buckwheat (low FODMAP)' },
  { pattern: /kasza\s*kukurydz|polenta|corn/i, level: 'LOW', note: 'corn (low FODMAP)' },
  { pattern: /chleb\s*(bezgluten|owsian|ryżow|kukurydz|gryczany)/i, level: 'LOW', note: 'GF/low-FODMAP bread' },
  { pattern: /makaron\s*(ryżow|bezgluten|kukurydz|gryczany)/i, level: 'LOW', note: 'GF pasta' },

  // Low FODMAP nuts & seeds
  { pattern: /orzech.*włosk|walnut/i, level: 'LOW', note: 'walnuts (low FODMAP)' },
  { pattern: /migdał|almond/i, level: 'LOW', note: 'almonds ≤10 (low FODMAP)' },
  { pattern: /makadami|macadamia/i, level: 'LOW', note: 'macadamia (low FODMAP)' },
  { pattern: /pestk[aię].*dyni|pumpkin.*seed/i, level: 'LOW', note: 'pumpkin seeds (low FODMAP)' },
  { pattern: /pestk[aię].*słoneczn|sunflower.*seed/i, level: 'LOW', note: 'sunflower seeds (low FODMAP)' },
  { pattern: /sezam|sesame/i, level: 'LOW', note: 'sesame (low FODMAP)' },
  { pattern: /chia/i, level: 'LOW', note: 'chia (low FODMAP)' },
  { pattern: /kokos|coconut/i, level: 'LOW', note: 'coconut (low FODMAP)' },

  // Fats & oils (all low FODMAP)
  { pattern: /oliw[aęy]|olej|oil/i, level: 'LOW', note: 'fats (low FODMAP)' },

  // Sweeteners
  { pattern: /cukier|sugar/i, level: 'LOW', note: 'table sugar (sucrose = low FODMAP)' },
  { pattern: /syrop\s*klonow|maple/i, level: 'LOW', note: 'maple syrup (low FODMAP)' },
  { pattern: /czekolad.*ciemn|dark.*chocolate/i, level: 'LOW', note: 'dark chocolate (low FODMAP ≤30g)' },

  // Beverages
  { pattern: /mleko\s*(kokos|migdał|ryżow|owsi)/i, level: 'LOW', note: 'plant milk (low FODMAP)' },
  { pattern: /kawa|coffee/i, level: 'LOW', note: 'coffee (low FODMAP)' },
  { pattern: /herba[tc]|tea\b/i, level: 'LOW', note: 'tea (low FODMAP)' },

  // Spices (all low FODMAP)
  { pattern: /sól\b|pieprz|oregano|bazylia|tymianek|curry|kurkum|cynamon|papryk.*mielon/i, level: 'LOW', note: 'spices (low FODMAP)' },
  { pattern: /sos\s*sojow/i, level: 'LOW', note: 'soy sauce (low FODMAP)' },
  { pattern: /ocet|vinegar/i, level: 'LOW', note: 'vinegar (low FODMAP)' },
  { pattern: /musztard|mustard/i, level: 'LOW', note: 'mustard (low FODMAP)' },
  { pattern: /majone|mayo/i, level: 'LOW', note: 'mayonnaise (low FODMAP)' },
];

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== FODMAP Data Import ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  const products = await prisma.cleanProduct.findMany({
    where: { fodmapLevel: null },
    select: { id: true, name: true, category: true },
  });

  console.log(`Products with NULL fodmapLevel: ${products.length}`);

  let matched = 0;
  const updates: Array<{ id: string; name: string; level: FodmapLevel; note: string }> = [];

  for (const product of products) {
    for (const entry of FODMAP_TABLE) {
      if (entry.pattern.test(product.name)) {
        updates.push({ id: product.id, name: product.name, level: entry.level, note: entry.note });
        matched++;
        break;
      }
    }
  }

  console.log(`Matched: ${matched} / ${products.length} (${(matched / products.length * 100).toFixed(1)}%)`);

  // Distribution
  const dist = { LOW: 0, MODERATE: 0, HIGH: 0 };
  for (const u of updates) dist[u.level]++;
  console.log(`\n--- FODMAP Distribution ---`);
  console.log(`  LOW:      ${dist.LOW}`);
  console.log(`  MODERATE: ${dist.MODERATE}`);
  console.log(`  HIGH:     ${dist.HIGH}`);

  // Sample HIGH FODMAP (most clinically important)
  console.log('\n--- High FODMAP matches (first 15) ---');
  for (const u of updates.filter((u) => u.level === 'HIGH').slice(0, 15)) {
    console.log(`  ${u.name.padEnd(40)} ← ${u.note}`);
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes made.\n');
    return;
  }

  console.log(`\nApplying ${updates.length} updates...`);
  const BATCH_SIZE = 100;
  let applied = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((u) =>
        prisma.cleanProduct.update({
          where: { id: u.id },
          data: { fodmapLevel: u.level },
        }),
      ),
    );
    applied += batch.length;
    if (applied % 500 === 0 || applied === updates.length) {
      console.log(`  ${applied} / ${updates.length}`);
    }
  }

  console.log(`\nDone! Updated ${applied} products.\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
