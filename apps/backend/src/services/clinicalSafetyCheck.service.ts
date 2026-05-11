/**
 * Clinical Safety Check Service (Faza 83.1)
 *
 * Hard validation that BLOCKS plan generation when clinical safety rules are violated.
 * Unlike softValidation (advisory), these checks prevent the plan from being created.
 *
 * Evaluated AFTER policies are applied and BEFORE the solver is called.
 */

import type { PatientContext } from '../policies/types';

export interface SafetyBlocker {
  rule: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH';
  suggestion: string;
}

export interface SafetyCheckResult {
  safe: boolean;
  blockers: SafetyBlocker[];
}

// ─── Condition detection helpers ────────────────────────────────────────────

function hasCondition(ctx: PatientContext, ...keywords: string[]): boolean {
  const all = [...ctx.chronicDiseases, ...ctx.digestiveIssues].map((s) => s.toLowerCase());
  return keywords.some((kw) => all.some((d) => d.includes(kw.toLowerCase())));
}

function hasMedication(ctx: PatientContext, ...keywords: string[]): boolean {
  const meds = (ctx.medicationsList ?? []).map((m) => m.toLowerCase());
  const medsStr = (ctx.medications ?? '').toLowerCase();
  return keywords.some((kw) => {
    const kwLower = kw.toLowerCase();
    return meds.some((m) => m.includes(kwLower)) || medsStr.includes(kwLower);
  });
}

// ─── Safety Rules ───────────────────────────────────────────────────────────

type SafetyRule = (ctx: PatientContext, adjustedTargets: AdjustedTargets) => SafetyBlocker | null;

interface AdjustedTargets {
  targetKcal: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
}

