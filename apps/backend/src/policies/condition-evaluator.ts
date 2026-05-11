// ─── Declarative Condition Evaluator ──────────────────────────────────────────
//
// Evaluates JSON condition trees against a PatientContext.
// Used to replace hardcoded JS functions with DB-stored rules.

import type { PatientContext } from './types';

// ─── Condition Types ────────────────────────────────────────────────────────

/** Check if chronicDiseases or digestiveIssues contain any of the terms */
export interface HasCondition {
  type: 'HAS_CONDITION';
  terms: string[];
}

/** Check if allergies contain any of the terms */
export interface HasAllergy {
  type: 'HAS_ALLERGY';
  terms: string[];
}

/** Check if dietType contains any of the terms */
export interface HasDiet {
  type: 'HAS_DIET';
  terms: string[];
}

/** Check if hormonalIssues contain any of the terms */
export interface HasHormonalIssue {
  type: 'HAS_HORMONAL_ISSUE';
  terms: string[];
}

/** Compare a numeric field (or computed BMI) against a threshold */
export interface FieldCompare {
  type: 'FIELD_COMPARE';
  field: 'bmi' | 'ageYears' | 'targetKcal' | 'weightKg' | 'heightCm' | 'chronicDiseasesCount';
  operator: 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ';
  value: number;
}

/** Check if a string field equals a specific value */
export interface FieldEquals {
  type: 'FIELD_EQUALS';
  field: 'pregnancyStatus' | 'goal' | 'sex' | 'dietType' | 'alcoholFrequency' | 'stressLevel' | 'sleepHours' | 'workType';
  value: string;
}

/** Check if medications field is non-empty */
export interface HasMedications {
  type: 'HAS_MEDICATIONS';
}

/** Check if patient's disease stage matches any of the terms (Phase 27) */
export interface HasStage {
  type: 'HAS_STAGE';
  terms: string[];
}

/** Check if patient's age falls within a range (Phase 27) */
export interface AgeRange {
  type: 'AGE_RANGE';
  min?: number;
  max?: number;
}

/** Check if patient has specific surgery in history (Phase 27) */
export interface HasSurgery {
  type: 'HAS_SURGERY';
  terms: string[];
}

/** Check if patient takes a specific medication from medicationsList (Phase 27) */
export interface HasMedication {
  type: 'HAS_MEDICATION';
  terms: string[];
}

/** Logical AND: all conditions must be true */
export interface AndCondition {
  type: 'AND';
  conditions: RuleCondition[];
}

/** Logical OR: at least one condition must be true */
export interface OrCondition {
  type: 'OR';
  conditions: RuleCondition[];
}

export type RuleCondition =
  | HasCondition
  | HasAllergy
  | HasDiet
  | HasHormonalIssue
  | FieldCompare
  | FieldEquals
  | HasMedications
  | HasStage
  | AgeRange
  | HasSurgery
  | HasMedication
  | AndCondition
  | OrCondition;

// ─── Evaluator ──────────────────────────────────────────────────────────────

function computeBmi(ctx: PatientContext): number {
  if (!ctx.weightKg || !ctx.heightCm) return 0;
  return ctx.weightKg / ((ctx.heightCm / 100) ** 2);
}

function getNumericField(ctx: PatientContext, field: FieldCompare['field']): number {
  switch (field) {
    case 'bmi': return computeBmi(ctx);
    case 'ageYears': return ctx.ageYears;
    case 'targetKcal': return ctx.targetKcal;
    case 'weightKg': return ctx.weightKg;
    case 'heightCm': return ctx.heightCm;
    case 'chronicDiseasesCount': return ctx.chronicDiseases.length;
  }
}

function getStringField(ctx: PatientContext, field: FieldEquals['field']): string {
  switch (field) {
    case 'pregnancyStatus': return ctx.pregnancyStatus ?? '';
    case 'goal': return ctx.goal;
    case 'sex': return ctx.sex;
    case 'dietType': return ctx.dietType;
    case 'alcoholFrequency': return ctx.alcoholFrequency ?? '';
    case 'stressLevel': return ctx.stressLevel ?? '';
    case 'sleepHours': return ctx.sleepHours ?? '';
    case 'workType': return ctx.workType ?? '';
  }
}

function compareNumeric(actual: number, operator: FieldCompare['operator'], value: number): boolean {
  switch (operator) {
    case 'LT': return actual < value;
    case 'LTE': return actual <= value;
    case 'GT': return actual > value;
    case 'GTE': return actual >= value;
    case 'EQ': return actual === value;
  }
}

function matchesTerms(values: string[], terms: string[]): boolean {
  const lower = values.map(s => s.toLowerCase());
  return terms.some(t => lower.some(c => c.includes(t)));
}

/**
 * Recursively evaluates a declarative condition tree against patient context.
 */
export function evaluateCondition(condition: RuleCondition, ctx: PatientContext): boolean {
  switch (condition.type) {
    case 'HAS_CONDITION':
      return matchesTerms([...ctx.chronicDiseases, ...ctx.digestiveIssues], condition.terms);

    case 'HAS_ALLERGY':
      return matchesTerms(ctx.allergies, condition.terms);

    case 'HAS_DIET':
      return matchesTerms([ctx.dietType], condition.terms);

    case 'HAS_HORMONAL_ISSUE':
      return matchesTerms(ctx.hormonalIssues ?? [], condition.terms);

    case 'FIELD_COMPARE':
      return compareNumeric(getNumericField(ctx, condition.field), condition.operator, condition.value);

    case 'FIELD_EQUALS':
      return getStringField(ctx, condition.field) === condition.value;

    case 'HAS_MEDICATIONS':
      return !!(ctx.medications && ctx.medications.trim().length > 0);

    case 'HAS_STAGE':
      return !!(ctx.stage && matchesTerms([ctx.stage], condition.terms));

    case 'AGE_RANGE': {
      const age = ctx.ageYears;
      const aboveMin = condition.min == null || age >= condition.min;
      const belowMax = condition.max == null || age <= condition.max;
      return aboveMin && belowMax;
    }

    case 'HAS_SURGERY':
      return matchesTerms(ctx.surgeryHistory ?? [], condition.terms);

    case 'HAS_MEDICATION':
      return matchesTerms(ctx.medicationsList ?? [], condition.terms);

    case 'AND':
      return condition.conditions.every(c => evaluateCondition(c, ctx));

    case 'OR':
      return condition.conditions.some(c => evaluateCondition(c, ctx));
  }
}
