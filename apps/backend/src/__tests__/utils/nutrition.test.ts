import { describe, it, expect } from 'vitest';
import {
  calculateBMR,
  calculateTDEE,
  calculateTargetKcal,
  calculateMacros,
  normalizeActivityLevel,
  normalizeDietGoal,
  calculateTDEEHybrid,
} from '../../utils/nutrition';

// ─── calculateBMR ─────────────────────────────────────────────────────────────

describe('calculateBMR', () => {
  it('returns correct BMR for male (Mifflin-St Jeor)', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(calculateBMR('male', 80, 180, 30)).toBe(1780);
  });

  it('returns correct BMR for female', () => {
    // 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345 (rounded)
    expect(calculateBMR('female', 60, 165, 25)).toBe(1345);
  });

  it('returns lower BMR for female than male with same stats', () => {
    const male = calculateBMR('male', 70, 175, 35);
    const female = calculateBMR('female', 70, 175, 35);
    expect(female).toBeLessThan(male);
  });

  it('BMR decreases as age increases', () => {
    const younger = calculateBMR('male', 80, 180, 25);
    const older = calculateBMR('male', 80, 180, 45);
    expect(older).toBeLessThan(younger);
  });
});

// ─── calculateTDEE ───────────────────────────────────────────────────────────

describe('calculateTDEE', () => {
  it('sedentary multiplies BMR by 1.2', () => {
    expect(calculateTDEE(1000, 'sedentary')).toBe(1200);
  });

  it('light multiplies BMR by 1.375', () => {
    expect(calculateTDEE(1000, 'light')).toBe(1375);
  });

  it('moderate multiplies BMR by 1.55', () => {
    expect(calculateTDEE(1000, 'moderate')).toBe(1550);
  });

  it('active multiplies BMR by 1.725', () => {
    expect(calculateTDEE(1000, 'active')).toBe(1725);
  });

  it('very_active multiplies BMR by 1.9', () => {
    expect(calculateTDEE(1000, 'very_active')).toBe(1900);
  });

  it('TDEE is always greater than BMR', () => {
    const bmr = calculateBMR('female', 65, 168, 30);
    expect(calculateTDEE(bmr, 'sedentary')).toBeGreaterThan(bmr);
  });
});

// ─── calculateTargetKcal ─────────────────────────────────────────────────────

describe('calculateTargetKcal', () => {
  it('lose_weight applies 20% deficit', () => {
    expect(calculateTargetKcal(2000, 'lose_weight')).toBe(1600);
  });

  it('gain_muscle applies 10% surplus', () => {
    expect(calculateTargetKcal(2000, 'gain_muscle')).toBe(2200);
  });

  it('maintain_weight returns TDEE unchanged', () => {
    expect(calculateTargetKcal(2000, 'maintain_weight')).toBe(2000);
  });

  it('improve_health returns TDEE unchanged', () => {
    expect(calculateTargetKcal(2000, 'improve_health')).toBe(2000);
  });

  it('other returns TDEE unchanged', () => {
    expect(calculateTargetKcal(2000, 'other')).toBe(2000);
  });
});

// ─── calculateMacros ─────────────────────────────────────────────────────────

describe('calculateMacros', () => {
  it('protein is 2.0 g/kg for lose_weight', () => {
    const { proteinG } = calculateMacros(1600, 80, 'lose_weight');
    expect(proteinG).toBe(160); // 80 * 2.0
  });

  it('protein is 2.2 g/kg for gain_muscle', () => {
    const { proteinG } = calculateMacros(2200, 80, 'gain_muscle');
    expect(proteinG).toBe(176); // 80 * 2.2
  });

  it('protein is 1.8 g/kg for maintain_weight', () => {
    const { proteinG } = calculateMacros(2000, 80, 'maintain_weight');
    expect(proteinG).toBe(144); // 80 * 1.8
  });

  it('fat is ~25% of target kcal', () => {
    const { fatG } = calculateMacros(2000, 80, 'maintain_weight');
    // 2000 * 0.25 / 9 ≈ 55.6 → 56
    expect(fatG).toBe(56);
  });

  it('carbsG is non-negative', () => {
    const { carbsG } = calculateMacros(1200, 80, 'lose_weight');
    expect(carbsG).toBeGreaterThanOrEqual(0);
  });

  it('macro kcal sum approximates targetKcal (±5%)', () => {
    const targetKcal = 2000;
    const { proteinG, fatG, carbsG } = calculateMacros(targetKcal, 80, 'maintain_weight');
    const total = proteinG * 4 + fatG * 9 + carbsG * 4;
    expect(Math.abs(total - targetKcal)).toBeLessThanOrEqual(targetKcal * 0.05);
  });
});

// ─── normalizers ──────────────────────────────────────────────────────────────

