/**
 * Import Glycemic Index data into CleanProduct table.
 *
 * Source: International Tables of Glycemic Index and Glycemic Load Values
 * (Sydney University, Atkinson et al. 2021, Diabetes Care 44(8):1681-1690)
 *
 * Strategy:
 *   1. Match CleanProduct.name (Polish) against regex patterns
 *   2. Assign GI value from reference table
 *   3. Compute GL per 100g: GL = (GI / 100) × carbsPer100g
 *   4. Only update products that have NULL glycemicIndex (no overwrites)
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/import-gi-data.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/import-gi-data.ts --dry-run
 */

import { prisma } from '@db';

const DRY_RUN = process.argv.includes('--dry-run');

// ─── GI Reference Table ────────────────────────────────────────────────────
// Pattern → GI value (International Tables, Sydney University 2021)
// GI classification: Low ≤55, Medium 56-69, High ≥70

interface GiEntry {
  pattern: RegExp;
  gi: number;
  source: string;  // brief citation
}

const GI_TABLE: GiEntry[] = [
  // ═══ PRODUKTY ZBOŻOWE / GRAINS ═══
  // Ryż
  { pattern: /ryż\s*(biał|jaśmin|basmati|parboiled|do sushi)/i, gi: 72, source: 'white rice avg' },
  { pattern: /ryż\s*(brązow|pełnoziar|dzik|czerwon|czarn)/i, gi: 50, source: 'brown rice avg' },
  { pattern: /\bryż\b/i, gi: 72, source: 'white rice default' },
  // Makaron
  { pattern: /makaron\s*(pełnoziar|razow)/i, gi: 42, source: 'whole wheat pasta' },
  { pattern: /makaron|spaghett|penne|tagliatell|lasagn|noodle|mie\b/i, gi: 49, source: 'pasta avg (al dente)' },
  // Chleb
  { pattern: /chleb\s*(pełnoziar|razow|żytni|graham)/i, gi: 50, source: 'whole grain bread' },
  { pattern: /chleb\s*(biał|pszenn|tostow)/i, gi: 75, source: 'white bread' },
  { pattern: /\bchleb\b/i, gi: 65, source: 'bread avg' },
  { pattern: /bułk[aię]?\s*(pełnoziar|razow|graham)/i, gi: 52, source: 'whole grain roll' },
  { pattern: /bułk[aię]|kajzer/i, gi: 73, source: 'white roll' },
  { pattern: /bułka tarta/i, gi: 74, source: 'breadcrumbs' },
  { pattern: /tortill[aiy]/i, gi: 52, source: 'wheat tortilla' },
  { pattern: /bagietk/i, gi: 75, source: 'baguette' },
  { pattern: /pita/i, gi: 57, source: 'pita bread' },
  // Kasze
  { pattern: /kasza\s*jaglan/i, gi: 71, source: 'millet' },
  { pattern: /kasza\s*gryczan/i, gi: 54, source: 'buckwheat' },
  { pattern: /kasza\s*mann/i, gi: 66, source: 'semolina' },
  { pattern: /kasza\s*jęczmien|pęczak|perłow/i, gi: 28, source: 'barley' },
  { pattern: /kasza\s*kukurydz/i, gi: 69, source: 'corn grits' },
  { pattern: /\bkasza\b/i, gi: 55, source: 'groats default' },
  { pattern: /kuskus|couscous/i, gi: 65, source: 'couscous' },
  { pattern: /quinoa|komosa ryżowa/i, gi: 53, source: 'quinoa' },
  { pattern: /bulgur/i, gi: 48, source: 'bulgur' },
  { pattern: /amarant/i, gi: 97, source: 'amaranth' },
  // Płatki
  { pattern: /płatki?\s*owsian|owsiank/i, gi: 55, source: 'rolled oats' },
  { pattern: /płatki?\s*kukurydz|corn\s*flakes/i, gi: 81, source: 'cornflakes' },
  { pattern: /müsli|musli|muesli/i, gi: 56, source: 'muesli' },
  { pattern: /granola/i, gi: 55, source: 'granola' },
  // Mąka
  { pattern: /mąka\s*(pszenn|tortow|typ\s*[45])/i, gi: 70, source: 'white wheat flour' },
  { pattern: /mąka\s*(pełnoziar|razow|graham|żytni|typ\s*[12])/i, gi: 55, source: 'whole wheat flour' },
  { pattern: /mąka\s*kukurydz/i, gi: 69, source: 'corn flour' },
  { pattern: /mąka\s*ryżow/i, gi: 72, source: 'rice flour' },
  { pattern: /mąka\s*(kokos|migdał|owsi)/i, gi: 25, source: 'nut/oat flour (low carb)' },
  { pattern: /\bmąka\b/i, gi: 70, source: 'flour default (wheat)' },
  { pattern: /skrobia\s*ziemniaczan/i, gi: 85, source: 'potato starch' },
  { pattern: /skrobia\s*kukurydz/i, gi: 70, source: 'corn starch' },

  // ═══ ZIEMNIAKI & KORZENIOWE / POTATOES ═══
  { pattern: /ziemniak|kartofl|potato/i, gi: 78, source: 'potato boiled avg' },
  { pattern: /batat|słodk.*ziemniak|sweet\s*potato/i, gi: 63, source: 'sweet potato' },
  { pattern: /sałatk.*ziemniaczan/i, gi: 78, source: 'potato salad' },

  // ═══ WARZYWA / VEGETABLES ═══
  // Most non-starchy vegetables have very low GI (≤15)
  { pattern: /marchew|carrot/i, gi: 39, source: 'carrot' },
  { pattern: /burak|beetroot/i, gi: 64, source: 'beetroot' },
  { pattern: /dynia|pumpkin/i, gi: 64, source: 'pumpkin' },
  { pattern: /kukurydz[aę]?\s*(słodk|konserwow|w puszc)/i, gi: 52, source: 'sweet corn' },
  { pattern: /groszek\s*(zielon|mrożon)/i, gi: 48, source: 'green peas' },
  // Non-starchy → GI 15 (generic)
  { pattern: /cebul[aię]|onion/i, gi: 15, source: 'onion' },
  { pattern: /pomidor|tomato/i, gi: 15, source: 'tomato' },
  { pattern: /czosn[eio]k|garlic/i, gi: 15, source: 'garlic' },
  { pattern: /papryk[aię]|pepper/i, gi: 15, source: 'pepper' },
  { pattern: /cukini[aię]/i, gi: 15, source: 'zucchini' },
  { pattern: /bakłażan|eggplant/i, gi: 15, source: 'eggplant' },
  { pattern: /szpinak|spinach/i, gi: 15, source: 'spinach' },
  { pattern: /brokul|broccoli/i, gi: 15, source: 'broccoli' },
  { pattern: /kalafior|cauliflower/i, gi: 15, source: 'cauliflower' },
  { pattern: /kapust[aęy]|cabbage/i, gi: 15, source: 'cabbage' },
  { pattern: /sałat[aęy]|lettuce/i, gi: 15, source: 'lettuce' },
  { pattern: /ogórek|cucumber/i, gi: 15, source: 'cucumber' },
  { pattern: /szparag|asparagus/i, gi: 15, source: 'asparagus' },
  { pattern: /seler|celery/i, gi: 15, source: 'celery' },
  { pattern: /por\b|leek/i, gi: 15, source: 'leek' },
  { pattern: /jarmuż|kale/i, gi: 15, source: 'kale' },
  { pattern: /rzodkiew|radish/i, gi: 15, source: 'radish' },
  { pattern: /pieczark|grzyb|mushroom/i, gi: 15, source: 'mushroom' },
  { pattern: /natka|pietruszk.*śwież|parsley/i, gi: 15, source: 'parsley' },
  { pattern: /\bkoper\b|dill/i, gi: 15, source: 'dill' },
  { pattern: /fasol.*szparagow|green\s*bean/i, gi: 15, source: 'green beans' },

  // ═══ OWOCE / FRUITS ═══
  { pattern: /jabłk[oa]|apple/i, gi: 36, source: 'apple' },
  { pattern: /banan|banana/i, gi: 51, source: 'banana' },
  { pattern: /pomarańcz|orange/i, gi: 43, source: 'orange' },
  { pattern: /gruszk[aię]|pear/i, gi: 38, source: 'pear' },
  { pattern: /truskawk|strawberr/i, gi: 40, source: 'strawberry' },
  { pattern: /malin[aiy]|raspberry/i, gi: 32, source: 'raspberry' },
  { pattern: /jagod[aiy]|blueberr|borówk/i, gi: 53, source: 'blueberry' },
  { pattern: /winogrono|grape(?!fruit)/i, gi: 46, source: 'grapes' },
  { pattern: /ananas|pineapple/i, gi: 59, source: 'pineapple' },
  { pattern: /mango/i, gi: 51, source: 'mango' },
  { pattern: /arbuz|watermelon/i, gi: 76, source: 'watermelon' },
  { pattern: /cytryn[aiy]|lemon/i, gi: 20, source: 'lemon' },
  { pattern: /awokado|avocado/i, gi: 15, source: 'avocado' },
  { pattern: /kiwi/i, gi: 53, source: 'kiwi' },
  { pattern: /brzoskwini[aęy]|peach/i, gi: 42, source: 'peach' },
  { pattern: /morela|apricot/i, gi: 57, source: 'apricot fresh' },
  { pattern: /śliwk[aię]|plum/i, gi: 39, source: 'plum' },
  { pattern: /czereśni[aęy]|wiśni[aęy]|cherr/i, gi: 22, source: 'cherry' },
  { pattern: /daktyl|date/i, gi: 42, source: 'dates' },
  { pattern: /fig[aię]|fig\b/i, gi: 61, source: 'fig fresh' },
  { pattern: /rodzynk|raisin/i, gi: 64, source: 'raisins' },
  { pattern: /żurawin|cranberr/i, gi: 45, source: 'cranberry' },
  { pattern: /sok\s*(pomarańcz|jabłk|grape)/i, gi: 50, source: 'fruit juice avg' },
  { pattern: /sok\s*z\s*cytryn/i, gi: 20, source: 'lemon juice' },

  // ═══ NABIAŁ / DAIRY ═══
  { pattern: /mleko(?!\s*kokos)/i, gi: 31, source: 'whole milk' },
  { pattern: /jogurt\s*naturaln|jogurt\s*grec/i, gi: 36, source: 'plain yogurt' },
  { pattern: /jogurt.*owoc|jogurt.*smak/i, gi: 41, source: 'flavored yogurt' },
  { pattern: /kefir/i, gi: 36, source: 'kefir' },
  { pattern: /twaróg|twarog|cottage|ricotta/i, gi: 30, source: 'cottage cheese' },
  { pattern: /śmietan[aęk]/i, gi: 15, source: 'cream' },
  { pattern: /ser\b|parmez|goud|cheddar|mozzarell|feta|mascarp|camembert|brie/i, gi: 0, source: 'cheese (no carbs)' },
  { pattern: /masł[oa]|butter/i, gi: 0, source: 'butter (no carbs)' },
  { pattern: /skyr/i, gi: 30, source: 'skyr' },

  // ═══ ROŚLINY STRĄCZKOWE / LEGUMES ═══
  { pattern: /soczewic[aęy]|lentil/i, gi: 32, source: 'lentils' },
  { pattern: /ciecierzyc[aęy]|chickpea|hummus/i, gi: 28, source: 'chickpeas' },
  { pattern: /fasol[aęiy]\s*(biał|czerwon|czarn|kidney|lima|cannell)/i, gi: 30, source: 'beans avg' },
  { pattern: /fasol.*guar|guar/i, gi: 25, source: 'guar bean' },
  { pattern: /groch|pea(?!nut)/i, gi: 48, source: 'peas' },
  { pattern: /edamame|soj[aęy]\b/i, gi: 18, source: 'soy/edamame' },
  { pattern: /tofu|tempeh/i, gi: 15, source: 'tofu/tempeh' },

  // ═══ ORZECHY & NASIONA / NUTS & SEEDS ═══
  // Most nuts have GI ~15-20 (very low carb)
  { pattern: /orzech|pekan|cashew|pistacj|migdał|almond|hazelnut|walnut/i, gi: 15, source: 'nuts avg' },
  { pattern: /pestk[aię]|seed|nasion[aę]|siemi[eę]/i, gi: 15, source: 'seeds avg' },
  { pattern: /sezam|sesame/i, gi: 15, source: 'sesame' },
  { pattern: /chia/i, gi: 15, source: 'chia seeds' },
  { pattern: /mak\b|poppy/i, gi: 15, source: 'poppy seeds' },
  { pattern: /kokos(?!ow.*mleko)|coconut(?!.*milk)/i, gi: 45, source: 'coconut' },

  // ═══ SŁODYCZE & CUKRY / SWEETENERS ═══
  { pattern: /cukier\s*(biał|kryszta|drobn|pudr|trzcinow)/i, gi: 65, source: 'sucrose' },
  { pattern: /\bcukier\b/i, gi: 65, source: 'sugar default' },
  { pattern: /miód|honey/i, gi: 61, source: 'honey' },
  { pattern: /syrop\s*klonow|maple/i, gi: 54, source: 'maple syrup' },
  { pattern: /czekolad[aęy]\s*(gorz|ciemn|70|80|90)/i, gi: 40, source: 'dark chocolate' },
  { pattern: /czekolad[aęy]\s*(mlecz|biał)/i, gi: 44, source: 'milk chocolate' },
  { pattern: /\bczekolad/i, gi: 42, source: 'chocolate avg' },
  { pattern: /dżem|jam/i, gi: 51, source: 'jam' },

  // ═══ NAPOJE / BEVERAGES ═══
  { pattern: /mleko\s*kokos/i, gi: 40, source: 'coconut milk' },
  { pattern: /mleko\s*(migdał|owsi|ryżow|sojow)/i, gi: 30, source: 'plant milk avg' },
  { pattern: /cola|pepsi/i, gi: 63, source: 'cola' },

  // ═══ PRODUKTY GOTOWE / PREPARED ═══
  { pattern: /pizza/i, gi: 60, source: 'pizza' },
  { pattern: /fryt[ck]|fries/i, gi: 63, source: 'french fries' },
  { pattern: /naleśnik|pancake|crepe/i, gi: 66, source: 'pancakes' },
  { pattern: /wafel|waffle/i, gi: 76, source: 'waffles' },

  // ═══ BIAŁKO / PROTEIN (GI nie dotyczy — 0) ═══
  { pattern: /kurczak|indyk|drob|pierś|udko|skrzydełk|chicken|turkey/i, gi: 0, source: 'poultry (no carbs)' },
  { pattern: /wołowin|cielęc|beef|steak/i, gi: 0, source: 'beef (no carbs)' },
  { pattern: /wieprzow|szynk[aię]|schab|boczek|pork/i, gi: 0, source: 'pork (no carbs)' },
  { pattern: /łosoś|dorsz|tuńczyk|pstrąg|makrela|śledź|ryb[aęy]|salmon|cod|tuna|trout/i, gi: 0, source: 'fish (no carbs)' },
  { pattern: /krewet|małż|ośmiornic|kalmary|shrimp|prawn/i, gi: 0, source: 'seafood (no carbs)' },

  // ═══ JAJKA ═══
  { pattern: /jaj[koe]|egg/i, gi: 0, source: 'eggs (no carbs)' },

  // ═══ TŁUSZCZE / FATS ═══
  { pattern: /oliw[aęy]|olej|oil|smalec|lard/i, gi: 0, source: 'fats/oils (no carbs)' },

  // ═══ PRZYPRAWY / SPICES ═══
  { pattern: /sól\b|salt|pieprz|pepper\b|oregano|bazylia|tymianek|curry|kurkum|papryk.*mielon|cynammon|cynamon|imbir|gałk.*muszkat/i, gi: 0, source: 'spices (negligible carbs)' },
  { pattern: /proszek\s*do\s*piecz|soda\s*oczyszcz/i, gi: 0, source: 'baking powder (no carbs)' },
  { pattern: /drożdż/i, gi: 0, source: 'yeast (no carbs)' },
  { pattern: /sos\s*sojow|soy\s*sauce/i, gi: 0, source: 'soy sauce (negligible)' },
  { pattern: /ocet|vinegar/i, gi: 0, source: 'vinegar' },
  { pattern: /majone|mayo/i, gi: 0, source: 'mayonnaise (fat-based)' },
  { pattern: /musztard|mustard/i, gi: 0, source: 'mustard' },
  { pattern: /ketchup/i, gi: 55, source: 'ketchup (sugar)' },
];

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== GI Data Import ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  // 1. Load all CleanProducts used in recipes (priority) + all others
  const products = await prisma.cleanProduct.findMany({
    where: { glycemicIndex: null },
    select: {
      id: true,
      name: true,
      nameEn: true,
      category: true,
      nutrients: { select: { carbsPer100g: true } },
    },
  });

  console.log(`Products with NULL glycemicIndex: ${products.length}`);

  let matched = 0;
  let unmatched = 0;
  const updates: Array<{ id: string; name: string; gi: number; gl: number | null; source: string }> = [];

  for (const product of products) {
    // Match on Polish name only — nameEn has known mapping errors
    const text = product.name;
    let found = false;

    for (const entry of GI_TABLE) {
      if (entry.pattern.test(text)) {
        const carbsPer100g = product.nutrients?.carbsPer100g
          ? Number(product.nutrients.carbsPer100g)
          : null;
        const gl = (carbsPer100g != null && entry.gi > 0)
          ? Math.round((entry.gi / 100) * carbsPer100g * 10) / 10
          : null;

        updates.push({
          id: product.id,
          name: product.name,
          gi: entry.gi,
          gl,
          source: entry.source,
        });
        matched++;
        found = true;
        break;  // first match wins (most specific patterns first)
      }
    }
    if (!found) {
      unmatched++;
    }
  }

  console.log(`Matched: ${matched} / ${products.length} (${(matched / products.length * 100).toFixed(1)}%)`);
  console.log(`Unmatched: ${unmatched}`);

  // Show sample matches
  console.log('\n--- Sample matches (first 20) ---');
  for (const u of updates.slice(0, 20)) {
    console.log(`  GI=${String(u.gi).padStart(3)} GL=${String(u.gl ?? '-').padStart(5)}  ${u.name.padEnd(35)} ← ${u.source}`);
  }

  // Show distribution
  const giRanges = { low: 0, medium: 0, high: 0, zero: 0 };
  for (const u of updates) {
    if (u.gi === 0) giRanges.zero++;
    else if (u.gi <= 55) giRanges.low++;
    else if (u.gi <= 69) giRanges.medium++;
    else giRanges.high++;
  }
  console.log(`\n--- GI Distribution ---`);
  console.log(`  GI=0 (no carbs):    ${giRanges.zero}`);
  console.log(`  Low (1-55):         ${giRanges.low}`);
  console.log(`  Medium (56-69):     ${giRanges.medium}`);
  console.log(`  High (70+):         ${giRanges.high}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes made. Remove --dry-run to apply.\n');
    return;
  }

  // 2. Apply updates in batches
  console.log(`\nApplying ${updates.length} updates...`);
  let applied = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((u) =>
        prisma.cleanProduct.update({
          where: { id: u.id },
          data: {
            glycemicIndex: u.gi,
            glycemicLoadPer100g: u.gl,
          },
        }),
      ),
    );
    applied += batch.length;
    if (applied % 500 === 0 || applied === updates.length) {
      console.log(`  ${applied} / ${updates.length} updated`);
    }
  }

  console.log(`\nDone! Updated ${applied} products.\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
