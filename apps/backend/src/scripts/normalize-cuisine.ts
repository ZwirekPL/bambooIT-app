/**
 * Z4 — Normalise Recipe.cuisineType.
 *
 * Brings every active recipe in line with the 9-value canonical PL set used
 * by `apps/backend/src/utils/cuisineMapping.ts`:
 *
 *   polska · włoska · azjatycka · śródziemnomorska · meksykańska ·
 *   indyjska · amerykańska · francuska · inna
 *
 * (The legacy `uniwersalna` neutral marker was dropped in P0.3 — Recipe
 * Overhaul Master Plan 2026-04-29 — and is now blocked by a CHECK constraint.)
 *
 * Three operations, each idempotent:
 *
 *   1. LEGACY_TYPOS — diacritic-stripped variants slipped in from older
 *      imports. Map straight to their canonical counterpart.
 *        wloska            -> włoska
 *        srodziemnomorska  -> śródziemnomorska
 *
 *   2. OUT_OF_CANONICAL — values outside the 9-set. Only `hiszpańska`
 *      currently appears (2 records); since "Mediterranean diet" clinically
 *      includes Spain, fold it into `śródziemnomorska`.
 *
 *   3. NULL_QUEUE — write a DataQualityIssue per active recipe whose
 *      cuisineType is NULL, with code RECIPE_CUISINE_MISSING and severity
 *      WARNING. Skips already-open issues so re-running is safe.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register \
 *       apps/backend/src/scripts/normalize-cuisine.ts            (dry run)
 *   npx ts-node -r tsconfig-paths/register \
 *       apps/backend/src/scripts/normalize-cuisine.ts --apply
 */

import { prisma } from '@db';

const APPLY = process.argv.includes('--apply');
const BATCH_ID = '2026-04-28-cuisine-normalize';

// Canonical 9-value set. P0.3 dropped 'uniwersalna' — DB CHECK constraint
// blocks writes; any stray legacy value gets warned by the loop below.
const CANONICAL = new Set<string>([
  'polska', 'włoska', 'azjatycka', 'śródziemnomorska', 'meksykańska',
  'indyjska', 'amerykańska', 'francuska', 'inna',
]);

// Legacy typo / out-of-canonical → canonical reclassification map.
// All keys ARE the literal DB strings (already lowercase / specific
// diacritic-stripped form).
const RECLASSIFY: Record<string, string> = {
  // Legacy typos — diacritic-stripped form leaked from older imports.
  'wloska': 'włoska',
  'srodziemnomorska': 'śródziemnomorska',
  // Out-of-canonical: Spain is part of the Mediterranean dietary pattern.
  'hiszpańska': 'śródziemnomorska',
};

interface Reclassify {
  id: string;
  title: string;
  from: string;
  to: string;
  reason: string;
}
interface NullQueue {
  id: string;
  title: string;
  mealType: string;
}

async function scan(): Promise<{ reclassify: Reclassify[]; nulls: NullQueue[] }> {
  const recipes = await prisma.recipe.findMany({
    where: { isActive: true },
    select: { id: true, title: true, cuisineType: true, mealType: true },
  });

  const reclassify: Reclassify[] = [];
  const nulls: NullQueue[] = [];

  for (const r of recipes) {
    if (r.cuisineType === null || r.cuisineType === '') {
      nulls.push({ id: r.id, title: r.title, mealType: r.mealType });
      continue;
    }

    const target = RECLASSIFY[r.cuisineType];
    if (target && target !== r.cuisineType) {
      reclassify.push({
        id: r.id,
        title: r.title,
        from: r.cuisineType,
        to: target,
        reason: r.cuisineType in RECLASSIFY && r.cuisineType.includes('hiszpa') ? 'out-of-canonical' : 'legacy-typo',
      });
      continue;
    }

    // Anything else outside CANONICAL but not in RECLASSIFY → flag for
    // future review so we notice if a new value sneaks in.
    if (!CANONICAL.has(r.cuisineType)) {
      console.warn(`  [WARN] Unknown cuisineType "${r.cuisineType}" on recipe ${r.id} (${r.title}) — not handled`);
    }
  }

  return { reclassify, nulls };
}

async function applyReclassify(rows: Reclassify[]): Promise<number> {
  let updated = 0;
  for (const r of rows) {
    await prisma.$transaction([
      prisma.recipe.update({
        where: { id: r.id },
        data: { cuisineType: r.to },
      }),
      prisma.auditLog.create({
        data: {
          action: 'NORMALIZE_CUISINE',
          resourceType: 'RECIPE',
          resourceId: r.id,
          metadata: {
            from: r.from,
            to: r.to,
            reason: r.reason,
            title: r.title,
            batchId: BATCH_ID,
          },
        },
      }),
    ]);
    updated++;
  }
  return updated;
}

async function applyNullQueue(rows: NullQueue[]): Promise<number> {
  if (rows.length === 0) return 0;

  const existing = await prisma.dataQualityIssue.findMany({
    where: {
      entityType: 'Recipe',
      issueCode: 'RECIPE_CUISINE_MISSING',
      isResolved: false,
      entityId: { in: rows.map((r) => r.id) },
    },
    select: { entityId: true },
  });
  const existingIds = new Set(existing.map((e) => e.entityId));
  const toCreate = rows.filter((r) => !existingIds.has(r.id));
  if (toCreate.length === 0) return 0;

  await prisma.dataQualityIssue.createMany({
    data: toCreate.map((r) => ({
      entityType: 'Recipe',
      entityId: r.id,
      field: 'cuisineType',
      severity: 'WARNING',
      issueCode: 'RECIPE_CUISINE_MISSING',
      description: `"${r.title}" — brak cuisineType. Solver SC22 (cuisine cohesion) potraktuje jako neutral. Dodaj wartość zgodnie z canonical: polska / włoska / azjatycka / śródziemnomorska / meksykańska / indyjska / amerykańska / francuska / inna.`,
      suggestedFix: 'Wybierz najbliższą kuchnię z listy 9 wartości; dla dań bez wyraźnej przynależności kulturowej (owsianka, jogurt z bakaliami, sałatka owocowa) użyj "inna".',
      isResolved: false,
    })),
  });

  return toCreate.length;
}

async function main(): Promise<void> {
  console.log('\n=== Z4 — cuisineType normalize ===');
  console.log(`Mode: ${APPLY ? 'LIVE (writes)' : 'DRY RUN'}`);
  console.log(`Batch ID: ${BATCH_ID}\n`);

  const { reclassify, nulls } = await scan();

  console.log(`Reclassify: ${reclassify.length}`);
  for (const r of reclassify) {
    console.log(`  ${r.title.padEnd(45)} ${r.from} → ${r.to}  (${r.reason})`);
  }

  console.log(`\nNULL queue (RECIPE_CUISINE_MISSING): ${nulls.length}`);
  for (const r of nulls.slice(0, 30)) {
    console.log(`  [${r.mealType.padEnd(8)}] ${r.title}`);
  }
  if (nulls.length > 30) console.log(`  ... +${nulls.length - 30} more`);

  if (!APPLY) {
    console.log('\n(dry-run — pass --apply to write)\n');
    return;
  }

  console.log('\nApplying reclassifications...');
  const reclassified = await applyReclassify(reclassify);
  console.log(`Reclassified ${reclassified} recipe(s).`);

  console.log('\nWriting NULL review queue entries...');
  const queued = await applyNullQueue(nulls);
  console.log(`Wrote ${queued} new RECIPE_CUISINE_MISSING issue(s).\n`);

  console.log('Done.\n');
}

main()
  .catch((err) => { console.error('FAILED:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
