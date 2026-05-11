'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Recipe } from '@/types/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Badge } from '@/components/ui/badge';
import { Clock, ChefHat, Users, Timer, CheckCircle2, Circle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cleanIngredientName } from '@/lib/ingredient-display';
import type { RecipeIngredient } from '@/types/api';
import { Progress } from '@/components/ui/progress';

interface RecipeDetailSheetProps {
  recipeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  translationNamespace?: string;
  fetchFn?: (id: string, token: string) => Promise<{ ok: boolean; item: Recipe }>;
}

const DIFFICULTY_MAP: Record<string, { label: string; variant: 'brand-green' | 'brand-orange' | 'destructive' }> = {
  EASY: { label: 'difficultyEasy', variant: 'brand-green' },
  easy: { label: 'difficultyEasy', variant: 'brand-green' },
  MEDIUM: { label: 'difficultyMedium', variant: 'brand-orange' },
  medium: { label: 'difficultyMedium', variant: 'brand-orange' },
  HARD: { label: 'difficultyHard', variant: 'destructive' },
  hard: { label: 'difficultyHard', variant: 'destructive' },
};

const MEAL_TYPE_MAP: Record<string, string> = {
  BREAKFAST: 'mealBreakfast', breakfast: 'mealBreakfast',
  SECOND_BREAKFAST: 'mealSecondBreakfast', second_breakfast: 'mealSecondBreakfast',
  LUNCH: 'mealLunch', lunch: 'mealLunch',
  DINNER: 'mealDinner', dinner: 'mealDinner',
  SUPPER: 'mealSupper', supper: 'mealSupper',
  SNACK: 'mealSnack', snack: 'mealSnack',
  DESSERT: 'mealDessert', dessert: 'mealDessert',
  DRINK: 'mealDrink', drink: 'mealDrink',
  SAUCE: 'mealSauce', sauce: 'mealSauce',
  SIDE_DISH: 'mealSideDish', side_dish: 'mealSideDish',
};

const CATEGORY_MAP: Record<string, string> = {
  main: 'categoryMain',
  'dania główne': 'categoryMain',
  soup: 'categorySoup',
  zupy: 'categorySoup',
  salad: 'categorySalad',
  'sałatki': 'categorySalad',
  dessert: 'categoryDessert',
  desery: 'categoryDessert',
  other: 'categoryOther',
  inne: 'categoryOther',
};

