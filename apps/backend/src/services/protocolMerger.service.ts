// ─── Protocol Merger Service (30.2.3) ────────────────────────────────────────
//
// Merges multiple NutritionProtocols into a single effective protocol.
// Per parameter: takes the MORE RESTRICTIVE value.
// Maintains explainability: tracks which protocol contributed each override.

import { prisma } from '@db';
import type {
  ResolvedProtocol,
  FoodRestriction,
  MacroRatios,
  MacroRatio,
  CaloricAdjustments,
  MealSlot,
  AvoidCategory,
} from './protocol.service';
import { deserializeProtocol } from './protocol.service';
import type { MatchedProtocol } from './protocolMatcher.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MergedProtocol extends ResolvedProtocol {
  /** Which protocols contributed to this merged result */
  sourceProtocols: Array<{
    id: string;
    name: string;
    priority: number;
    triggerField: string;
    triggerValue: string;
  }>;
  /** Per-field explanation of which protocol "won" */
  mergeExplanation: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * For macro ratios, take the most restrictive per goal:
 * - Lower fat % (restrictive for cardiac/hepatic)
 * - Higher protein % (restrictive for muscle/renal — but minProteinPerKg handles renal cap)
 * We pick the "priority 1" protocol's ratios when in doubt.
 */
function mergeGoalRatios(a: MacroRatio, b: MacroRatio): MacroRatio {
  return {
    proteinPct: Math.max(a.proteinPct, b.proteinPct),
    fatPct: Math.min(a.fatPct, b.fatPct),
    carbsPct: 100 - Math.max(a.proteinPct, b.proteinPct) - Math.min(a.fatPct, b.fatPct),
  };
}

function mergeMacroRatios(a: MacroRatios, b: MacroRatios): MacroRatios {
  return {
    REDUCE: mergeGoalRatios(a.REDUCE, b.REDUCE),
    GAIN: mergeGoalRatios(a.GAIN, b.GAIN),
    MAINTAIN: mergeGoalRatios(a.MAINTAIN, b.MAINTAIN),
  };
}

/**
 * Caloric adjustments: take the more aggressive cut for REDUCE,
 * less surplus for GAIN.
 */
function mergeCaloricAdjustments(a: CaloricAdjustments, b: CaloricAdjustments): CaloricAdjustments {
  return {
    REDUCE: Math.min(a.REDUCE, b.REDUCE), // more negative = more restrictive
    GAIN: Math.min(a.GAIN, b.GAIN),       // less surplus = more restrictive
    MAINTAIN: 0,
  };
}

/**
 * Food restrictions: union, keeping the highest severity level per category.
 */
function mergeFoodRestrictions(a: FoodRestriction[], b: FoodRestriction[]): FoodRestriction[] {
  const map = new Map<string, FoodRestriction>();
  const severityRank: Record<string, number> = { HARD_BLOCK: 3, STRONG: 2, SOFT: 1 };

  for (const r of [...a, ...b]) {
    const existing = map.get(r.category);
    if (!existing || (severityRank[r.level] ?? 0) > (severityRank[existing.level] ?? 0)) {
      map.set(r.category, {
        ...r,
        keywords: existing
          ? [...new Set([...existing.keywords, ...r.keywords])]
          : r.keywords,
      });
    } else if (existing) {
      existing.keywords = [...new Set([...existing.keywords, ...r.keywords])];
    }
  }

  return Array.from(map.values());
}

/**
 * Avoid categories: union all.
 */
function mergeAvoidCategories(a: AvoidCategory[], b: AvoidCategory[]): AvoidCategory[] {
  const map = new Map<string, AvoidCategory>();
  for (const cat of [...a, ...b]) {
    if (!map.has(cat.category)) {
      map.set(cat.category, cat);
    }
  }
  return Array.from(map.values());
}

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * Map mainGoal values to the protocol names they should prefer as base.
 */
const GOAL_TO_PROTOCOL: Record<string, string> = {
  lose_weight: 'Redukcja masy ciała',
  gain_muscle: 'Masa mięśniowa / Sportowiec',
  maintain_weight: 'Standard WHO',
  improve_health: 'Standard WHO',
};

/**
 * Merge multiple protocols into a single effective protocol.
 * Priority order: protocols[0] is highest priority (most restrictive wins per param).
 *
 * @param matchedProtocols - Matched triggers, sorted by priority
 * @param dietitianOverrideId - Optional dietitian-assigned protocol (takes precedence on non-safety params)
 * @param patientGoal - Patient's mainGoal (used for goal-aware base selection among same-priority protocols)
 */
