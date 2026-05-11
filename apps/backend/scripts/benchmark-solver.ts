/**
 * Benchmark: Solver vs Greedy on real recipe database
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/benchmark-solver.ts
 *
 * Generates diet plans using both methods for simulated patient profiles
 * and compares quality metrics.
 */

import 'dotenv/config';
import { prisma } from '@db';
import { assembleDbPlan, type AssemblyInput } from '../src/services/dbPlanAssembly.service';
import { solveWeekPlan, assembleSolverPlan } from '../src/services/weekSolver.service';

// ─── Simulated patient profiles ─────────────────────────────────────────────

interface TestProfile {
  name: string;
  patientId: string; // will be looked up or simulated
  input: Omit<AssemblyInput, 'patientId'>;
}

// We need a real patientId from DB to load NutritionTargets
async function findTestPatientId(): Promise<string | null> {
  const patient = await prisma.patient.findFirst({
    where: {
      nutritionTargets: { isNot: null },
    },
    select: { id: true },
  });
  return patient?.id ?? null;
}

// ─── Benchmark ──────────────────────────────────────────────────────────────

interface BenchmarkResult {
  profile: string;
  method: 'greedy' | 'solver';
  durationMs: number;
  coveragePct: number;
  avgFitScore: number;
  avgTotalScore: number;
  diversityScore: number;
  dailyKcal: number[];
  feasible: boolean;
  recipeCount: number;
}