export function RecipeDetailSheet({
  recipeId,
  open,
  onOpenChange,
  token,
  translationNamespace = 'dietitian.recipes',
  fetchFn,
}: RecipeDetailSheetProps) {
  const t = useTranslations(translationNamespace);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !recipeId) {
      setRecipe(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const result = fetchFn
          ? await fetchFn(recipeId, token)
          : await api.recipes.getById(recipeId, token);
        if (!cancelled) setRecipe(result.item);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [open, recipeId, token, fetchFn]);

  const difficultyInfo = recipe?.difficulty ? DIFFICULTY_MAP[recipe.difficulty] : null;
  const mealTypeKey = recipe?.mealType ? MEAL_TYPE_MAP[recipe.mealType] : null;
  const categoryKey = recipe?.category ? CATEGORY_MAP[recipe.category.toLowerCase()] : null;

  const nutrition = recipe?.nutritionSnapshot;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <VisuallyHidden.Root><SheetTitle>Loading</SheetTitle></VisuallyHidden.Root>
            <p className="text-muted-foreground">{t('loading')}</p>
          </div>
        ) : recipe ? (
          <>
            {/* Header */}
            <SheetHeader className="pb-4">
              <SheetTitle className="text-xl leading-tight pr-8">{recipe.name}</SheetTitle>

              {/* Auto-filled tag badges */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {categoryKey && (
                  <Badge variant="secondary">{t(categoryKey)}</Badge>
                )}
                {!categoryKey && recipe.category && (
                  <Badge variant="secondary">{recipe.category}</Badge>
                )}
                {mealTypeKey && (
                  <Badge variant="ai-blue">{t(mealTypeKey)}</Badge>
                )}
                {!mealTypeKey && recipe.mealType && (
                  <Badge variant="ai-blue">{recipe.mealType}</Badge>
                )}
                {difficultyInfo && (
                  <Badge variant={difficultyInfo.variant}>{t(difficultyInfo.label)}</Badge>
                )}
                {!difficultyInfo && recipe.difficulty && (
                  <Badge variant="outline">{recipe.difficulty}</Badge>
                )}
              </div>

              {/* Tags */}
              {recipe.tags && recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {recipe.tags.map((tag) => (
                    <Badge key={tag} variant="sage-outline" className="text-[11px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </SheetHeader>

            <div className="px-6 pb-6 space-y-6">
              {/* Time & servings bar */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {recipe.prepTimeMinutes != null && (
                  <div className="flex items-center gap-1.5">
                    <Timer className="h-4 w-4" />
                    <span>{t('prepTime')}: {recipe.prepTimeMinutes} {t('min')}</span>
                  </div>
                )}
                {recipe.cookTimeMinutes != null && (
                  <div className="flex items-center gap-1.5">
                    <ChefHat className="h-4 w-4" />
                    <span>{t('cookTime')}: {recipe.cookTimeMinutes} {t('min')}</span>
                  </div>
                )}
                {recipe.totalTimeMinutes != null && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>{t('totalTime')}: {recipe.totalTimeMinutes} {t('min')}</span>
                  </div>
                )}
                {recipe.servings != null && (
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <span>{t('servings')}: {recipe.servings}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {recipe.description && (
                <div>
                  <h3 className="font-semibold text-sm mb-1">{t('description')}</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{recipe.description}</p>
                </div>
              )}

              {/* Nutrition snapshot */}
              {nutrition && (nutrition.kcal != null || nutrition.protein_g != null) && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">{t('nutritionTitle')}</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {nutrition.kcal != null && (
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <div className="text-lg font-bold">{Math.round(nutrition.kcal)}</div>
                        <div className="text-[11px] text-muted-foreground">{t('kcal')}</div>
                      </div>
                    )}
                    {nutrition.protein_g != null && (
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <div className="text-lg font-bold">{Math.round(nutrition.protein_g)}g</div>
                        <div className="text-[11px] text-muted-foreground">{t('protein')}</div>
                      </div>
                    )}
                    {nutrition.fat_g != null && (
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <div className="text-lg font-bold">{Math.round(nutrition.fat_g)}g</div>
                        <div className="text-[11px] text-muted-foreground">{t('fat')}</div>
                      </div>
                    )}
                    {nutrition.carbs_g != null && (
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <div className="text-lg font-bold">{Math.round(nutrition.carbs_g)}g</div>
                        <div className="text-[11px] text-muted-foreground">{t('carbs')}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quality checklist */}
              {recipe.qualityScore != null && (
                <RecipeQualityChecklist recipe={recipe} t={t} />
              )}

              {/* Ingredients */}
              <div>
                <h3 className="font-semibold text-sm mb-2">{t('ingredients')}</h3>
                {recipe.ingredients && recipe.ingredients.length > 0 ? (
                  <IngredientsList ingredients={recipe.ingredients} t={t} />
                ) : (
                  <p className="text-sm text-muted-foreground">{t('noIngredients')}</p>
                )}
              </div>

              {/* Preparation steps */}
              <div>
                <h3 className="font-semibold text-sm mb-3">{t('preparation')}</h3>
                {recipe.steps && recipe.steps.length > 0 ? (
                  <ol className="space-y-4">
                    {recipe.steps
                      .sort((a, b) => a.stepNumber - b.stepNumber)
                      .map((step) => (
                        <li key={step.id} className="flex gap-3">
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                            {step.stepNumber}
                          </div>
                          <div className="flex-1 pt-0.5">
                            <p className="text-sm whitespace-pre-line">{step.instruction}</p>
                            {step.durationMinutes != null && (
                              <span className="inline-flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {step.durationMinutes} {t('min')}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('noSteps')}</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <SheetHeader>
            <SheetTitle>{t('detailTitle')}</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Quality Checklist ───────────────────────────────────────────────────────

interface QualityCriterion {
  key: string;
  label: string;
  points: number;
  check: (r: Recipe) => boolean;
}

const QUALITY_CRITERIA: QualityCriterion[] = [
  { key: 'has_title',         label: 'qualityHasTitle',        points: 5,  check: (r) => !!r.name?.trim() },
  { key: 'has_description',   label: 'qualityHasDescription',  points: 5,  check: (r) => !!r.description?.trim() },
  { key: 'has_category',      label: 'qualityHasCategory',     points: 5,  check: (r) => !!r.category?.trim() },
  { key: 'has_meal_type',     label: 'qualityHasMealType',     points: 5,  check: (r) => !!r.mealType },
  { key: 'has_difficulty',    label: 'qualityHasDifficulty',   points: 5,  check: (r) => !!r.difficulty },
  { key: 'has_2_ingredients', label: 'qualityHas2Ingredients', points: 10, check: (r) => (r.ingredients?.filter(i => i.cleanProductId || i.foodProductId).length ?? 0) >= 2 },
  { key: 'all_linked',       label: 'qualityAllLinked',       points: 10, check: (r) => (r.ingredients?.length ?? 0) > 0 && (r.ingredients?.every(i => i.cleanProductId || i.foodProductId) ?? false) },
  { key: 'has_2_steps',      label: 'qualityHas2Steps',       points: 10, check: (r) => (r.steps?.length ?? 0) >= 2 },
  { key: 'has_times',        label: 'qualityHasTimes',        points: 5,  check: (r) => ((r.prepTimeMinutes ?? 0) + (r.cookTimeMinutes ?? 0)) > 0 },
  { key: 'has_serving_weight',label: 'qualityHasServingWeight',points: 5,  check: (r) => (Number(r.servingWeightG) || 0) > 0 },
  { key: 'has_nutrition',    label: 'qualityHasNutrition',    points: 15, check: (r) => !!r.nutritionSnapshot },
  { key: 'has_allergens',    label: 'qualityHasAllergens',    points: 10, check: (r) => (r.allergens?.length ?? 0) > 0 },
  { key: 'has_diet_flags',   label: 'qualityHasDietFlags',    points: 10, check: (r) => (r.dietFlags?.length ?? 0) > 0 },
];

function RecipeQualityChecklist({ recipe, t }: { recipe: Recipe; t: ReturnType<typeof useTranslations> }) {
  const [expanded, setExpanded] = useState(false);
  const score = recipe.qualityScore ?? 0;
  const color = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';
  const progressColor = score >= 70 ? '[&>div]:bg-green-600' : score >= 40 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500';

  const results = QUALITY_CRITERIA.map((c) => ({
    ...c,
    passed: c.check(recipe),
  }));

  const passedCount = results.filter((r) => r.passed).length;

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex items-center justify-between w-full px-4 py-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-sm font-semibold">{t('qualityChecklist')}</span>
          <span className={cn('text-sm font-bold', color)}>
            {t('qualityScore', { score })}
          </span>
          <span className="text-xs text-muted-foreground">
            ({passedCount}/{results.length})
          </span>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      <div className="px-4 pb-1">
        <Progress value={score} className={cn('h-2', progressColor)} />
      </div>

      {expanded && (
        <ul className="px-4 pb-3 pt-2 space-y-1.5">
          {results.map((r) => (
            <li key={r.key} className="flex items-center gap-2 text-sm">
              {r.passed ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              )}
              <span className={cn(!r.passed && 'text-muted-foreground')}>
                {t(r.label)}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {r.passed ? `+${r.points}` : `0/${r.points}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Ingredients list with grouping, portions, and type badges ───────────────

function IngredientsList({
  ingredients,
  t,
}: {
  ingredients: RecipeIngredient[];
  t: (key: string) => string;
}) {
  const sorted = [...ingredients].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // Group ingredients by groupName
  const groups: Array<{ name: string | null; items: RecipeIngredient[] }> = [];
  let currentGroup: string | null | undefined = undefined;

  for (const ing of sorted) {
    if (ing.groupName !== currentGroup) {
      currentGroup = ing.groupName ?? null;
      groups.push({ name: currentGroup, items: [] });
    }
    groups[groups.length - 1].items.push(ing);
  }

  return (
    <div className="space-y-3">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.name && (
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 tracking-wide">
              {group.name}
            </h4>
          )}
          <ul className="space-y-1.5">
            {group.items.map((ing) => {
              const name =
                ing.cleanProduct?.name ??
                ing.foodProduct?.name ??
                cleanIngredientName(ing.displayName) ??
                '—';

              return (
                <li
                  key={ing.id}
                  className={cn(
                    'flex items-baseline gap-2 text-sm',
                    ing.isOptional && 'text-muted-foreground'
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  <span className="flex-1">
                    <span>{name}</span>
                    {' — '}
                    <span className="font-medium">{ing.grams}g</span>
                    {ing.quantity != null && ing.unit && ing.unit !== 'g' && (
                      <span className="text-muted-foreground ml-1">
                        ({ing.quantity} {ing.unit})
                      </span>
                    )}
                    {ing.isOptional && (
                      <span className="text-xs ml-1 italic">({t('optional')})</span>
                    )}
                    {ing.notes && (
                      <span className="text-xs text-muted-foreground ml-1">— {ing.notes}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
