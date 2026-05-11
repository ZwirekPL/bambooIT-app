import type {
  PatientContext,
  PolicyResult,
  PlanExplanation,
  ExplanationEntry,
  RedFlagResult,
} from './types';

// ─── Build Plan Explanation ───────────────────────────────────────────────────

/**
 * Generates a human-readable explanation of why the plan was built this way.
 * Intended for both the dietitian review panel and the patient-facing view.
 */
export function buildPlanExplanation(
  ctx: PatientContext,
  policyResult: PolicyResult,
  adjustedTargets: { targetKcal: number; targetProteinG: number; targetFatG: number; targetCarbsG: number },
  redFlagResult?: RedFlagResult,
): PlanExplanation {
  // ── Target reasoning ─────────────────────────────────────────────────────
  const targetLines: string[] = [];

  targetLines.push(
    `Obliczone zapotrzebowanie kaloryczne: ${adjustedTargets.targetKcal} kcal/dzień.`,
  );

  const goalLabel = GOAL_LABELS[ctx.goal] ?? ctx.goal;
  targetLines.push(`Cel: ${goalLabel}.`);

  if (adjustedTargets.targetKcal !== ctx.targetKcal) {
    targetLines.push(
      `Bazowe zapotrzebowanie (${ctx.targetKcal} kcal) zostało zmodyfikowane na podstawie zidentyfikowanych schorzeń/stanów.`,
    );
  }

  targetLines.push(
    `Makroskładniki: białko ${adjustedTargets.targetProteinG}g, tłuszcz ${adjustedTargets.targetFatG}g, węglowodany ${adjustedTargets.targetCarbsG}g.`,
  );

  const targetReasoning = targetLines.join(' ');

  // ── Restrictions ─────────────────────────────────────────────────────────
  const restrictions: ExplanationEntry[] = [];
  const recommendations: ExplanationEntry[] = [];

  for (const note of policyResult.clinicalNotes) {
    const entry: ExplanationEntry = {
      ruleId: findRuleIdForNote(note.note, policyResult),
      ruleName: findRuleNameForNote(note.note, policyResult),
      description: note.note,
    };

    if (note.category === 'RESTRICTION' || note.category === 'WARNING') {
      restrictions.push(entry);
    } else {
      recommendations.push(entry);
    }
  }

  // ── Warnings ─────────────────────────────────────────────────────────────
  const warnings: string[] = [];

  if (redFlagResult?.triggered) {
    for (const flag of redFlagResult.flags) {
      warnings.push(`[${flag.severity}] ${flag.message}`);
    }
  }

  if (policyResult.appliedRules.length === 0) {
    recommendations.push({
      ruleId: 'standard',
      ruleName: 'Dieta standardowa',
      description: 'Nie zidentyfikowano szczególnych schorzeń ani ograniczeń — zastosowano standardowe wytyczne żywieniowe.',
    });
  }

  return {
    targetReasoning,
    restrictions,
    recommendations,
    warnings,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Redukcja masy ciała',
  gain_muscle: 'Budowa masy mięśniowej',
  maintain_weight: 'Utrzymanie masy ciała',
  improve_health: 'Poprawa zdrowia',
};

function findRuleIdForNote(note: string, result: PolicyResult): string {
  for (const rule of result.appliedRules) {
    const hasNote = rule.effects.some(
      e => e.type === 'CLINICAL_NOTE' && e.note === note,
    );
    if (hasNote) return rule.ruleId;
  }
  return 'unknown';
}

function findRuleNameForNote(note: string, result: PolicyResult): string {
  for (const rule of result.appliedRules) {
    const hasNote = rule.effects.some(
      e => e.type === 'CLINICAL_NOTE' && e.note === note,
    );
    if (hasNote) return rule.ruleName;
  }
  return 'Reguła';
}