describe('normalizeActivityLevel', () => {
  it('returns valid values as-is', () => {
    expect(normalizeActivityLevel('moderate')).toBe('moderate');
    expect(normalizeActivityLevel('very_active')).toBe('very_active');
  });

  it('falls back to sedentary for unknown values', () => {
    expect(normalizeActivityLevel('unknown')).toBe('sedentary');
    expect(normalizeActivityLevel('')).toBe('sedentary');
  });
});

describe('normalizeDietGoal', () => {
  it('returns valid values as-is', () => {
    expect(normalizeDietGoal('lose_weight')).toBe('lose_weight');
    expect(normalizeDietGoal('gain_muscle')).toBe('gain_muscle');
  });

  it('falls back to maintain_weight for unknown values', () => {
    expect(normalizeDietGoal('unknown')).toBe('maintain_weight');
    expect(normalizeDietGoal('')).toBe('maintain_weight');
  });
});

// ─── calculateTDEEHybrid (28.0.3 + 28.0.4) ───────────────────────────────────

describe('calculateTDEEHybrid — PAL_ONLY (28.0.3)', () => {
  it('returns PAL_ONLY when activityTypes is empty', () => {
    const result = calculateTDEEHybrid(1800, 80, 'moderate', [], 3, 60);
    expect(result.method).toBe('PAL_ONLY');
  });

  it('returns PAL_ONLY when workoutsPerWeek is 0', () => {
    const result = calculateTDEEHybrid(1800, 80, 'moderate', ['crossfit'], 0, 60);
    expect(result.method).toBe('PAL_ONLY');
  });

  it('returns PAL_ONLY when workoutDurationMin is 0', () => {
    const result = calculateTDEEHybrid(1800, 80, 'moderate', ['crossfit'], 3, 0);
    expect(result.method).toBe('PAL_ONLY');
  });

  it('PAL_ONLY: no ExEE contribution — exerciseKcalPerDay is 0', () => {
    const result = calculateTDEEHybrid(1800, 80, 'moderate', [], 0, 0);
    expect(result.breakdown.exerciseKcalPerDay).toBe(0);
    expect(result.kcal).toBe(result.breakdown.palKcal);
  });

  it('PAL_ONLY: kcal equals BMR × PAL multiplier for sedentary', () => {
    // sedentary multiplier = 1.2
    const result = calculateTDEEHybrid(1000, 70, 'sedentary', [], 0, 0);
    expect(result.kcal).toBe(1200);
    expect(result.method).toBe('PAL_ONLY');
  });
});

describe('calculateTDEEHybrid — PAL_PLUS_EXERCISE (28.0.4)', () => {
  it('returns PAL_PLUS_EXERCISE when activityTypes + workouts provided', () => {
    const result = calculateTDEEHybrid(1800, 80, 'moderate', ['crossfit'], 3, 60);
    expect(result.method).toBe('PAL_PLUS_EXERCISE');
  });

  it('PAL_PLUS_EXERCISE: kcal is greater than PAL_ONLY for same activity level', () => {
    const withExercise = calculateTDEEHybrid(1800, 80, 'sedentary', ['crossfit'], 3, 60);
    const withoutExercise = calculateTDEEHybrid(1800, 80, 'sedentary', [], 0, 0);
    expect(withExercise.kcal).toBeGreaterThan(withoutExercise.kcal);
  });

  it('PAL_PLUS_EXERCISE: breakdown contains non-zero exerciseKcalPerDay', () => {
    const result = calculateTDEEHybrid(1800, 80, 'moderate', ['crossfit'], 3, 60);
    expect(result.breakdown.exerciseKcalPerDay).toBeGreaterThan(0);
  });

  it('PAL_PLUS_EXERCISE: totalTdee = palKcal + exerciseKcalPerDay', () => {
    const result = calculateTDEEHybrid(1800, 80, 'moderate', ['crossfit'], 3, 60);
    expect(result.kcal).toBe(result.breakdown.palKcal + result.breakdown.exerciseKcalPerDay);
  });

  it('more workouts per week → higher kcal', () => {
    const low = calculateTDEEHybrid(1800, 80, 'sedentary', ['crossfit'], 2, 60);
    const high = calculateTDEEHybrid(1800, 80, 'sedentary', ['crossfit'], 5, 60);
    expect(high.kcal).toBeGreaterThan(low.kcal);
  });

  it('longer workout duration → higher kcal', () => {
    const short = calculateTDEEHybrid(1800, 80, 'sedentary', ['crossfit'], 3, 30);
    const long = calculateTDEEHybrid(1800, 80, 'sedentary', ['crossfit'], 3, 90);
    expect(long.kcal).toBeGreaterThan(short.kcal);
  });

  it('breakdown stores activityTypes, workoutsPerWeek, workoutDurationMin', () => {
    const result = calculateTDEEHybrid(1800, 80, 'moderate', ['crossfit', 'cycling'], 3, 60);
    expect(result.breakdown.activityTypes).toEqual(['crossfit', 'cycling']);
    expect(result.breakdown.workoutsPerWeek).toBe(3);
    expect(result.breakdown.workoutDurationMin).toBe(60);
  });
});