const SAFETY_RULES: SafetyRule[] = [
  // ── CKD Stage 3+: Protein must be ≤0.8g/kg ──────────────────────────
  (ctx, targets) => {
    if (!hasCondition(ctx, 'ckd', 'kidney', 'nerk', 'niewydolność nerek', 'przewlekła choroba nerek')) {
      return null;
    }
    const maxProtein = ctx.weightKg * 0.8;
    if (targets.targetProteinG > maxProtein) {
      return {
        rule: 'CKD_PROTEIN_EXCESS',
        description: `Białko ${targets.targetProteinG}g/d przekracza limit ${Math.round(maxProtein)}g/d (0.8g/kg) przy chorobie nerek`,
        severity: 'CRITICAL',
        suggestion: `Obniż cel białka do max ${Math.round(maxProtein)}g/d lub skonsultuj z nefrologiem`,
      };
    }
    return null;
  },

  // ── CKD Stage 4+: Potassium hard limit ───────────────────────────────
  // (This is a metadata check — actual potassium is enforced in solver via nutrientLimits)
  (ctx) => {
    const stage = ctx.stage?.toLowerCase();
    if (stage && (stage.includes('4') || stage.includes('5') || stage.includes('dializ'))) {
      if (!hasCondition(ctx, 'ckd', 'kidney', 'nerk')) return null;
      return {
        rule: 'CKD_STAGE4_WARNING',
        description: 'Pacjent z CKD stadium 4+ wymaga ścisłej kontroli potasu i fosforu',
        severity: 'HIGH',
        suggestion: 'Plan wymaga weryfikacji nefrologa przed wysłaniem do pacjenta',
      };
    }
    return null;
  },

  // ── Starvation: targetKcal < BMR × 0.8 ──────────────────────────────
  (ctx, targets) => {
    // Mifflin-St Jeor BMR estimate
    const bmr = ctx.sex === 'male'
      ? 10 * ctx.weightKg + 6.25 * ctx.heightCm - 5 * ctx.ageYears + 5
      : 10 * ctx.weightKg + 6.25 * ctx.heightCm - 5 * ctx.ageYears - 161;
    const floor = bmr * 0.8;

    if (targets.targetKcal < floor && targets.targetKcal > 0) {
      return {
        rule: 'STARVATION_RISK',
        description: `Cel kaloryczny ${targets.targetKcal} kcal jest poniżej 80% BMR (${Math.round(floor)} kcal) — ryzyko głodzenia`,
        severity: 'CRITICAL',
        suggestion: `Podnieś cel do minimum ${Math.round(floor)} kcal/d lub skonsultuj z lekarzem`,
      };
    }
    return null;
  },

  // ── Heart failure: sodium must be < 1500mg ───────────────────────────
  (ctx) => {
    if (!hasCondition(ctx, 'niewydolność serca', 'heart failure', 'zastoinowa')) {
      return null;
    }
    // This is advisory — actual sodium is enforced in solver via hypertension flag
    return {
      rule: 'HEART_FAILURE_SODIUM',
      description: 'Pacjent z niewydolnością serca — sód powinien być <1500mg/d',
      severity: 'HIGH',
      suggestion: 'Upewnij się, że policy engine ustawił NUTRIENT_LIMIT sodium ≤ 1500mg',
    };
  },

  // ── Weight loss during pregnancy → BLOCK ─────────────────────────────
  (ctx) => {
    if (ctx.pregnancyStatus === 'pregnant' && ctx.goal === 'lose_weight') {
      return {
        rule: 'PREGNANCY_WEIGHT_LOSS',
        description: 'Redukcja masy ciała w ciąży jest przeciwwskazana',
        severity: 'CRITICAL',
        suggestion: 'Zmień cel na utrzymanie masy lub przyrost kontrolowany. Skonsultuj z ginekologiem.',
      };
    }
    return null;
  },

  // ── Eating disorder + deficit → BLOCK ────────────────────────────────
  (ctx) => {
    if (!hasCondition(ctx, 'anorex', 'bulimi', 'zaburzenia odżywiania', 'eating disorder')) {
      return null;
    }
    if (ctx.goal === 'lose_weight') {
      return {
        rule: 'EATING_DISORDER_DEFICIT',
        description: 'Deficyt kaloryczny przy zaburzeniach odżywiania jest przeciwwskazany',
        severity: 'CRITICAL',
        suggestion: 'Zmień cel na utrzymanie masy. Wymagana współpraca z psychiatrą/psychologiem.',
      };
    }
    return null;
  },

  // ── Warfarin + no vitamin K awareness ────────────────────────────────
  (ctx) => {
    if (!hasMedication(ctx, 'warfarin', 'warfaryn', 'acenocoumarol', 'acenokumarol', 'sintrom')) {
      return null;
    }
    return {
      rule: 'ANTICOAGULANT_VITAMIN_K',
      description: 'Pacjent na antykoagulancie (warfaryna/acenocoumarol) — witamina K musi być stabilna',
      severity: 'HIGH',
      suggestion: 'Nie zmieniaj drastycznie poziomu witaminy K w diecie. Skonsultuj z lekarzem prowadzącym.',
    };
  },

  // ── Type 1 Diabetes + no insulin awareness ───────────────────────────
  (ctx) => {
    if (!hasCondition(ctx, 'cukrzyca typu 1', 'type 1 diabetes', 't1d', 'dm1')) {
      return null;
    }
    return {
      rule: 'T1D_INSULIN_COORDINATION',
      description: 'Pacjent z cukrzycą typu 1 — plan wymaga koordynacji z dawkowaniem insuliny',
      severity: 'HIGH',
      suggestion: 'Plan musi być zatwierdzony przez diabetologa przed wysłaniem pacjentowi.',
    };
  },
];

// ─── Public API ─────────────────────────────────────────────────────────────

export function runClinicalSafetyCheck(
  ctx: PatientContext,
  adjustedTargets: AdjustedTargets,
): SafetyCheckResult {
  const blockers: SafetyBlocker[] = [];

  for (const rule of SAFETY_RULES) {
    const result = rule(ctx, adjustedTargets);
    if (result) {
      blockers.push(result);
    }
  }

  // CRITICAL blockers → unsafe. HIGH blockers → warning but allow (logged).
  const hasCritical = blockers.some((b) => b.severity === 'CRITICAL');

  return {
    safe: !hasCritical,
    blockers,
  };
}
