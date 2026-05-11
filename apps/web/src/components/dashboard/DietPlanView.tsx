'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Flame, Beef, Droplet, Wheat, ShoppingCart, ChefHat, Clock, Lightbulb, ArrowLeftRight, CalendarDays, AlertTriangle, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight, LayoutGrid, CalendarCheck, Heart, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import type { DietPlan, DietPlanStatus } from '@/types/api';
import { api } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import { cleanIngredientName } from '@/lib/ingredient-display';
import { MealSwapModal } from './MealSwapModal';
import { MicronutrientPanel } from './MicronutrientPanel';
// DayRegenModal removed from patient view — dietitian still has regen in DietPlanEditor

function StatusBadge({ status }: { status: DietPlanStatus }) {
  const t = useTranslations('dashboard');

  const config: Record<DietPlanStatus, { label: string; variant: 'default' | 'sage-outline' | 'outline' }> = {
    AI_DRAFT:  { label: t('planAiDraft'),   variant: 'outline' },
    GENERATED: { label: t('planGenerated'), variant: 'outline' },
    REVIEWED:  { label: t('planReviewed'),  variant: 'sage-outline' },
    SENT:      { label: t('planSent'),      variant: 'sage-outline' },
    PUBLISHED: { label: t('planPublished'), variant: 'default' },
    MANUAL_REVIEW_REQUIRED: { label: t('planManualReview'), variant: 'outline' },
    GENERATION_FAILED: { label: t('planGenerationFailed'), variant: 'outline' },
  };

  const { label, variant } = config[status] ?? { label: status, variant: 'outline' };
  return <Badge variant={variant}>{label}</Badge>;
}

function MacroCard({ icon: Icon, label, value, unit }: {
  icon: React.ElementType;
  label: string;
  value: number | undefined;
  unit: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <Icon className="h-5 w-5 text-sage-500 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold leading-tight">{value} <span className="text-sm font-normal text-muted-foreground">{unit}</span></p>
      </div>
    </div>
  );
}

interface RecipeVariant {
  appliance: 'THERMOMIX' | 'AIRFRYER';
  prepTimeMin: number;
  steps: string[];
  tips?: string;
}

interface MealRecipe {
  prepTimeMin: number;
  steps: string[];
  tips?: string;
  variants?: RecipeVariant[];
}

interface MealItem {
  name: string;
  grams?: number;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  ingredients?: Array<{ name: string; grams: number }>;
}

function formatMealItem(item: string | MealItem): string {
  if (typeof item === 'string') return item;
  const parts = [item.name];
  if (item.grams) parts.push(`${item.grams}g`);
  const macros: string[] = [];
  if (item.kcal) macros.push(`${item.kcal} kcal`);
  if (item.protein) macros.push(`B: ${item.protein}g`);
  if (item.fat) macros.push(`T: ${item.fat}g`);
  if (item.carbs) macros.push(`W: ${item.carbs}g`);
  if (macros.length) parts.push(`(${macros.join(', ')})`);
  return parts.join(' — ');
}

const APPLIANCE_LABELS: Record<string, string> = {
  THERMOMIX: 'Thermomix',
  AIRFRYER: 'Airfryer',
};

function extractMealIngredients(meal: PlanMealFull): Array<{ name: string; grams: number }> {
  const result: Array<{ name: string; grams: number }> = [];
  for (const item of meal.items) {
    if (typeof item === 'object' && item !== null) {
      const obj = item as MealItem;
      if (obj.ingredients?.length) {
        for (const ing of obj.ingredients) {
          if (ing.name && ing.grams > 0) {
            result.push({
              name: cleanIngredientName(ing.name) ?? ing.name,
              grams: Number(ing.grams),
            });
          }
        }
      }
    }
  }
  return result;
}

