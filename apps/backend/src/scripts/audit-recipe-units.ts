/**
 * Faza E.1 + E.3 — Audit + backfill recipe unit conventions.
 *
 * Discovers which recipes likely use:
 *   PER_PIECE  — kcal/serving = kcal per single piece (1 naleśnik, 1 placek)
 *   PER_100G   — kcal/serving = kcal per 100g (zupy, sosy, napoje)
 *   PER_PORTION — kcal/serving = kcal per realna porcja (default)
 *
 * Output 7 buckets (apply mode handles each differently):
 *   PER_PIECE_HIGH    → auto-apply servingType=PER_PIECE
 *   PER_100G_HIGH     → auto-apply servingType=PER_100G
 *   PER_PIECE_MEDIUM  → DataQualityIssue (RECIPE_SUSPECTED_UNIT_MISMATCH)
 *   PER_100G_MEDIUM   → DataQualityIssue (RECIPE_SUSPECTED_UNIT_MISMATCH)
 *   SCALE_BUG_SUSPECT → DataQualityIssue (RECIPE_SCALE_BUG_SUSPECT) — Faza F
 *   UNCLEAR           → DataQualityIssue (RECIPE_UNIT_UNCLEAR)
 *   PER_PORTION_OK    → no action (default already correct)
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/audit-recipe-units.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/audit-recipe-units.ts --apply
 */

import { prisma } from '@db';
import { normalizeProductName } from '../scraper/utils/productMatcher';

const APPLY = process.argv.includes('--apply');

// Patterns operate on normalizeProductName output (lowercase, ASCII).
// PER_PIECE indicators — countable units typically prepared in batches of 4-12+
const PIECE_TITLE_RE = /\b(nalesnik|nalesniki|placek|placki|placuszki|placuszek|kotlet|kotlecik|kotleciki|kuleczk|babeczk|babeczki|muffin|muffiny|muffinki|pulpet|pulpety|pulpecik|pyza|pyzy|pierog|pierogi|krokiet|krokieciki|tortill|tortilla|wafel|wafelk|biszkopcik|gofr|gofry|faworki|racuch|racuchy|racuszek|racuszki|rogalik|rogaliki|drozdzowk|bulk|bulka|bulki|bulecz|bulecz|blin|bliny|grzanka|grzanki|naleski|naleski|kuleczk|kotlety|kebab|burger|burgery|paszteciki|pasztecik|kanapka|kanapki|tost|tosty|paninka|paninki|hamburger|hamburgery|kuleczki|szyszki|szaszlyk|szaszlyki|piernik|pierniki|cookie|cookies|kuleczka)\w*/;

// PER_100G indicators — strictly soups, creams, sauces, beverages.
// NOTE: gulasz/bigos/leczo/kisiel intentionally EXCLUDED — those are
// MAIN_DISH/DESSERT, not per-100g items (they got flagged as MEDIUM in
// first pass but are clearly portion-based).
const HUNDRED_G_TITLE_RE = /^(zupa|zupy|krem\s+z|krem\s+pomidor|krem\s+brokul|krem\s+dyni|krem\s+cebul|krem\s+pieczark|krem\s+kalafior|krem\s+szpinak|krem\s+por|krem\s+fasol|krem\s+warzyw|krem\s+groch|krem\s+kasza|krem\s+sel|sos\b|sosy|smoothie|koktajl|koktail|napoj|napój|herbat|napar|kompot|lemoniada|bulion|wywar|barszcz|chłodnik|chlodnik|krupnik)\w*/;

// Title indicators that strongly imply NOT a piece/100g (e.g. salads, casseroles)
const STRONG_PORTION_RE = /\b(salatka|salatki|sałatka|surowka|kasza|risotto|leczo|bigos|paella|lasagna|musaka|moussaka|chili|tagine|stroganoff|zapiekanka|gulasz)\w*/;

interface RecipeRow {
  id: string;
  title: string;
  mealType: string;
  servings: number;
  kcalPerServing: number | null;
  totalKcal: number | null;
}

type Bucket =
  | 'PER_PIECE_HIGH'      // confident piece-based (auto-apply)
  | 'PER_PIECE_MEDIUM'    // piece keyword but ambiguous servings (review)
  | 'PER_100G_HIGH'       // confident per-100g (auto-apply)
  | 'PER_100G_MEDIUM'     // soup/sauce keyword but ambiguous kcal (review)
  | 'SCALE_BUG_SUSPECT'   // probable servings bug — separate fix in Faza F
  | 'UNCLEAR'             // low kcal, no clear signal
  | 'PER_PORTION_OK';     // default, normal range