export async function mergeProtocols(
  matchedProtocols: MatchedProtocol[],
  dietitianOverrideId?: string | null,
  patientGoal?: string | null,
): Promise<MergedProtocol | null> {
  if (matchedProtocols.length === 0 && !dietitianOverrideId) {
    return null;
  }

  // Fetch full protocol data for each matched protocol
  const protocolIds = [...new Set(matchedProtocols.map((m) => m.protocolId))];
  if (dietitianOverrideId && !protocolIds.includes(dietitianOverrideId)) {
    protocolIds.push(dietitianOverrideId);
  }

  const rawProtocols = await prisma.nutritionProtocol.findMany({
    where: { id: { in: protocolIds }, isActive: true },
  });

  const protocolMap = new Map<string, ResolvedProtocol>();
  for (const raw of rawProtocols) {
    protocolMap.set(raw.id, deserializeProtocol(raw));
  }

  // Build ordered list: dietitian override first (if any), then matched by priority
  const ordered: ResolvedProtocol[] = [];
  if (dietitianOverrideId && protocolMap.has(dietitianOverrideId)) {
    ordered.push(protocolMap.get(dietitianOverrideId)!);
  }
  for (const m of matchedProtocols) {
    const p = protocolMap.get(m.protocolId);
    if (p && !ordered.some((o) => o.id === p.id)) {
      ordered.push(p);
    }
  }

  if (ordered.length === 0) return null;

  // Goal-aware base selection: among protocols with the same (best) priority,
  // prefer the one matching patient's mainGoal to avoid contradictory base
  let base = ordered[0];
  if (patientGoal && ordered.length > 1) {
    const preferredName = GOAL_TO_PROTOCOL[patientGoal];
    if (preferredName) {
      const bestPriority = matchedProtocols.find((m) => m.protocolId === base.id)?.priority ?? 99;
      // Only re-order among same-priority protocols (don't demote disease protocols)
      const goalMatch = ordered.find((p) => {
        if (p.id === base.id) return false;
        const pPriority = matchedProtocols.find((m) => m.protocolId === p.id)?.priority ?? 99;
        return pPriority === bestPriority && p.name === preferredName;
      });
      if (goalMatch) {
        // Swap: goal-matching protocol becomes base
        const idx = ordered.indexOf(goalMatch);
        ordered[idx] = base;
        ordered[0] = goalMatch;
        base = goalMatch;
        console.log(`[merge] Goal-aware base swap: "${base.name}" preferred over "${ordered[idx].name}" for goal "${patientGoal}"`);
      }
    }
  }
  const explanation: Record<string, string> = {};

  let mergedMacros = base.macroRatios;
  let mergedCaloric = base.caloricAdjustments;
  let mergedMinProtein = base.minProteinPerKg;
  let mergedMaxProtein = base.maxProteinPerKg;
  let mergedRestrictions = base.foodRestrictions;
  let mergedAvoid = base.avoidFoodCategories;
  let mergedCuisines = [...base.preferredCuisines];
  let mergedPrompt = base.systemPromptAdditions ?? '';

  explanation['base'] = `Base: ${base.name} (id: ${base.id})`;

  // Merge subsequent protocols
  for (let i = 1; i < ordered.length; i++) {
    const p = ordered[i];

    mergedMacros = mergeMacroRatios(mergedMacros, p.macroRatios);
    explanation[`macros_${p.id}`] = `Macro ratios merged with ${p.name}`;

    mergedCaloric = mergeCaloricAdjustments(mergedCaloric, p.caloricAdjustments);
    explanation[`caloric_${p.id}`] = `Caloric adjustments merged with ${p.name}`;

    // Protein: more restrictive = lower max, higher min
    if (p.maxProteinPerKg < mergedMaxProtein) {
      mergedMaxProtein = p.maxProteinPerKg;
      explanation[`maxProtein_${p.id}`] = `Max protein/kg capped by ${p.name}: ${p.maxProteinPerKg}`;
    }
    if (p.minProteinPerKg > mergedMinProtein) {
      mergedMinProtein = p.minProteinPerKg;
      explanation[`minProtein_${p.id}`] = `Min protein/kg raised by ${p.name}: ${p.minProteinPerKg}`;
    }

    // If min > max after merge, cap min to max (safety)
    if (mergedMinProtein > mergedMaxProtein) {
      mergedMinProtein = mergedMaxProtein;
      explanation['proteinClamp'] = `Min protein clamped to max (${mergedMaxProtein} g/kg) due to conflicting protocols`;
    }

    mergedRestrictions = mergeFoodRestrictions(mergedRestrictions, p.foodRestrictions);
    mergedAvoid = mergeAvoidCategories(mergedAvoid, p.avoidFoodCategories);

    // Cuisines: intersection (both must agree)
    if (p.preferredCuisines.length > 0) {
      const pSet = new Set(p.preferredCuisines);
      mergedCuisines = mergedCuisines.filter((c) => pSet.has(c));
    }

    // Prompt additions: concatenate
    if (p.systemPromptAdditions) {
      mergedPrompt = mergedPrompt
        ? `${mergedPrompt}\n\n--- ${p.name} ---\n${p.systemPromptAdditions}`
        : p.systemPromptAdditions;
    }
  }

  const sourceProtocols = ordered.map((p) => {
    const trigger = matchedProtocols.find((m) => m.protocolId === p.id);
    return {
      id: p.id,
      name: p.name,
      priority: trigger?.priority ?? 0,
      triggerField: trigger?.interviewField ?? (dietitianOverrideId === p.id ? 'dietitianOverride' : 'unknown'),
      triggerValue: trigger?.interviewValue ?? '',
    };
  });

  return {
    ...base,
    macroRatios: mergedMacros,
    caloricAdjustments: mergedCaloric,
    minProteinPerKg: mergedMinProtein,
    maxProteinPerKg: mergedMaxProtein,
    foodRestrictions: mergedRestrictions,
    avoidFoodCategories: mergedAvoid,
    preferredCuisines: mergedCuisines,
    systemPromptAdditions: mergedPrompt || null,
    sourceProtocols,
    mergeExplanation: explanation,
  };
}
