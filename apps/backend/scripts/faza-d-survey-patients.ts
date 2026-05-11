/**
 * Faza D Phase 0 Task #10 — survey dev DB patients to identify candidates
 * for "real-world wildcard" test fixtures (alongside 8 synthetic D1-D8 personas).
 *
 * Decrypts Interview.answers and prints a per-patient summary. Read-only.
 *
 * Run:
 *   cd apps/backend
 *   npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/faza-d-survey-patients.ts
 */

import { prisma } from '@db';
import { decryptJson } from '../src/utils/encryption';

interface PatientSummary {
  id: string;
  sex: string | null;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  hasInterview: boolean;
  hasNutritionTargets: boolean;
  numDietPlans: number;
  // From Interview.answers (decrypted)
  mealsPerDay?: number;
  dietType?: string;
  chronicDiseases?: string[];
  allergies?: string[];
  cuisinePreferences?: string[];
  hormonalIssues?: string[];
  ckdStadium?: number;
  workType?: string;
  firstMealTime?: string;
  lastMealTime?: string;
  eatsAtNight?: boolean;
  dislikedFoods?: string[];
  preferredFoods?: string[];
}

function safeArray(v: unknown): string[] | undefined {
  if (Array.isArray(v) && v.length > 0) return v.map(String);
  return undefined;
}

function safeString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function safeNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return !isNaN(n) ? n : undefined;
  }
  return undefined;
}

async function main() {
  console.log('=== Faza D test patient survey (dev DB) ===\n');

  const patients = await prisma.patient.findMany({
    include: {
      interviews: { orderBy: { createdAt: 'desc' }, take: 1 },
      nutritionTargets: { select: { id: true } },
      _count: { select: { dietPlans: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const summaries: PatientSummary[] = [];

  for (const p of patients) {
    const summary: PatientSummary = {
      id: p.id,
      sex: p.sex,
      age: p.birthDate ? Math.floor((Date.now() - p.birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : (p.birthYear ? new Date().getFullYear() - p.birthYear : null),
      weightKg: p.weightKg ? Number(p.weightKg) : null,
      heightCm: p.heightCm,
      hasInterview: p.interviews.length > 0,
      hasNutritionTargets: !!p.nutritionTargets,
      numDietPlans: p._count.dietPlans,
    };

    if (p.interviews.length > 0) {
      try {
        const answers = decryptJson(p.interviews[0].answers) as Record<string, unknown>;
        summary.mealsPerDay = safeNumber(answers.mealsPerDay) ?? safeNumber(answers.posilkiDziennie);
        summary.dietType = safeString(answers.dietType) ?? safeString(answers.typDiety);
        summary.chronicDiseases = safeArray(answers.chronicDiseases) ?? safeArray(answers.chorobyPrzewlekle);
        summary.allergies = safeArray(answers.allergies);
        summary.cuisinePreferences = safeArray(answers.cuisinePreferences);
        summary.hormonalIssues = safeArray(answers.hormonalIssues);
        summary.ckdStadium = safeNumber(answers.ckdStadium);
        summary.workType = safeString(answers.workType);
        summary.firstMealTime = safeString(answers.firstMealTime);
        summary.lastMealTime = safeString(answers.lastMealTime);
        summary.eatsAtNight = answers.eatsAtNight != null ? Boolean(answers.eatsAtNight) : undefined;
        summary.dislikedFoods = safeArray(answers.dislikedFoods);
        summary.preferredFoods = safeArray(answers.preferredFoods);
      } catch (err) {
        console.warn(`  [${p.id}] failed to decrypt Interview: ${(err as Error).message}`);
      }
    }

    summaries.push(summary);
  }

  // Print summary table
  console.log(`Total patients: ${summaries.length}\n`);

  const usable = summaries.filter(s => s.hasInterview && s.hasNutritionTargets);
  console.log(`Usable (has Interview + NutritionTargets): ${usable.length}\n`);

  // Score "interestingness" — patients with rare/unique D1-D8 attributes get higher rank
  const scored = usable.map(s => {
    let score = 0;
    const tags: string[] = [];
    if (s.cuisinePreferences && s.cuisinePreferences.length > 0) { score += 2; tags.push(`cuisine:${s.cuisinePreferences.join(',')}`); }
    if (s.hormonalIssues && s.hormonalIssues.length > 0) { score += 3; tags.push(`hormonal:${s.hormonalIssues.join(',')}`); }
    if (s.ckdStadium != null) { score += 5; tags.push(`ckd:${s.ckdStadium}`); }
    if (s.workType === 'shift_night') { score += 5; tags.push('shift_night'); }
    if (s.firstMealTime === 'skip') { score += 3; tags.push('skip_breakfast'); }
    if (s.lastMealTime === 'before_18') { score += 2; tags.push('eats_before_18'); }
    if (s.eatsAtNight === false) { score += 1; tags.push('no_night'); }
    if (s.dislikedFoods && s.dislikedFoods.length > 0) { score += 1; tags.push(`disliked:${s.dislikedFoods.length}`); }
    if (s.allergies && s.allergies.length > 0) { score += 1; tags.push(`allergies:${s.allergies.join(',')}`); }
    if (s.chronicDiseases && s.chronicDiseases.length > 0) { score += 2; tags.push(`chronic:${s.chronicDiseases.join(',')}`); }
    return { ...s, score, tags };
  }).sort((a, b) => b.score - a.score);

  console.log('--- Top 15 by interestingness score ---\n');
  for (const s of scored.slice(0, 15)) {
    console.log(`[${s.id.slice(-8)}] sex=${s.sex} age=${s.age} mealsPerDay=${s.mealsPerDay} diet=${s.dietType} score=${s.score}`);
    console.log(`  tags: ${s.tags.join(' | ')}`);
    console.log(`  plans=${s.numDietPlans}`);
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