interface Result extends RecipeRow {
  normalized: string;
  bucket: Bucket;
  reason: string;
}

const FULL_MEAL_TYPES = new Set(['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'DINNER', 'SUPPER']);

// Meat-heavy keywords — when title indicates meat protein and servings ≥ 10,
// it's almost certainly a SCALE_BUG (1 kg of pork is not 20 portions).
const MEAT_RE = /\b(schab|karkowk|kurczak|wolowin|woloin|polywdwicz|polędwicz|wieprzow|kaczk|indyk|baran|jagniec|losos|rylybna|mintaj|dorsz|pstrag|tunczyk|miecznik|sandacz|łopatk|lopatk|stek|stekow|kotleci\s+schab|zeber|żeber|pulled|gicz|udziec|cielęc|cielec|cielęcin)\w*/;

function classify(r: RecipeRow): { bucket: Bucket; reason: string } {
  const t = normalizeProductName(r.title);
  const kcal = r.kcalPerServing;
  const servings = r.servings;
  const totalKcal = kcal != null ? kcal * servings : 0;

  // 1. PER_100G — only if soup/sauce/drink keyword AND kcal/p < 200
  //    (kcal/100g of soup is typically 30-150; > 200 means PER_PORTION)
  if (HUNDRED_G_TITLE_RE.test(t)) {
    if (kcal != null && kcal > 0 && kcal < 200) {
      return { bucket: 'PER_100G_HIGH', reason: `soup-sauce-drink + kcal/p=${Math.round(kcal)}` };
    }
    if (kcal != null && kcal >= 200 && kcal < 400) {
      return { bucket: 'PER_100G_MEDIUM', reason: `soup keyword but kcal/p=${Math.round(kcal)} (might be PER_PORTION)` };
    }
    // kcal/p ≥ 400 with soup keyword → almost certainly PER_PORTION
    return { bucket: 'PER_PORTION_OK', reason: `soup-keyword but kcal/p=${Math.round(kcal ?? 0)} → portion-sized` };
  }

  // 2. PER_PIECE_HIGH — title+piece + (servings ≥ 6 AND total_kcal ≥ 1500)
  //    OR (servings ≥ 4 AND kcal/p < 200) — typical naleśnik/pierog/kotlet jajeczny
  if (PIECE_TITLE_RE.test(t)) {
    if (servings >= 6 && totalKcal >= 1500) {
      return { bucket: 'PER_PIECE_HIGH', reason: `piece + servings=${servings} + total=${Math.round(totalKcal)}kcal` };
    }
    if (servings >= 4 && kcal != null && kcal > 0 && kcal < 200) {
      return { bucket: 'PER_PIECE_HIGH', reason: `piece + servings=${servings} + low kcal/p=${Math.round(kcal)}` };
    }
    // Servings 3-5 with kcal/p ≥ 200 — ambiguous (could be 4 pieces or 4 portions)
    if (servings >= 3 && servings <= 5) {
      return { bucket: 'PER_PIECE_MEDIUM', reason: `piece keyword + ambiguous servings=${servings}` };
    }
    if (servings === 1 || servings === 2) {
      return { bucket: 'PER_PORTION_OK', reason: `piece keyword but servings=${servings} → PER_PORTION` };
    }
  }

  // 3. SCALE_BUG_SUSPECT — meat title + many servings + low kcal/p
  //    (clear indicator that servings is wrong, not unit-type issue)
  if (MEAT_RE.test(t) && servings >= 10 && kcal != null && kcal > 0 && kcal < 200) {
    return { bucket: 'SCALE_BUG_SUSPECT', reason: `meat + servings=${servings} + low kcal/p=${Math.round(kcal)} → servings bug` };
  }

  // 4. Strong portion indicator (sałatka, kasza, risotto) → PER_PORTION
  //    Even if low kcal — these are full meals or sides, not pieces or per-100g
  if (STRONG_PORTION_RE.test(t)) {
    if (kcal != null && kcal < 100 && servings >= 10) {
      return { bucket: 'SCALE_BUG_SUSPECT', reason: `portion-keyword + servings=${servings} + low kcal → servings bug` };
    }
    return { bucket: 'PER_PORTION_OK', reason: 'strong-portion-keyword' };
  }

  // 5. Low kcal in main meal slot, no other signal — likely scale bug
  if (kcal != null && kcal > 0 && kcal < 200 && FULL_MEAL_TYPES.has(r.mealType) && servings >= 5) {
    return { bucket: 'SCALE_BUG_SUSPECT', reason: `low kcal/p=${Math.round(kcal)} + servings=${servings} in ${r.mealType}` };
  }

  // 6. No nutrition data
  if (kcal == null || kcal === 0) {
    return { bucket: 'UNCLEAR', reason: 'no kcal data' };
  }

  // 7. Low kcal generally — unclear, leave for manual review
  if (kcal < 100) {
    return { bucket: 'UNCLEAR', reason: `low kcal=${Math.round(kcal)}, no signal` };
  }

  // 8. Default — normal range
  return { bucket: 'PER_PORTION_OK', reason: 'normal kcal range' };
}

async function main() {
  console.log('\n=== Faza E.1 — Recipe unit-convention audit (read-only) ===\n');

  const recipes = await prisma.recipe.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      mealType: true,
      servings: true,
      nutritionSnapshot: { select: { kcal: true, totalKcal: true } },
    },
  });

  const rows: RecipeRow[] = recipes.map((r) => ({
    id: r.id,
    title: r.title,
    mealType: r.mealType,
    servings: r.servings,
    kcalPerServing: r.nutritionSnapshot ? Number(r.nutritionSnapshot.kcal) : null,
    totalKcal: r.nutritionSnapshot?.totalKcal ? Number(r.nutritionSnapshot.totalKcal) : null,
  }));

  const results: Result[] = rows.map((r) => {
    const cls = classify(r);
    return {
      ...r,
      normalized: normalizeProductName(r.title),
      bucket: cls.bucket,
      reason: cls.reason,
    };
  });

  console.log(`Total active recipes: ${rows.length}\n`);

  // ─── Distribution by bucket ─────────────────────────────────────────────
  console.log('--- Distribution by bucket ---');
  const bucketHist = new Map<string, number>();
  for (const r of results) bucketHist.set(r.bucket, (bucketHist.get(r.bucket) ?? 0) + 1);
  for (const [k, n] of [...bucketHist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} → ${n}`);
  }

  // ─── PER_PIECE_HIGH samples ─────────────────────────────────────────────
  const pieceHigh = results.filter((r) => r.bucket === 'PER_PIECE_HIGH');
  console.log(`\n--- PER_PIECE_HIGH (${pieceHigh.length}, sample 25) ---`);
  for (const r of pieceHigh.slice(0, 25)) {
    const kcalStr = r.kcalPerServing != null ? `${Math.round(r.kcalPerServing)} kcal` : 'no kcal';
    console.log(`  [${r.mealType.padEnd(10)} | ${String(r.servings).padStart(2)}× ${kcalStr.padStart(11)}/p]  ${r.title}`);
  }

  // ─── PER_PIECE_MEDIUM samples ───────────────────────────────────────────
  const pieceMed = results.filter((r) => r.bucket === 'PER_PIECE_MEDIUM');
  console.log(`\n--- PER_PIECE_MEDIUM (${pieceMed.length}, sample 15) ---`);
  for (const r of pieceMed.slice(0, 15)) {
    const kcalStr = r.kcalPerServing != null ? `${Math.round(r.kcalPerServing)} kcal` : 'no kcal';
    console.log(`  [${r.mealType.padEnd(10)} | ${String(r.servings).padStart(2)}× ${kcalStr.padStart(11)}/p]  ${r.title}`);
  }

  // ─── PER_100G_HIGH samples ──────────────────────────────────────────────
  const hundredHigh = results.filter((r) => r.bucket === 'PER_100G_HIGH');
  console.log(`\n--- PER_100G_HIGH (${hundredHigh.length}, sample 25) ---`);
  for (const r of hundredHigh.slice(0, 25)) {
    const kcalStr = r.kcalPerServing != null ? `${Math.round(r.kcalPerServing)} kcal` : 'no kcal';
    console.log(`  [${r.mealType.padEnd(10)} | ${String(r.servings).padStart(2)}× ${kcalStr.padStart(11)}/p]  ${r.title}`);
  }

  // ─── PER_100G_MEDIUM samples ────────────────────────────────────────────
  const hundredMed = results.filter((r) => r.bucket === 'PER_100G_MEDIUM');
  console.log(`\n--- PER_100G_MEDIUM (${hundredMed.length}, sample 15) ---`);
  for (const r of hundredMed.slice(0, 15)) {
    const kcalStr = r.kcalPerServing != null ? `${Math.round(r.kcalPerServing)} kcal` : 'no kcal';
    console.log(`  [${r.mealType.padEnd(10)} | ${String(r.servings).padStart(2)}× ${kcalStr.padStart(11)}/p]  ${r.title}`);
  }

  // ─── UNCLEAR samples ────────────────────────────────────────────────────
  const unclear = results.filter((r) => r.bucket === 'UNCLEAR');
  console.log(`\n--- UNCLEAR (${unclear.length}, sample 25) ---`);
  for (const r of unclear.slice(0, 25)) {
    const kcalStr = r.kcalPerServing != null ? `${Math.round(r.kcalPerServing)} kcal` : 'no kcal';
    console.log(`  [${r.mealType.padEnd(10)} | ${String(r.servings).padStart(2)}× ${kcalStr.padStart(11)}/p ${r.reason}]  ${r.title}`);
  }

  // ─── Cross-sanity: PER_PIECE_HIGH × servings histogram ─────────────────
  console.log('\n--- PER_PIECE_HIGH × servings distribution ---');
  const sHist = new Map<number, number>();
  for (const r of pieceHigh) sHist.set(r.servings, (sHist.get(r.servings) ?? 0) + 1);
  for (const [s, n] of [...sHist.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  servings=${String(s).padStart(2)} → ${n}`);
  }

  // ─── Cross-sanity: PER_100G_HIGH × kcal histogram ──────────────────────
  console.log('\n--- PER_100G_HIGH × kcal/p bucket histogram ---');
  const kBuckets = new Map<string, number>();
  for (const r of hundredHigh) {
    const k = r.kcalPerServing ?? 0;
    const bucket = k < 50 ? '<50'
      : k < 100 ? '50-100'
      : k < 200 ? '100-200'
      : '200+';
    kBuckets.set(bucket, (kBuckets.get(bucket) ?? 0) + 1);
  }
  for (const [k, n] of [...kBuckets.entries()]) {
    console.log(`  ${k.padEnd(10)} → ${n}`);
  }

  // ─── SCALE_BUG_SUSPECT preview ─────────────────────────────────────────
  const scaleBug = results.filter((r) => r.bucket === 'SCALE_BUG_SUSPECT');
  console.log(`\n--- SCALE_BUG_SUSPECT (${scaleBug.length}, sample 15) — separate fix in Faza F ---`);
  for (const r of scaleBug.slice(0, 15)) {
    const kcalStr = r.kcalPerServing != null ? `${Math.round(r.kcalPerServing)} kcal` : 'no kcal';
    const total = r.totalKcal != null ? ` total=${Math.round(r.totalKcal)}` : '';
    console.log(`  [${r.mealType.padEnd(10)} | ${String(r.servings).padStart(2)}× ${kcalStr.padStart(11)}/p${total}]  ${r.title}`);
  }

  if (!APPLY) {
    console.log('\n(read-only mode — pass --apply to write servingType + DataQualityIssue rows)\n');
    console.log('=== End of audit ===\n');
    return;
  }

  // ─── Apply ──────────────────────────────────────────────────────────────
  console.log('\n=== Applying writes ===\n');

  // 1. HIGH-confidence: write servingType + AuditLog
  let highApplied = 0;
  for (const r of pieceHigh) {
    await prisma.$transaction([
      prisma.recipe.update({
        where: { id: r.id },
        data: { servingType: 'PER_PIECE' },
      }),
      prisma.auditLog.create({
        data: {
          action: 'BACKFILL_SERVING_TYPE',
          resourceType: 'RECIPE',
          resourceId: r.id,
          metadata: {
            servingType: 'PER_PIECE',
            reason: r.reason,
            title: r.title,
            servings: r.servings,
            kcalPerServing: r.kcalPerServing,
          },
        },
      }),
    ]);
    highApplied++;
  }
  for (const r of hundredHigh) {
    await prisma.$transaction([
      prisma.recipe.update({
        where: { id: r.id },
        data: { servingType: 'PER_100G' },
      }),
      prisma.auditLog.create({
        data: {
          action: 'BACKFILL_SERVING_TYPE',
          resourceType: 'RECIPE',
          resourceId: r.id,
          metadata: {
            servingType: 'PER_100G',
            reason: r.reason,
            title: r.title,
            servings: r.servings,
            kcalPerServing: r.kcalPerServing,
          },
        },
      }),
    ]);
    highApplied++;
  }
  console.log(`Auto-applied servingType for ${highApplied} HIGH-confidence recipes (PER_PIECE: ${pieceHigh.length}, PER_100G: ${hundredHigh.length}).`);

  // 2. MEDIUM + UNCLEAR + SCALE_BUG: write DataQualityIssue (skip duplicates)
  type IssueRow = { entityId: string; field: string; severity: 'WARNING' | 'ERROR'; issueCode: string; description: string; suggestedFix: string };
  const issues: IssueRow[] = [];

  for (const r of pieceMed) {
    issues.push({
      entityId: r.id,
      field: 'servingType',
      severity: 'WARNING',
      issueCode: 'RECIPE_SUSPECTED_UNIT_MISMATCH',
      description: `"${r.title}" — ${r.servings}× ${Math.round(r.kcalPerServing ?? 0)} kcal/p. Słowo kluczowe sugeruje sztuki (PER_PIECE) ale liczba porcji niepewna.`,
      suggestedFix: 'Sprawdź czy servings to liczba sztuk czy talerzy; ustaw servingType ręcznie w admin UI',
    });
  }
  for (const r of hundredMed) {
    issues.push({
      entityId: r.id,
      field: 'servingType',
      severity: 'WARNING',
      issueCode: 'RECIPE_SUSPECTED_UNIT_MISMATCH',
      description: `"${r.title}" — ${r.servings}× ${Math.round(r.kcalPerServing ?? 0)} kcal/p. Tytuł sugeruje zupę/sos (PER_100G) ale kcal/p może oznaczać porcję.`,
      suggestedFix: 'Sprawdź czy kcal jest na 100g czy na porcję; ustaw servingType ręcznie',
    });
  }
  for (const r of scaleBug) {
    issues.push({
      entityId: r.id,
      field: 'servings',
      severity: 'ERROR',
      issueCode: 'RECIPE_SCALE_BUG_SUSPECT',
      description: `"${r.title}" — ${r.servings}× ${Math.round(r.kcalPerServing ?? 0)} kcal/p. Prawdopodobnie błąd w servings (mięso/danie nie powinno być na ${r.servings} porcji).`,
      suggestedFix: 'Skoryguj servings (typowo 1-6 dla obiadów); to NIE problem servingType',
    });
  }
  for (const r of unclear) {
    issues.push({
      entityId: r.id,
      field: 'servingType',
      severity: 'INFO' as 'WARNING',
      issueCode: 'RECIPE_UNIT_UNCLEAR',
      description: `"${r.title}" — ${r.reason}. Brak jednoznacznego sygnału jednostki.`,
      suggestedFix: 'Manual review w admin UI — ustaw servingType lub popraw kcal/servings',
    });
  }

  if (issues.length > 0) {
    // Skip duplicates (entityId + issueCode pair already in unresolved queue)
    const existing = await prisma.dataQualityIssue.findMany({
      where: {
        entityType: 'Recipe',
        issueCode: { in: ['RECIPE_SUSPECTED_UNIT_MISMATCH', 'RECIPE_SCALE_BUG_SUSPECT', 'RECIPE_UNIT_UNCLEAR'] },
        isResolved: false,
        entityId: { in: issues.map((i) => i.entityId) },
      },
      select: { entityId: true, issueCode: true },
    });
    const existingSet = new Set(existing.map((e) => `${e.entityId}:${e.issueCode}`));
    const toCreate = issues.filter((i) => !existingSet.has(`${i.entityId}:${i.issueCode}`));

    if (toCreate.length > 0) {
      const BATCH = 50;
      let written = 0;
      for (let i = 0; i < toCreate.length; i += BATCH) {
        const batch = toCreate.slice(i, i + BATCH);
        await prisma.dataQualityIssue.createMany({
          data: batch.map((issue) => ({
            entityType: 'Recipe',
            entityId: issue.entityId,
            field: issue.field,
            severity: issue.severity,
            issueCode: issue.issueCode,
            description: issue.description,
            suggestedFix: issue.suggestedFix,
            isResolved: false,
          })),
        });
        written += batch.length;
      }
      console.log(`Wrote ${written} new DataQualityIssue rows (${issues.length - toCreate.length} skipped as duplicates).`);
    } else {
      console.log(`All ${issues.length} issues already in queue.`);
    }
  }

  console.log('\n=== Done ===\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