async function runBenchmark() {
  console.log('=== BENCHMARK: Solver vs Greedy ===\n');

  // Check recipe count
  const recipeCount = await prisma.recipe.count({
    where: { isActive: true, source: { in: ['imported', 'manual'] } },
  });
  console.log(`Recipes in DB: ${recipeCount}`);

  if (recipeCount < 50) {
    console.log('ERROR: Too few recipes for meaningful benchmark. Need at least 50.');
    await prisma.$disconnect();
    return;
  }

  // Find a real patient
  const patientId = await findTestPatientId();
  if (!patientId) {
    console.log('ERROR: No patient with NutritionTargets found. Create a test patient first.');
    await prisma.$disconnect();
    return;
  }
  console.log(`Using patientId: ${patientId}\n`);

  // Test profiles with different constraints
  const profiles: Array<{ name: string; overrides: Partial<AssemblyInput> }> = [
    { name: 'Standard (no restrictions)', overrides: {} },
    { name: 'Budget (BUDGET cost)', overrides: { maxCost: 'BUDGET' } },
    { name: 'Quick cook (30min max)', overrides: { maxCookingTimeMinutes: 30 } },
    { name: 'Lactose-free', overrides: { excludeAllergens: ['lactose'] } },
    { name: 'Gluten-free', overrides: { requiredDietFlags: ['glutenFree'] } },
  ];

  const results: BenchmarkResult[] = [];

  for (const profile of profiles) {
    const input: AssemblyInput = {
      patientId,
      days: 7,
      ...profile.overrides,
    };

    console.log(`── ${profile.name} ──`);

    // Greedy
    try {
      const greedy = await assembleDbPlan(input);
      const result: BenchmarkResult = {
        profile: profile.name,
        method: 'greedy',
        durationMs: greedy.durationMs,
        coveragePct: Math.round(greedy.coverage.filledFromDbPct * 10) / 10,
        avgFitScore: greedy.coverage.avgFitScore,
        avgTotalScore: greedy.coverage.avgTotalScore,
        diversityScore: greedy.coverage.diversityScore,
        dailyKcal: greedy.coverage.dailyKcal,
        feasible: greedy.coverage.filledFromDbPct > 0,
        recipeCount: greedy.recipeIds.length,
      };
      results.push(result);
      console.log(`  Greedy:  ${result.durationMs}ms | coverage ${result.coveragePct}% | fit ${result.avgFitScore} | total ${result.avgTotalScore} | diversity ${result.diversityScore} | recipes ${result.recipeCount}`);
    } catch (err) {
      console.log(`  Greedy:  FAILED — ${(err as Error).message}`);
      results.push({ profile: profile.name, method: 'greedy', durationMs: 0, coveragePct: 0, avgFitScore: 0, avgTotalScore: 0, diversityScore: 0, dailyKcal: [], feasible: false, recipeCount: 0 });
    }

    // Solver
    try {
      const solverResult = await solveWeekPlan(input);
      if (solverResult.status === 'OPTIMAL' || solverResult.status === 'FEASIBLE') {
        const solverPlan = await assembleSolverPlan(solverResult, input);
        const result: BenchmarkResult = {
          profile: profile.name,
          method: 'solver',
          durationMs: solverResult.durationMs + solverPlan.durationMs,
          coveragePct: Math.round(solverPlan.coverage.filledFromDbPct * 10) / 10,
          avgFitScore: solverPlan.coverage.avgFitScore,
          avgTotalScore: solverPlan.coverage.avgTotalScore,
          diversityScore: solverPlan.coverage.diversityScore,
          dailyKcal: solverPlan.coverage.dailyKcal,
          feasible: true,
          recipeCount: solverPlan.recipeIds.length,
        };
        results.push(result);
        console.log(`  Solver:  ${result.durationMs}ms | coverage ${result.coveragePct}% | fit ${result.avgFitScore} | total ${result.avgTotalScore} | diversity ${result.diversityScore} | recipes ${result.recipeCount}`);
      } else {
        console.log(`  Solver:  ${solverResult.status} (${solverResult.durationMs}ms, ${solverResult.totalVariables} vars, ${solverResult.totalConstraints} constraints)`);
        results.push({ profile: profile.name, method: 'solver', durationMs: solverResult.durationMs, coveragePct: 0, avgFitScore: 0, avgTotalScore: 0, diversityScore: 0, dailyKcal: [], feasible: false, recipeCount: 0 });
      }
    } catch (err) {
      console.log(`  Solver:  FAILED — ${(err as Error).message}`);
      results.push({ profile: profile.name, method: 'solver', durationMs: 0, coveragePct: 0, avgFitScore: 0, avgTotalScore: 0, diversityScore: 0, dailyKcal: [], feasible: false, recipeCount: 0 });
    }

    console.log();
  }

  // ── Summary table ─────────────────────────────────────────────────────
  console.log('=== SUMMARY ===\n');
  console.log('Profile                    | Method | Time   | Cover | Fit   | Total | Divers | Recipes');
  console.log('---------------------------|--------|--------|-------|-------|-------|--------|--------');

  for (const r of results) {
    const name = r.profile.padEnd(26);
    const method = r.method.padEnd(6);
    const time = `${r.durationMs}ms`.padStart(6);
    const cover = `${r.coveragePct}%`.padStart(5);
    const fit = `${r.avgFitScore}`.padStart(5);
    const total = `${r.avgTotalScore}`.padStart(5);
    const div = `${r.diversityScore}`.padStart(6);
    const recipes = `${r.recipeCount}`.padStart(7);
    console.log(`${name} | ${method} | ${time} | ${cover} | ${fit} | ${total} | ${div} | ${recipes}`);
  }

  // ── Solver vs Greedy comparison ───────────────────────────────────────
  console.log('\n=== SOLVER vs GREEDY COMPARISON ===\n');

  for (const profile of profiles) {
    const greedy = results.find((r) => r.profile === profile.name && r.method === 'greedy');
    const solver = results.find((r) => r.profile === profile.name && r.method === 'solver');
    if (!greedy || !solver) continue;

    const fitDiff = solver.avgFitScore - greedy.avgFitScore;
    const totalDiff = solver.avgTotalScore - greedy.avgTotalScore;
    const timeDiff = solver.durationMs - greedy.durationMs;

    console.log(`${profile.name}:`);
    console.log(`  Fit score:   ${fitDiff >= 0 ? '+' : ''}${fitDiff.toFixed(1)} (solver ${solver.feasible ? 'wins' : 'INFEASIBLE'})`);
    console.log(`  Total score: ${totalDiff >= 0 ? '+' : ''}${totalDiff.toFixed(1)}`);
    console.log(`  Time delta:  ${timeDiff >= 0 ? '+' : ''}${timeDiff}ms`);
    console.log();
  }

  await prisma.$disconnect();
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
