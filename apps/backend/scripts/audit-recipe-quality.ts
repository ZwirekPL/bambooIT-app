/**
 * Run the S-3 Pre-flight Quality Gate retrospectively against every DB Recipe.
 *
 * Use to:
 *   - See what the gate would accept/review/reject on the current corpus.
 *   - Spot systematic REQUIRED misses per source domain (e.g. lots of recipes
 *     with no nutrition snapshot).
 *   - Identify candidates for removal or re-scrape.
 *
 * Read-only.
 *
 * Usage:
 *   npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/audit-recipe-quality.ts
 *   npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/audit-recipe-quality.ts --show-rejects
 */

import 'dotenv/config';
import { prisma } from '@db';
import {
  evaluateRecipeQuality,
  type QualityInput,
  type QualityDecision,
} from '../src/scraper/utils/qualityGate';

const args = process.argv.slice(2);
const SHOW_REJECTS = args.includes('--show-rejects');
const LIMIT = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : 0;

function domainOf(url: string | null | undefined): string {
  if (!url) return 'no-url';
  if (url.includes('aniagotuje.pl')) return 'aniagotuje';
  if (url.includes('kwestiasmaku.com')) return 'kwestiasmaku';
  if (url.includes('jadlonomia.com')) return 'jadlonomia';
  if (url.includes('dietetykpowszechny.pl')) return 'dietetykpowszechny';
  if (url.includes('paleosmak.pl')) return 'paleosmak';
  return 'other';
}

function decimalToNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface DomainStats {
  total: number;
  auto: number;
  review: number;
  reject: number;
  rejectReasons: Record<string, number>;
}

function emptyStats(): DomainStats {
  return { total: 0, auto: 0, review: 0, reject: 0, rejectReasons: {} };
}

async function main() {
  console.log('=== S-3 Pre-flight Quality Gate — retrospective DB audit ===');
  console.log(`show-rejects: ${SHOW_REJECTS}`);

  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      sourceUrl: true,
      servings: true,
      servingWeightG: true,
      yieldWeightG: true,
      prepTimeMinutes: true,
      cookTimeMinutes: true,
      totalTimeMinutes: true,
      imageUrl: true,
      averageRating: true,
      ratingCount: true,
      category: true,
      cuisineType: true,
      tags: true,
      ingredients: { select: { id: true } },
      instructionSteps: { select: { instruction: true } },
      nutritionSnapshot: {
        select: {
          kcal: true,
          protein_g: true,
          fat_g: true,
          carbs_g: true,
          fiber_g: true,
          sugars_g: true,
          sodium_mg: true,
          cholesterol_mg: true,
        },
      },
    },
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
  });

  console.log(`Loaded ${recipes.length} recipes.\n`);

  const perDomain: Record<string, DomainStats> = {};
  const allReports: Array<{
    id: string;
    title: string;
    domain: string;
    decision: QualityDecision;
    score: number;
    reasons: string;
  }> = [];

  for (const r of recipes) {
    const domain = domainOf(r.sourceUrl);
    if (!perDomain[domain]) perDomain[domain] = emptyStats();

    const input: QualityInput = {
      title: r.title,
      description: r.description,
      ingredients: r.ingredients.map((i) => ({ name: String(i.id) })),
      steps: r.instructionSteps.map((s) => s.instruction),
      servings: r.servings,
      servingWeightG: decimalToNumber(r.servingWeightG),
      yieldWeightG: decimalToNumber(r.yieldWeightG),
      prepTimeMinutes: r.prepTimeMinutes,
      cookTimeMinutes: r.cookTimeMinutes,
      totalTimeMinutes: r.totalTimeMinutes,
      imageUrl: r.imageUrl,
      rating: decimalToNumber(r.averageRating),
      ratingCount: r.ratingCount,
      category: r.category,
      cuisineType: r.cuisineType,
      tags: r.tags,
      nutrition: r.nutritionSnapshot
        ? {
            calories: decimalToNumber(r.nutritionSnapshot.kcal),
            protein: decimalToNumber(r.nutritionSnapshot.protein_g),
            fat: decimalToNumber(r.nutritionSnapshot.fat_g),
            carbs: decimalToNumber(r.nutritionSnapshot.carbs_g),
            fiber: decimalToNumber(r.nutritionSnapshot.fiber_g),
            sugar: decimalToNumber(r.nutritionSnapshot.sugars_g),
            sodium: decimalToNumber(r.nutritionSnapshot.sodium_mg),
            cholesterol: decimalToNumber(r.nutritionSnapshot.cholesterol_mg),
          }
        : null,
    };

    const report = evaluateRecipeQuality(input);
    const stats = perDomain[domain];
    stats.total++;
    if (report.decision === 'AUTO') stats.auto++;
    else if (report.decision === 'REVIEW') stats.review++;
    else stats.reject++;

    if (report.decision === 'REJECT') {
      const tag = report.missingRequired.length > 0
        ? `missing:${report.missingRequired.map(s => s.split(' ')[0]).join(',')}`
        : report.nonScalableReasons.length > 0
          ? `non_scalable:${report.nonScalableReasons[0].split(' ')[0]}`
          : 'low_score';
      stats.rejectReasons[tag] = (stats.rejectReasons[tag] || 0) + 1;
    }

    if (SHOW_REJECTS && report.decision === 'REJECT') {
      allReports.push({
        id: r.id,
        title: r.title,
        domain,
        decision: report.decision,
        score: report.score,
        reasons: report.summary,
      });
    }
  }

  // Table output
  console.log('Domain              | Total | AUTO  | REVIEW | REJECT | AUTO% | REJECT%');
  console.log('--------------------|-------|-------|--------|--------|-------|--------');
  for (const [domain, s] of Object.entries(perDomain).sort((a, b) => b[1].total - a[1].total)) {
    const autoPct = s.total > 0 ? Math.round((100 * s.auto) / s.total) : 0;
    const rejectPct = s.total > 0 ? Math.round((100 * s.reject) / s.total) : 0;
    console.log(
      `${domain.padEnd(20)}| ${String(s.total).padStart(5)} | ${String(s.auto).padStart(5)} | ${String(s.review).padStart(6)} | ${String(s.reject).padStart(6)} | ${String(autoPct).padStart(4)}% | ${String(rejectPct).padStart(6)}%`
    );
  }

  console.log('\nTop reject reasons per domain:');
  for (const [domain, s] of Object.entries(perDomain).sort((a, b) => b[1].reject - a[1].reject)) {
    if (s.reject === 0) continue;
    const top = Object.entries(s.rejectReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    console.log(`  ${domain}: ${top.map(([r, c]) => `${r}×${c}`).join('  ')}`);
  }

  if (SHOW_REJECTS) {
    console.log(`\nSample rejects (first 20):`);
    for (const rpt of allReports.slice(0, 20)) {
      console.log(`  [${rpt.domain}] ${rpt.title.slice(0, 60)}`);
      console.log(`    ${rpt.reasons}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
