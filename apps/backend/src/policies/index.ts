export type {
  PatientContext,
  PolicyRule,
  PolicyResult,
  PolicyEffect,
  AppliedRule,
  RedFlag,
  RedFlagResult,
  TriggeredRedFlag,
  PlanExplanation,
  ExplanationEntry,
  NutrientKey,
} from './types';

export {
  buildPatientContext,
  evaluatePolicies,
  applyTargetModifications,
  type AdjustedTargets,
} from './policy-engine';

export { CLINICAL_RULES } from './clinical-rules';

export { RED_FLAGS, evaluateRedFlags } from './red-flags';

export { buildPlanExplanation } from './explainability';

export { loadPolicyRules, evaluateRedFlagsFromDb, invalidateRuleCache } from './rule-store';

export { evaluateCondition, type RuleCondition } from './condition-evaluator';