function RecipeSteps({ recipe, ingredients, label }: {
  recipe: { prepTimeMin: number; steps: string[]; tips?: string };
  ingredients?: Array<{ name: string; grams: number }>;
  label?: string;
}) {
  const t = useTranslations('dashboard.plan');
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold text-sage-600 uppercase tracking-wide">{label}</p>}
      {/* Ingredient list with exact grams */}
      {ingredients && ingredients.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-sage-600 uppercase tracking-wide">
            {t('ingredients', { defaultMessage: 'Składniki' })}
          </p>
          <ul className="text-sm text-muted-foreground space-y-0.5 list-disc list-inside">
            {ingredients.map((ing, i) => (
              <li key={i}>
                {ing.name} — <span className="font-medium">{ing.grams}g</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>{recipe.prepTimeMin} {t('recipeMinutes')}</span>
      </div>
      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
        {recipe.steps.map((step, i) => <li key={i}>{step}</li>)}
      </ol>
      {recipe.tips && (
        <div className="flex items-start gap-2 text-xs text-sage-600 bg-sage-50 rounded-md px-3 py-2">
          <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{recipe.tips}</span>
        </div>
      )}
    </div>
  );
}

interface PlanMealFull {
  name: string;
  items: (string | MealItem)[];
  recipe?: MealRecipe;
  glycemicIndex?: number;
  reasons?: string[];
  cookingMethod?: string;
}

const COOKING_LABELS: Record<string, string> = {
  BAKED: 'Pieczony', BOILED: 'Gotowany', FRIED: 'Smażony',
  GRILLED: 'Grillowany', STEAMED: 'Na parze', RAW: 'Surowy',
};

function CookingBadge({ method }: { method: string | undefined }) {
  if (!method || method === 'OTHER') return null;
  const label = COOKING_LABELS[method];
  if (!label) return null;
  return <span className="inline-flex items-center text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{label}</span>;
}

function MealReasons({ reasons }: { reasons: string[] | undefined }) {
  if (!reasons || reasons.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reasons.map((r, i) => (
        <span key={i} className="inline-flex items-center text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
          {r}
        </span>
      ))}
    </div>
  );
}

function GiBadge({ gi }: { gi: number | undefined }) {
  if (gi == null || gi === 0) return null;
  const level = gi <= 55 ? 'low' : gi <= 69 ? 'medium' : 'high';
  const config = {
    low:    { label: `IG ${gi}`, className: 'bg-green-100 text-green-700 border-green-200' },
    medium: { label: `IG ${gi}`, className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    high:   { label: `IG ${gi}`, className: 'bg-red-100 text-red-700 border-red-200' },
  };
  const { label, className } = config[level];
  return <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full border ${className}`}>{label}</span>;
}

interface MealPlanContentProps {
  days: Array<{ day: string; meals: PlanMealFull[] }>;
  swapEnabled?: boolean;
  onSwapClick?: (dayIndex: number, mealIndex: number, mealName: string) => void;
  ratingEnabled?: boolean;
  mealRatings?: Record<string, number>;
  onRateMeal?: (mealName: string, rating: number) => void;
  favorites?: string[];
  onToggleFavorite?: (mealName: string) => void;
}

function MealPlanContent({ days, swapEnabled, onSwapClick, ratingEnabled, mealRatings, onRateMeal, favorites, onToggleFavorite }: MealPlanContentProps) {
  const t = useTranslations('dashboard.plan');

  // 64.1: Day-by-day view toggle (SSR-safe: always start with 'week', hydrate from localStorage)
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

  useEffect(() => {
    const saved = localStorage.getItem('plan-view-mode') as 'week' | 'day' | null;
    if (saved) {
      setViewMode(saved);
    } else if (window.innerWidth < 768) {
      setViewMode('day');
    }
  }, []);
  const todayIndex = new Date().getDay();
  const polishDayNames = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const todayPl = polishDayNames[todayIndex];
  const defaultDay = days.findIndex((d) => d.day.toLowerCase().includes(todayPl));
  const [currentDay, setCurrentDay] = useState(defaultDay >= 0 ? defaultDay : 0);

  function toggleView(mode: 'week' | 'day') {
    setViewMode(mode);
    try { localStorage.setItem('plan-view-mode', mode); } catch { /* SSR-safe */ }
  }

  const visibleDays = viewMode === 'day' ? [days[currentDay]] : days;

  return (
    <div className="space-y-4">
      {/* View toggle + day nav */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <Button
            variant={viewMode === 'day' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 sm:h-7 text-xs px-2"
            onClick={() => toggleView('day')}
          >
            <CalendarCheck className="h-3 w-3 mr-1" />{t('viewDay')}
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 sm:h-7 text-xs px-2"
            onClick={() => toggleView('week')}
          >
            <LayoutGrid className="h-3 w-3 mr-1" />{t('viewWeek')}
          </Button>
        </div>

        {viewMode === 'day' && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-9 w-9 sm:h-7 sm:w-7 p-0" disabled={currentDay <= 0} onClick={() => setCurrentDay((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex gap-1">
              {days.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentDay(i)}
                  className={`text-xs px-2 py-1 sm:px-1.5 sm:py-0.5 rounded ${i === currentDay ? 'bg-brand-green text-white font-semibold' : 'text-muted-foreground hover:bg-muted'} ${d.day.toLowerCase().includes(todayPl) ? 'underline' : ''}`}
                >
                  {d.day.slice(0, 3)}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="h-9 w-9 sm:h-7 sm:w-7 p-0" disabled={currentDay >= days.length - 1} onClick={() => setCurrentDay((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {visibleDays.map((d, di) => {
        const actualIndex = viewMode === 'day' ? currentDay : di;
        return (
        <div key={actualIndex} className="rounded-lg border border-border overflow-hidden">
          <div className={`bg-sage-50 px-4 py-2 font-semibold text-sm text-sage-800 flex items-center justify-between ${d.day.toLowerCase().includes(todayPl) ? 'bg-brand-green/10 text-brand-green' : ''}`}>
            <div className="flex items-center gap-2">
              {d.day}
              {d.day.toLowerCase().includes(todayPl) && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t('today')}</Badge>}
            </div>
          </div>
          <div className="divide-y divide-border">
            {d.meals?.map((meal, mi) => (
              <div key={mi} className="px-4 py-3">
                <div className="mb-1">
                  {/* Row 1: Meal name + action buttons */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{meal.name}</p>
                    <div className="flex items-center gap-1">
                      {ratingEnabled && onRateMeal && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-9 w-9 sm:h-7 sm:w-7 p-0 ${mealRatings?.[meal.name] === 4 ? 'text-green-600 bg-green-50' : 'text-muted-foreground hover:text-green-600'}`}
                            onClick={() => onRateMeal(meal.name, mealRatings?.[meal.name] === 4 ? 0 : 4)}
                            title={t('rateUp')}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-9 w-9 sm:h-7 sm:w-7 p-0 ${mealRatings?.[meal.name] === 2 ? 'text-red-600 bg-red-50' : 'text-muted-foreground hover:text-red-600'}`}
                            onClick={() => onRateMeal(meal.name, mealRatings?.[meal.name] === 2 ? 0 : 2)}
                            title={t('rateDown')}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {onToggleFavorite && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-9 w-9 sm:h-7 sm:w-7 p-0 ${favorites?.includes(meal.name) ? 'text-pink-500' : 'text-muted-foreground hover:text-pink-500'}`}
                          onClick={() => onToggleFavorite(meal.name)}
                          title={favorites?.includes(meal.name) ? t('unfavorite') : t('favorite')}
                        >
                          <Heart className={`h-3.5 w-3.5 ${favorites?.includes(meal.name) ? 'fill-current' : ''}`} />
                        </Button>
                      )}
                      {swapEnabled && onSwapClick && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-sage-600 hover:text-sage-800 gap-1.5"
                          onClick={() => onSwapClick(actualIndex, mi, meal.name)}
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                          {t('swapButton')}
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Row 2: Badges + reasons */}
                  {(meal.glycemicIndex || meal.cookingMethod || (meal.reasons && meal.reasons.length > 0)) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <GiBadge gi={meal.glycemicIndex} />
                      <CookingBadge method={meal.cookingMethod} />
                      {meal.reasons?.map((r, ri) => (
                        <span key={ri} className="inline-flex items-center text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {meal.items?.length > 0 && (
                  <ul className="text-sm text-muted-foreground space-y-0.5 list-disc list-inside">
                    {meal.items.map((item, ii) => <li key={ii}>{formatMealItem(item)}</li>)}
                  </ul>
                )}
                {meal.recipe && meal.recipe.steps?.length > 0 && (
                  <Accordion type="single" collapsible className="mt-2">
                    <AccordionItem value={`recipe-${di}-${mi}`} className="border-none">
                      <AccordionTrigger className="py-2 text-xs font-medium text-sage-600 hover:text-sage-800">
                        <span className="flex items-center gap-1.5">
                          <ChefHat className="h-3.5 w-3.5" />
                          {t('recipeTitle')}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-2 pt-0">
                        <div className="space-y-4">
                          <RecipeSteps
                            recipe={meal.recipe}
                            ingredients={extractMealIngredients(meal)}
                          />
                          {meal.recipe.variants?.map((variant, vi) => (
                            <RecipeSteps
                              key={vi}
                              recipe={variant}
                              label={APPLIANCE_LABELS[variant.appliance] ?? variant.appliance}
                            />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
            ))}
          </div>
        </div>
      );
      })}
    </div>
  );
}

