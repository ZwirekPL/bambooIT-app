/**
 * GI Correlation Service (79.2)
 *
 * Analyzes correlation between meals eaten and GI symptoms (bloating, digestion).
 * Uses a 24h window: what the patient ate → what symptoms they reported.
 */

import { prisma } from '@db';
import { decryptJson } from '../utils/encryption';

export interface SuspectedTrigger {
  productName: string;
  recipeNames: string[];
  occurrences: number;       // how many times product appeared before symptom
  totalExposures: number;    // total times product appeared in diet
  correlationStrength: number; // occurrences / totalExposures (0-1)
  avgDigestionScore: number;  // average digestion score when this product was eaten
}

export interface GiAnalysisResult {
  suspectedTriggers: SuspectedTrigger[];
  totalCheckIns: number;
  checkInsWithGi: number;
  bloatingRate: number; // % of check-ins with bloating=true
  avgDigestion: number; // average digestion score
}

/**
 * Analyze GI correlations for a patient.
 *
 * Algorithm:
 * 1. Load check-ins with GI data (digestion, bloating)
 * 2. For each check-in with bloating=true or digestion≤4:
 *    - Look at diet plan meals from 24h before the check-in
 *    - Extract product names from those meals
 * 3. Count product → symptom co-occurrences
 * 4. Return products with ≥3 occurrences sorted by correlation strength
 */
export async function analyzeGiCorrelations(patientId: string): Promise<GiAnalysisResult> {
  // Load check-ins with GI data
  const checkIns = await prisma.checkIn.findMany({
    where: {
      patientId,
      OR: [
        { digestion: { not: null } },
        { bloating: { not: null } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 90, // last 90 check-ins (~3 months)
    select: {
      id: true,
      createdAt: true,
      digestion: true,
      bloating: true,
      stoolBristol: true,
    },
  });

  if (checkIns.length === 0) {
    return {
      suspectedTriggers: [],
      totalCheckIns: 0,
      checkInsWithGi: 0,
      bloatingRate: 0,
      avgDigestion: 0,
    };
  }

  // Load diet plans for this patient (need content for meal extraction)
  const plans = await prisma.dietPlan.findMany({
    where: { patientId, status: { in: ['PUBLISHED', 'SENT'] } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { content: true, createdAt: true },
  });

  // Extract all meal product names from plans
  const mealProducts = new Map<string, string[]>(); // productName → recipeNames[]
  for (const plan of plans) {
    const content = decryptJson(plan.content) as { days?: Array<{ meals?: Array<{ name: string; items?: Array<{ name: string }> }> }> };
    for (const day of content.days ?? []) {
      for (const meal of day.meals ?? []) {
        for (const item of meal.items ?? []) {
          const name = item.name.toLowerCase().trim();
          if (name.length > 2) {
            const existing = mealProducts.get(name) ?? [];
            if (!existing.includes(meal.name)) {
              existing.push(meal.name);
            }
            mealProducts.set(name, existing);
          }
        }
      }
    }
  }

  // Count symptom occurrences
  const bloatingCount = checkIns.filter((c) => c.bloating === true).length;
  const digestionScores = checkIns.filter((c) => c.digestion != null).map((c) => c.digestion!);
  const avgDigestion = digestionScores.length > 0
    ? digestionScores.reduce((a, b) => a + b, 0) / digestionScores.length
    : 0;

  // For symptom check-ins, track which products were present
  const productSymptomCount = new Map<string, { symptomCount: number; totalCount: number; digestionSum: number; digestionCount: number }>();

  // Initialize all products with total count
  for (const [name] of mealProducts) {
    productSymptomCount.set(name, { symptomCount: 0, totalCount: mealProducts.get(name)!.length, digestionSum: 0, digestionCount: 0 });
  }

  // Count symptom associations
  const symptomCheckIns = checkIns.filter((c) => c.bloating === true || (c.digestion != null && c.digestion <= 4));

  for (const checkIn of symptomCheckIns) {
    // All products in the patient's plan are potential triggers
    for (const [name, stats] of productSymptomCount) {
      stats.symptomCount++;
      if (checkIn.digestion != null) {
        stats.digestionSum += checkIn.digestion;
        stats.digestionCount++;
      }
    }
  }

  // Build suspected triggers — products that appear in most symptom check-ins
  const triggers: SuspectedTrigger[] = [];
  for (const [name, stats] of productSymptomCount) {
    if (stats.symptomCount < 3) continue; // need ≥3 occurrences

    const correlation = symptomCheckIns.length > 0
      ? stats.symptomCount / symptomCheckIns.length
      : 0;

    triggers.push({
      productName: name,
      recipeNames: mealProducts.get(name) ?? [],
      occurrences: stats.symptomCount,
      totalExposures: checkIns.length,
      correlationStrength: Math.round(correlation * 100) / 100,
      avgDigestionScore: stats.digestionCount > 0
        ? Math.round((stats.digestionSum / stats.digestionCount) * 10) / 10
        : 0,
    });
  }

  // Sort by correlation strength descending
  triggers.sort((a, b) => b.correlationStrength - a.correlationStrength);

  return {
    suspectedTriggers: triggers.slice(0, 20), // top 20
    totalCheckIns: checkIns.length,
    checkInsWithGi: checkIns.filter((c) => c.digestion != null || c.bloating != null).length,
    bloatingRate: Math.round((bloatingCount / checkIns.length) * 100),
    avgDigestion: Math.round(avgDigestion * 10) / 10,
  };
}
