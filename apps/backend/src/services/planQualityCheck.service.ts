/**
 * Plan Quality Check Service — Phase 3 verification.
 *
 * Validates the AI-generated plan BEFORE saving to DB.
 * Checks for completeness, restricted ingredients, recipe quality,
 * and placeholder names. Returns a list of issues that can be
 * auto-fixed or sent back to AI for repair.
 */

import type { PlanContent, PlanDay, PlanMeal } from './planValidation.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QualityIssue {
  type:
    | 'MISSING_RECIPE'
    | 'SHORT_RECIPE'
    | 'PLACEHOLDER_NAME'
    | 'ENGLISH_MEAL_NAME'
    | 'MISSING_INGREDIENTS'
    | 'EMPTY_ITEM_NAME'
    | 'ZERO_GRAMS'
    | 'RESTRICTED_INGREDIENT'
    | 'DUPLICATE_DISH'
    | 'MISSING_DAY';
  severity: 'ERROR' | 'WARNING';
  day: string;
  mealName: string;
  detail: string;
  /** Can be auto-fixed without AI */
  autoFixable: boolean;
}

export interface QualityCheckResult {
  passed: boolean;
  issues: QualityIssue[];
  /** Issues that were auto-fixed */
  autoFixed: QualityIssue[];
  /** Meals that need AI repair (grouped by day) */
  mealsNeedingRepair: Array<{ day: string; mealName: string; reason: string }>;
  summary: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_RECIPE_STEPS = 3;
const EXPECTED_DAYS = 7;

const POLISH_MEAL_NAMES = new Set([
  'Śniadanie', 'II Śniadanie', 'Obiad', 'Podwieczorek', 'Kolacja',
]);

const ENGLISH_TO_POLISH: Record<string, string> = {
  breakfast: 'Śniadanie',
  lunch: 'II Śniadanie',
  snack: 'Podwieczorek',
  dinner: 'Obiad',
  supper: 'Kolacja',
};

const PLACEHOLDER_PATTERNS = [
  /^Posiłek\s*\(/i,
  /do uzupełnienia/i,
  /placeholder/i,
  /TODO/i,
];

const DAY_NAMES_PL = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

// ─── Main function ───────────────────────────────────────────────────────────

/**
 * Runs quality checks on a plan and auto-fixes what it can.
 * Returns issues that couldn't be fixed (need AI repair or manual review).
 */
export function checkPlanQuality(
  content: PlanContent,
  excludeKeywords?: string[],
): QualityCheckResult {
  const issues: QualityIssue[] = [];
  const autoFixed: QualityIssue[] = [];

  if (!content?.days || content.days.length === 0) {
    return {
      passed: false,
      issues: [{ type: 'MISSING_DAY', severity: 'ERROR', day: '', mealName: '', detail: 'Plan nie zawiera żadnych dni', autoFixable: false }],
      autoFixed: [],
      mealsNeedingRepair: [],
      summary: 'Plan jest pusty — brak dni.',
    };
  }

  // Check missing days
  const existingDays = new Set(content.days.map(d => d.day));
  for (const dayName of DAY_NAMES_PL) {
    if (!existingDays.has(dayName)) {
      issues.push({
        type: 'MISSING_DAY',
        severity: 'ERROR',
        day: dayName,
        mealName: '',
        detail: `Brakuje dnia: ${dayName}`,
        autoFixable: false,
      });
    }
  }

  // Track dish names for duplicate detection
  const dishNames = new Map<string, string>(); // name → first day

  for (const day of content.days) {
    for (const meal of day.meals) {
      // 1. English meal names → auto-fix
      if (ENGLISH_TO_POLISH[meal.name.toLowerCase()]) {
        const fixedIssue: QualityIssue = {
          type: 'ENGLISH_MEAL_NAME',
          severity: 'WARNING',
          day: day.day,
          mealName: meal.name,
          detail: `Angielska nazwa "${meal.name}" → "${ENGLISH_TO_POLISH[meal.name.toLowerCase()]}"`,
          autoFixable: true,
        };
        meal.name = ENGLISH_TO_POLISH[meal.name.toLowerCase()];
        autoFixed.push(fixedIssue);
      }

      // 2. Check recipe existence and quality
      if (!meal.recipe || !Array.isArray(meal.recipe.steps) || meal.recipe.steps.length === 0) {
        issues.push({
          type: 'MISSING_RECIPE',
          severity: 'ERROR',
          day: day.day,
          mealName: meal.name,
          detail: `Brak przepisu dla "${meal.name}"`,
          autoFixable: false,
        });
      } else if (meal.recipe.steps.length < MIN_RECIPE_STEPS) {
        issues.push({
          type: 'SHORT_RECIPE',
          severity: 'WARNING',
          day: day.day,
          mealName: meal.name,
          detail: `Przepis ma tylko ${meal.recipe.steps.length} krok(i), minimum to ${MIN_RECIPE_STEPS}`,
          autoFixable: false,
        });
      }

      for (const item of meal.items) {
        // 3. Placeholder names → auto-fix from ingredients
        const isPlaceholder = PLACEHOLDER_PATTERNS.some(p => p.test(item.name));
        if (isPlaceholder) {
          const ingredientNames = (item.ingredients ?? [])
            .map((ing: { name: string }) => ing.name)
            .filter((n: string) => n && !PLACEHOLDER_PATTERNS.some(p => p.test(n)))
            .slice(0, 3);

          if (ingredientNames.length > 0) {
            const oldName = item.name;
            item.name = `${meal.name}: ${ingredientNames.join(', ')}`;
            autoFixed.push({
              type: 'PLACEHOLDER_NAME',
              severity: 'WARNING',
              day: day.day,
              mealName: meal.name,
              detail: `Placeholder "${oldName}" → "${item.name}"`,
              autoFixable: true,
            });
          } else {
            issues.push({
              type: 'PLACEHOLDER_NAME',
              severity: 'ERROR',
              day: day.day,
              mealName: meal.name,
              detail: `Placeholder nazwa "${item.name}" bez składników do wygenerowania nazwy`,
              autoFixable: false,
            });
          }
        }

        // 4. Empty item name
        if (!item.name || item.name.trim().length === 0) {
          issues.push({
            type: 'EMPTY_ITEM_NAME',
            severity: 'ERROR',
            day: day.day,
            mealName: meal.name,
            detail: 'Posiłek bez nazwy',
            autoFixable: false,
          });
        }

        // 5. Missing ingredients
        if (!item.ingredients || !Array.isArray(item.ingredients) || item.ingredients.length === 0) {
          issues.push({
            type: 'MISSING_INGREDIENTS',
            severity: 'ERROR',
            day: day.day,
            mealName: meal.name,
            detail: `"${item.name}" nie ma składników`,
            autoFixable: false,
          });
        } else {
          // 6. Zero grams
          for (const ing of item.ingredients) {
            if (!ing.grams || Number(ing.grams) <= 0) {
              issues.push({
                type: 'ZERO_GRAMS',
                severity: 'WARNING',
                day: day.day,
                mealName: meal.name,
                detail: `Składnik "${ing.name}" ma gramaturę 0 lub brak`,
                autoFixable: false,
              });
            }
          }

          // 7. Restricted ingredients check
          if (excludeKeywords?.length) {
            for (const ing of item.ingredients) {
              const lower = (ing.name ?? '').toLowerCase();
              for (const kw of excludeKeywords) {
                if (lower.includes(kw.toLowerCase())) {
                  issues.push({
                    type: 'RESTRICTED_INGREDIENT',
                    severity: 'ERROR',
                    day: day.day,
                    mealName: meal.name,
                    detail: `Zabroniony składnik "${ing.name}" (zawiera "${kw}")`,
                    autoFixable: false,
                  });
                }
              }
            }
          }
        }

        // 8. Duplicate dish names (across all days)
        const normalized = item.name.toLowerCase().trim();
        if (normalized.length > 3) {
          const firstSeen = dishNames.get(normalized);
          if (firstSeen && firstSeen !== day.day) {
            issues.push({
              type: 'DUPLICATE_DISH',
              severity: 'WARNING',
              day: day.day,
              mealName: meal.name,
              detail: `"${item.name}" powtarza się (pierwsze wystąpienie: ${firstSeen})`,
              autoFixable: false,
            });
          } else {
            dishNames.set(normalized, day.day);
          }
        }
      }
    }
  }

  // Build meals needing repair (ERROR-level issues only)
  const repairSet = new Map<string, string>();
  for (const issue of issues) {
    if (issue.severity === 'ERROR' && issue.day && issue.mealName) {
      const key = `${issue.day}|${issue.mealName}`;
      if (!repairSet.has(key)) {
        repairSet.set(key, issue.detail);
      }
    }
  }

  const mealsNeedingRepair = [...repairSet.entries()].map(([key, reason]) => {
    const [day, mealName] = key.split('|');
    return { day, mealName, reason };
  });

  // Build summary
  const errorCount = issues.filter(i => i.severity === 'ERROR').length;
  const warningCount = issues.filter(i => i.severity === 'WARNING').length;
  const parts: string[] = [];
  if (autoFixed.length > 0) parts.push(`${autoFixed.length} automatycznie naprawionych`);
  if (errorCount > 0) parts.push(`${errorCount} błędów`);
  if (warningCount > 0) parts.push(`${warningCount} ostrzeżeń`);

  const passed = errorCount === 0;
  const summary = parts.length > 0
    ? `Weryfikacja jakości: ${parts.join(', ')}.${!passed ? ' Plan wymaga naprawy.' : ''}`
    : 'Weryfikacja jakości: plan bez zastrzeżeń.';

  if (issues.length > 0 || autoFixed.length > 0) {
    console.log(`[quality] Plan: ${summary}`);
    for (const issue of issues) {
      console.log(`[quality]   ${issue.severity}: [${issue.day}/${issue.mealName}] ${issue.detail}`);
    }
  }

  return { passed, issues, autoFixed, mealsNeedingRepair, summary };
}