function formatShoppingItem(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    // Format: {name, totalGrams, category?, usedIn?, pieces?}
    if (typeof obj.name === 'string') {
      const parts = [obj.name];
      if (obj.totalGrams) parts.push(`— ${obj.totalGrams}g`);
      if (obj.pieces) parts.push(`(${obj.pieces} szt.)`);
      return parts.join(' ');
    }
  }
  return String(item);
}

function ShoppingListContent({ items }: { items: unknown }) {
  // Support: string[], Array<{category, items}>, Array<{name, totalGrams, ...}>, and Record<string, string[]>
  if (Array.isArray(items)) {
    // Check if array contains categorized groups: [{category: string, items: [...]}, ...]
    if (items.length > 0 && typeof items[0] === 'object' && items[0] !== null && 'category' in items[0] && 'items' in items[0]) {
      const categorized = items as Array<{ category: string; items: unknown[] }>;
      return (
        <div className="space-y-4">
          {categorized.map((group, gi) => (
            <div key={gi}>
              <p className="text-sm font-semibold mb-1 text-sage-700">{group.category}</p>
              <ul className="text-sm text-foreground list-disc list-inside space-y-0.5">
                {group.items.map((p, i) => <li key={i}>{formatShoppingItem(p)}</li>)}
              </ul>
            </div>
          ))}
        </div>
      );
    }

    // Flat array — items can be strings or product objects
    // Group by category if product objects have one
    const hasCategory = items.length > 0 && typeof items[0] === 'object' && items[0] !== null && 'category' in items[0];
    if (hasCategory) {
      const groups = new Map<string, unknown[]>();
      for (const item of items) {
        const cat = (typeof item === 'object' && item !== null && 'category' in item)
          ? String((item as Record<string, unknown>).category)
          : 'Inne';
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat)!.push(item);
      }
      return (
        <div className="space-y-4">
          {Array.from(groups.entries()).map(([category, products]) => (
            <div key={category}>
              <p className="text-sm font-semibold mb-1 text-sage-700">{category}</p>
              <ul className="text-sm text-foreground list-disc list-inside space-y-0.5">
                {products.map((p, i) => <li key={i}>{formatShoppingItem(p)}</li>)}
              </ul>
            </div>
          ))}
        </div>
      );
    }

    return (
      <ul className="columns-1 sm:columns-2 gap-x-6 text-sm text-foreground list-disc list-inside space-y-1">
        {items.map((item, i) => <li key={i}>{formatShoppingItem(item)}</li>)}
      </ul>
    );
  }

  if (items && typeof items === 'object') {
    const categorized = items as Record<string, unknown[]>;
    return (
      <div className="space-y-4">
        {Object.entries(categorized).map(([category, products]) => (
          <div key={category}>
            <p className="text-sm font-semibold mb-1 text-sage-700">{category}</p>
            <ul className="text-sm text-foreground list-disc list-inside space-y-0.5">
              {Array.isArray(products) ? products.map((p, i) => <li key={i}>{formatShoppingItem(p)}</li>) : null}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

interface PlanContentProps {
  content: Record<string, unknown>;
  swapEnabled?: boolean;
  onSwapClick?: (dayIndex: number, mealIndex: number, mealName: string) => void;
  ratingEnabled?: boolean;
  mealRatings?: Record<string, number>;
  onRateMeal?: (mealName: string, rating: number) => void;
  favorites?: string[];
  onToggleFavorite?: (mealName: string) => void;
}

function PlanContent({ content, swapEnabled, onSwapClick, ratingEnabled, mealRatings, onRateMeal, favorites, onToggleFavorite }: PlanContentProps) {
  const t = useTranslations('dashboard.plan');

  const days = content.days as Array<{ day: string; meals: Array<{ name: string; items: string[] }> }> | undefined;
  const shoppingList = content.shoppingList;
  const text = content.text as string | undefined;

  if (!days?.length && !text && !shoppingList) {
    return <p className="text-sm text-muted-foreground italic">{t('noContent')}</p>;
  }

  return (
    <div className="space-y-6">
      {days?.length ? (
        <MealPlanContent days={days} swapEnabled={swapEnabled} onSwapClick={onSwapClick} ratingEnabled={ratingEnabled} mealRatings={mealRatings} onRateMeal={onRateMeal} favorites={favorites} onToggleFavorite={onToggleFavorite} />
      ) : text ? (
        <pre className="text-sm whitespace-pre-wrap text-foreground font-sans leading-relaxed">{text}</pre>
      ) : null}

      {shoppingList != null && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="h-4 w-4 text-sage-500" />
            <h3 className="text-sm font-semibold">{t('shoppingListTitle')}</h3>
          </div>
          <ShoppingListContent items={shoppingList} />
        </div>
      )}
    </div>
  );
}

function WeeklyCookingTime({ days, t }: {
  days: Array<{ meals: Array<{ recipe?: { prepTimeMin?: number } }> }>;
  t: ReturnType<typeof useTranslations>;
}) {
  let totalMinutes = 0;
  let recipeCount = 0;
  let totalRecipes = 0;

  for (const day of days) {
    for (const meal of day.meals ?? []) {
      if (meal.recipe) {
        totalRecipes++;
        if (meal.recipe.prepTimeMin) {
          totalMinutes += meal.recipe.prepTimeMin;
          recipeCount++;
        }
      }
    }
  }

  if (recipeCount === 0) return null;

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <Clock className="h-4 w-4 text-sage-500 shrink-0" />
      <div className="text-sm">
        <span className="font-medium">{t('weeklyCookingTime')}: ~{timeStr}</span>
        {recipeCount < totalRecipes && (
          <span className="text-xs text-muted-foreground ml-2">
            ({t('weeklyCookingBased', { count: recipeCount, total: totalRecipes })})
          </span>
        )}
      </div>
    </div>
  );
}

interface DietPlanViewProps {
  plan: DietPlan;
  token: string;
  /** Enable meal swap buttons (patient view only). */
  swapEnabled?: boolean;
  /** Remaining swaps this week (from access status). */
  swapsRemaining?: number;
  /** Called after a swap is confirmed — parent should reload the plan. */
  onPlanUpdated?: () => void;
  /** Enable inline meal rating buttons (patient view). */
  ratingEnabled?: boolean;
  /** Current meal ratings keyed by meal name. */
  mealRatings?: Record<string, number>;
  /** Called when patient rates a meal. */
  onRateMeal?: (mealName: string, rating: number) => void;
  favorites?: string[];
  onToggleFavorite?: (mealName: string) => void;
}

export function DietPlanView({ plan, token, swapEnabled, swapsRemaining, onPlanUpdated, ratingEnabled, mealRatings, onRateMeal, favorites, onToggleFavorite }: DietPlanViewProps) {
  const t = useTranslations('dashboard.plan');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [icsLoading, setIcsLoading] = useState(false);
  const [swapModal, setSwapModal] = useState<{ dayIndex: number; mealIndex: number; mealName: string } | null>(null);

  const hasMacros = plan.kcal || plan.proteinG || plan.fatG || plan.carbsG;
  const canSwap = swapEnabled && ['PUBLISHED', 'SENT', 'REVIEWED', 'GENERATED'].includes(plan.status);

  async function handleDownloadPdf() {
    setPdfLoading(true);
    try {
      const blob = await api.dietPlans.exportPdf(plan.id, token);
      downloadBlob(blob, 'plan-diety.pdf');
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleExportCalendar() {
    setIcsLoading(true);
    try {
      const blob = await api.dietPlans.exportCalendar(plan.id, token);
      downloadBlob(blob, 'plan-diety.ics');
    } finally {
      setIcsLoading(false);
    }
  }

  const handleSwapClick = useCallback((dayIndex: number, mealIndex: number, mealName: string) => {
    setSwapModal({ dayIndex, mealIndex, mealName });
  }, []);

  const handleSwapConfirmed = useCallback(() => {
    onPlanUpdated?.();
  }, [onPlanUpdated]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={plan.status} />
            <span className="text-xs text-muted-foreground">
              {plan.source === 'AI' ? t('sourceAi') : t('sourceManual')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('createdAt')}: {new Date(plan.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canSwap && swapsRemaining !== undefined && (
            <span className="text-xs text-muted-foreground">
              {swapsRemaining > 0
                ? t('swapRemaining', { count: swapsRemaining })
                : t('swapNoRemaining')}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCalendar} disabled={icsLoading} className="gap-2">
            <CalendarDays className="h-4 w-4" />
            {icsLoading ? '...' : t('exportCalendar')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={pdfLoading} className="gap-2">
            <FileText className="h-4 w-4" />
            {pdfLoading ? '...' : t('downloadPdf')}
          </Button>
        </div>
      </div>

      {/* Macros */}
      {hasMacros && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('macrosTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MacroCard icon={Flame}  label={t('kcal')}    value={plan.kcal}     unit="kcal" />
            <MacroCard icon={Beef}   label={t('proteinG')} value={plan.proteinG} unit="g" />
            <MacroCard icon={Droplet} label={t('fatG')}   value={plan.fatG}     unit="g" />
            <MacroCard icon={Wheat}  label={t('carbsG')}  value={plan.carbsG}   unit="g" />
          </CardContent>
        </Card>
      )}

      {/* Content */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('contentTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanContent
            content={plan.content}
            swapEnabled={canSwap && (swapsRemaining === undefined || swapsRemaining > 0)}
            onSwapClick={handleSwapClick}
            ratingEnabled={ratingEnabled}
            mealRatings={mealRatings}
            onRateMeal={onRateMeal}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
          />
        </CardContent>
      </Card>

      {/* Micronutrient analysis (38.7) */}
      <MicronutrientPanel planId={plan.id} token={token} role={ratingEnabled ? 'PATIENT' : 'DIETITIAN'} />

      {/* Weekly cooking time (37.9) */}
      {Array.isArray((plan.content as Record<string, unknown>)?.days) && (
        <WeeklyCookingTime
          days={(plan.content as Record<string, unknown>).days as Array<{ meals: Array<{ recipe?: { prepTimeMin?: number } }> }>}
          t={t}
        />
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          {t('disclaimer')}
        </p>
      </div>

      {/* Swap modal */}
      {swapModal && (
        <MealSwapModal
          open
          onOpenChange={(open) => { if (!open) setSwapModal(null); }}
          planId={plan.id}
          dayIndex={swapModal.dayIndex}
          mealIndex={swapModal.mealIndex}
          mealName={swapModal.mealName}
          token={token}
          onSwapConfirmed={handleSwapConfirmed}
        />
      )}

    </div>
  );
}
