/**
 * Solver Smoke Tests (Faza 80.3)
 *
 * Verifies that OR-Tools CP-SAT solver responds correctly.
 * Requires solver running at SOLVER_URL (default: http://localhost:5050).
 */

import { describe, it, expect, beforeAll } from 'vitest';

const SOLVER_URL = process.env.SOLVER_URL ?? 'http://localhost:5050';

function makeCandidate(id: string, dayIndex: number, slotIndex: number, recipeId: string, mealType: string, kcal: number) {
  return {
    id, day_index: dayIndex, slot_index: slotIndex, recipe_id: recipeId,
    title: `Recipe ${recipeId}`, total_score: 70 + Math.random() * 20,
    scaled_kcal: kcal, scaled_protein_g: kcal * 0.08, scaled_fat_g: kcal * 0.035,
    scaled_carbs_g: kcal * 0.12, fiber_g: 5 + Math.random() * 5,
    season_score: 60 + Math.random() * 30, cuisine_score: 50 + Math.random() * 40,
    tags: [], protein_source: null, category_tag: null, meal_type: mealType,
    sodium_mg: 300 + Math.random() * 500, iron_mg: 2 + Math.random() * 3,
    calcium_mg: 100 + Math.random() * 200, vitamin_d_ug: Math.random() * 5,
    folate_ug: 50 + Math.random() * 100, vitamin_b12_ug: Math.random() * 3,
    zinc_mg: 2 + Math.random() * 4, vitamin_c_mg: 10 + Math.random() * 40,
    fat_g_total: kcal * 0.035, prep_time_minutes: 15 + Math.random() * 45,
    meal_prep_friendly: Math.random() > 0.5, main_ingredient_id: null,
    patient_preference: 50, ingredient_ids: [], allergen_penalty: 0,
  };
}

function buildTestPayload(numDays = 2, candidatesPerSlot = 5) {
  const slots = [
    { slot_index: 0, meal_type: 'BREAKFAST', target_kcal: 400, target_protein_g: 15, target_fat_g: 12, target_carbs_g: 55 },
    { slot_index: 1, meal_type: 'LUNCH', target_kcal: 600, target_protein_g: 35, target_fat_g: 18, target_carbs_g: 70 },
    { slot_index: 2, meal_type: 'DINNER', target_kcal: 500, target_protein_g: 30, target_fat_g: 15, target_carbs_g: 55 },
  ];

  const candidates = [];
  for (let d = 0; d < numDays; d++) {
    for (const slot of slots) {
      for (let c = 0; c < candidatesPerSlot; c++) {
        const rid = `r${slot.slot_index}_${c}`;
        candidates.push(makeCandidate(
          `d${d}_s${slot.slot_index}_${rid}`, d, slot.slot_index, rid,
          slot.meal_type, slot.target_kcal * (0.8 + Math.random() * 0.4),
        ));
      }
    }
  }

  return {
    candidates, slots, num_days: numDays,
    daily_target_kcal: 1500, daily_target_protein_g: 80,
    daily_target_fat_g: 45, daily_target_carbs_g: 180,
    kcal_tolerance: 0.15, time_limit_sec: 5,
    daily_cooking_budget_min: 90, prefers_meal_prep: false,
  };
}

describe('Solver Smoke Tests', () => {
  let skip = false;

  beforeAll(async () => {
    try {
      const res = await fetch(`${SOLVER_URL}/health`, { signal: AbortSignal.timeout(2000) });
      skip = !res.ok;
    } catch { skip = true; }
    if (skip) console.warn('[smoke] Solver not available at ' + SOLVER_URL + ' — skipping');
  });

  function smokeIt(name: string, fn: () => Promise<void>) {
    it(name, async () => { if (!skip) await fn(); });
  }

  // 80.3.1: Health check
  smokeIt('GET /health → ok', async () => {
    const res = await fetch(`${SOLVER_URL}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.solver).toBe('or-tools-cp-sat');
  });

  // 80.3.2: Basic solve
  smokeIt('POST /solve → OPTIMAL or FEASIBLE', async () => {
    const payload = buildTestPayload(2, 5);
    const res = await fetch(`${SOLVER_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(['OPTIMAL', 'FEASIBLE']).toContain(body.status);
    expect(body.selections.length).toBe(2 * 3); // numDays × numSlots
    expect(body.duration_ms).toBeLessThan(10000);
  });

  // 80.3.3: Assert diversity (higher timeout — 7-day plan with 14 micronutrient constraints)
  smokeIt('POST /solve 7-day → diversity ≥ 0.7', async () => {
    const payload = { ...buildTestPayload(7, 10), time_limit_sec: 8 };
    const res = await fetch(`${SOLVER_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    expect(['OPTIMAL', 'FEASIBLE']).toContain(body.status);
    const uniqueRecipes = new Set(body.selections.map((s: { recipe_id: string }) => s.recipe_id));
    const diversity = uniqueRecipes.size / body.selections.length;
    expect(diversity).toBeGreaterThanOrEqual(0.7);
  });

  // 80.3.4: Deterministic replay
  smokeIt('POST /solve with seed → identical results', async () => {
    const payload = { ...buildTestPayload(2, 5), random_seed: 12345 };
    const res1 = await fetch(`${SOLVER_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body1 = await res1.json();

    const res2 = await fetch(`${SOLVER_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body2 = await res2.json();

    expect(body1.status).toBe(body2.status);
    // seed_used only returned by solver v2.1+
    if (body1.seed_used !== undefined) {
      expect(body1.seed_used).toBe(12345);
    }
    const ids1 = body1.selections.map((s: { recipe_id: string }) => s.recipe_id).sort();
    const ids2 = body2.selections.map((s: { recipe_id: string }) => s.recipe_id).sort();
    expect(ids1).toEqual(ids2);
  });

  // 80.3.5: Empty candidates → INFEASIBLE (not crash)
  smokeIt('POST /solve empty candidates → INFEASIBLE', async () => {
    const res = await fetch(`${SOLVER_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidates: [],
        slots: [{ slot_index: 0, meal_type: 'BREAKFAST', target_kcal: 400, target_protein_g: 15, target_fat_g: 10, target_carbs_g: 60 }],
        num_days: 1, daily_target_kcal: 400, daily_target_protein_g: 15,
        daily_target_fat_g: 10, daily_target_carbs_g: 60,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(['INFEASIBLE', 'ERROR']).toContain(body.status);
    expect(body.selections).toHaveLength(0);
  });
});
