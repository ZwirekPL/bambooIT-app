'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  Trash2,
  Copy,
  ChefHat,
  Check,
  AlertCircle,
  Flame,
  Beef,
  Droplet,
  Wheat,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { IngredientAutocomplete, type SelectedProduct } from './IngredientAutocomplete';
import { RecipeAutocomplete, type SelectedRecipe } from './RecipeAutocomplete';

// ─── types ─────────────────────────────────────────────────────────────────────

export interface MealItem {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  /** Hidden field for auto-recalc when grams change — not serialized */
  _per100g?: { kcal: number; protein: number; fat: number; carbs: number };
}

export interface MealRecipe {
  prepTimeMin: number;
  steps: string[];
  tips: string;
}

export interface Meal {
  name: string;
  items: MealItem[];
  recipe: MealRecipe;
}

export interface DayPlan {
  day: string;
  meals: Meal[];
}

export interface PlanData {
  days: DayPlan[];
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

// ─── constants ─────────────────────────────────────────────────────────────────

const DAY_NAMES = [
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
  'Niedziela',
];

const DEFAULT_MEALS = ['Śniadanie', 'II Śniadanie', 'Obiad', 'Podwieczorek', 'Kolacja'];

function createEmptyMeal(name: string): Meal {
  return {
    name,
    items: [],
    recipe: { prepTimeMin: 0, steps: [''], tips: '' },
  };
}

function createEmptyDay(dayName: string): DayPlan {
  return {
    day: dayName,
    meals: DEFAULT_MEALS.map(createEmptyMeal),
  };
}

function createEmpty7Days(): DayPlan[] {
  return DAY_NAMES.map(createEmptyDay);
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function sumMealMacros(items: MealItem[]) {
  return items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + (item.kcal || 0),
      protein: acc.protein + (item.protein || 0),
      fat: acc.fat + (item.fat || 0),
      carbs: acc.carbs + (item.carbs || 0),
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  );
}

function sumDayMacros(meals: Meal[]) {
  return meals.reduce(
    (acc, meal) => {
      const m = sumMealMacros(meal.items);
      return {
        kcal: acc.kcal + m.kcal,
        protein: acc.protein + m.protein,
        fat: acc.fat + m.fat,
        carbs: acc.carbs + m.carbs,
      };
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  );
}

function isMealComplete(meal: Meal): boolean {
  const steps = meal.recipe?.steps ?? [];
  return (
    meal.items.length > 0 &&
    meal.recipe.prepTimeMin > 0 &&
    steps.some((s) => s.trim().length > 0)
  );
}

function isDayComplete(day: DayPlan): boolean {
  return day.meals.length > 0 && day.meals.every(isMealComplete);
}

/** Convert structured editor state to the JSON shape stored in DietPlan.content */
export function planDataToContent(days: DayPlan[]): Record<string, unknown> {
  return {
    days: days.map((d) => ({
      day: d.day,
      meals: d.meals.map((m) => ({
        name: m.name,
        items: m.items.map((item) => ({
          name: item.name,
          grams: item.grams,
          kcal: Math.round(item.kcal),
          protein: Math.round(item.protein * 10) / 10,
          fat: Math.round(item.fat * 10) / 10,
          carbs: Math.round(item.carbs * 10) / 10,
        })),
        recipe: {
          prepTimeMin: m.recipe.prepTimeMin,
          steps: (m.recipe?.steps ?? []).filter((s) => s.trim().length > 0),
          ...(m.recipe?.tips?.trim() ? { tips: m.recipe.tips.trim() } : {}),
        },
      })),
    })),
  };
}

/** Convert DietPlan.content JSON back to editor state */
export function contentToPlanData(content: Record<string, unknown>): DayPlan[] | null {
  const days = content.days as Array<Record<string, unknown>> | undefined;
  if (!days?.length) return null;

  return days.map((d) => ({
    day: String(d.day ?? ''),
    meals: ((d.meals as Array<Record<string, unknown>>) ?? []).map((m) => ({
      name: String(m.name ?? ''),
      items: ((m.items as Array<Record<string, unknown>>) ?? []).map((item) => ({
        name: String(item.name ?? ''),
        grams: Number(item.grams ?? 0),
        kcal: Number(item.kcal ?? 0),
        protein: Number(item.protein ?? 0),
        fat: Number(item.fat ?? 0),
        carbs: Number(item.carbs ?? 0),
      })),
      recipe: {
        prepTimeMin: Number((m.recipe as Record<string, unknown>)?.prepTimeMin ?? 0),
        steps: (() => {
          const raw = (m.recipe as Record<string, unknown>)?.steps;
          const arr = Array.isArray(raw) ? (raw as string[]).map(String) : [];
          return arr.length > 0 ? arr : [''];
        })(),
        tips: String((m.recipe as Record<string, unknown>)?.tips ?? ''),
      },
    })),
  }));
}

// ─── sub-components ────────────────────────────────────────────────────────────

function MacroBadge({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      <span>{label}:</span>
      <span className="font-bold">
        {Math.round(value)} {unit}
      </span>
    </div>
  );
}

// ─── Item Row ──────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  onChange,
  onRemove,
  t,
}: {
  item: MealItem;
  onChange: (updated: MealItem) => void;
  onRemove: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  function handleGramsChange(grams: number) {
    if (item._per100g) {
      const ratio = grams / 100;
      onChange({
        ...item,
        grams,
        kcal: Math.round(item._per100g.kcal * ratio),
        protein: Math.round(item._per100g.protein * ratio * 10) / 10,
        fat: Math.round(item._per100g.fat * ratio * 10) / 10,
        carbs: Math.round(item._per100g.carbs * ratio * 10) / 10,
      });
    } else {
      onChange({ ...item, grams });
    }
  }

  return (
    <div className="grid grid-cols-12 gap-1.5 items-center text-sm">
      <div className="col-span-12 sm:col-span-3">
        <Input
          value={item.name}
          onChange={(e) => onChange({ ...item, name: e.target.value })}
          placeholder={t('itemName')}
          className="h-8 text-xs"
        />
      </div>
      <div className="col-span-4 sm:col-span-1">
        <Input
          type="number"
          value={item.grams || ''}
          onChange={(e) => handleGramsChange(Number(e.target.value) || 0)}
          placeholder="g"
          className="h-8 text-xs text-center"
          min={0}
        />
      </div>
      <div className="col-span-4 sm:col-span-2">
        <Input
          type="number"
          value={item.kcal || ''}
          onChange={(e) => onChange({ ...item, kcal: Number(e.target.value) || 0 })}
          placeholder="kcal"
          className="h-8 text-xs text-center"
          min={0}
        />
      </div>
      <div className="col-span-4 sm:col-span-2">
        <Input
          type="number"
          value={item.protein || ''}
          onChange={(e) => onChange({ ...item, protein: Number(e.target.value) || 0 })}
          placeholder={t('proteinShort')}
          className="h-8 text-xs text-center"
          min={0}
          step={0.1}
        />
      </div>
      <div className="col-span-4 sm:col-span-1">
        <Input
          type="number"
          value={item.fat || ''}
          onChange={(e) => onChange({ ...item, fat: Number(e.target.value) || 0 })}
          placeholder={t('fatShort')}
          className="h-8 text-xs text-center"
          min={0}
          step={0.1}
        />
      </div>
      <div className="col-span-4 sm:col-span-2">
        <Input
          type="number"
          value={item.carbs || ''}
          onChange={(e) => onChange({ ...item, carbs: Number(e.target.value) || 0 })}
          placeholder={t('carbsShort')}
          className="h-8 text-xs text-center"
          min={0}
          step={0.1}
        />
      </div>
      <div className="col-span-4 sm:col-span-1 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── MealEditor ────────────────────────────────────────────────────────────────

function MealEditor({
  meal,
  onChange,
  onRemove,
  onCopy,
  t,
}: {
  meal: Meal;
  onChange: (updated: Meal) => void;
  onRemove: () => void;
  onCopy: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [recipeOpen, setRecipeOpen] = useState(false);
  const macros = sumMealMacros(meal.items);
  const complete = isMealComplete(meal);

  function handleProductSelect(product: SelectedProduct) {
    const defaultGrams = 100;
    const ratio = defaultGrams / 100;
    const newItem: MealItem = {
      name: product.name,
      grams: defaultGrams,
      kcal: Math.round(product.nutrientsPer100g.kcal * ratio),
      protein: Math.round(product.nutrientsPer100g.protein_g * ratio * 10) / 10,
      fat: Math.round(product.nutrientsPer100g.fat_g * ratio * 10) / 10,
      carbs: Math.round(product.nutrientsPer100g.carbs_g * ratio * 10) / 10,
      _per100g: {
        kcal: product.nutrientsPer100g.kcal,
        protein: product.nutrientsPer100g.protein_g,
        fat: product.nutrientsPer100g.fat_g,
        carbs: product.nutrientsPer100g.carbs_g,
      },
    };
    onChange({ ...meal, items: [...meal.items, newItem] });
  }

  function handleRecipeSelect(recipe: SelectedRecipe) {
    const items: MealItem[] = recipe.ingredients.map((ing) => ({
      name: ing.name,
      grams: ing.amountG,
      kcal: ing.kcal,
      protein: ing.protein,
      fat: ing.fat,
      carbs: ing.carbs,
    }));

    const newRecipe: MealRecipe = {
      prepTimeMin: recipe.totalTimeMinutes ?? 0,
      steps: recipe.steps.length > 0 ? recipe.steps : [''],
      tips: recipe.tips ?? '',
    };

    onChange({
      ...meal,
      name: recipe.name,
      items: [...meal.items, ...items],
      recipe: newRecipe,
    });
  }

  function updateItem(index: number, updated: MealItem) {
    const newItems = [...meal.items];
    newItems[index] = updated;
    onChange({ ...meal, items: newItems });
  }

  function removeItem(index: number) {
    onChange({ ...meal, items: meal.items.filter((_, i) => i !== index) });
  }

  function addManualItem() {
    onChange({
      ...meal,
      items: [...meal.items, { name: '', grams: 0, kcal: 0, protein: 0, fat: 0, carbs: 0 }],
    });
  }

  function updateRecipe(partial: Partial<MealRecipe>) {
    onChange({ ...meal, recipe: { ...meal.recipe, ...partial } });
  }

  const recipeSteps = meal.recipe?.steps ?? [''];

  function addRecipeStep() {
    updateRecipe({ steps: [...recipeSteps, ''] });
  }

  function updateRecipeStep(index: number, value: string) {
    const newSteps = [...recipeSteps];
    newSteps[index] = value;
    updateRecipe({ steps: newSteps });
  }

  function removeRecipeStep(index: number) {
    if (recipeSteps.length <= 1) return;
    updateRecipe({ steps: recipeSteps.filter((_, i) => i !== index) });
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Meal header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`h-2 w-2 rounded-full shrink-0 ${complete ? 'bg-green-500' : 'bg-orange-400'}`} />
          <Input
            value={meal.name}
            onChange={(e) => onChange({ ...meal, name: e.target.value })}
            className="h-7 text-sm font-semibold border-0 bg-transparent shadow-none p-0 focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {meal.items.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 mr-2 text-[10px] text-muted-foreground">
              <span>{Math.round(macros.kcal)} kcal</span>
            </div>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onCopy} className="h-7 w-7 p-0" title={t('copyMeal')}>
            <Copy className="h-3 w-3" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" title={t('removeMeal')}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Items */}
      <div className="px-3 py-2 space-y-2">
        {/* Column headers (desktop) */}
        {meal.items.length > 0 && (
          <div className="hidden sm:grid grid-cols-12 gap-1.5 text-[10px] text-muted-foreground font-medium px-0.5">
            <div className="col-span-3">{t('itemName')}</div>
            <div className="col-span-1 text-center">{t('grams')}</div>
            <div className="col-span-2 text-center">kcal</div>
            <div className="col-span-2 text-center">{t('proteinShort')}</div>
            <div className="col-span-1 text-center">{t('fatShort')}</div>
            <div className="col-span-2 text-center">{t('carbsShort')}</div>
            <div className="col-span-1" />
          </div>
        )}

        {meal.items.map((item, idx) => (
          <ItemRow
            key={idx}
            item={item}
            onChange={(updated) => updateItem(idx, updated)}
            onRemove={() => removeItem(idx)}
            t={t}
          />
        ))}

        {/* Add ingredient or recipe */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex flex-col sm:flex-row gap-2">
            <IngredientAutocomplete onSelect={handleProductSelect} className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={addManualItem} className="gap-1 text-xs h-9 shrink-0">
              <Plus className="h-3 w-3" />
              {t('addManual')}
            </Button>
          </div>
          <RecipeAutocomplete onSelect={handleRecipeSelect} className="flex-1" />
        </div>

        {/* Meal macros summary */}
        {meal.items.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <MacroBadge icon={Flame} label="kcal" value={macros.kcal} unit="" color="bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" />
            <MacroBadge icon={Beef} label={t('proteinShort')} value={macros.protein} unit="g" color="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" />
            <MacroBadge icon={Droplet} label={t('fatShort')} value={macros.fat} unit="g" color="bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" />
            <MacroBadge icon={Wheat} label={t('carbsShort')} value={macros.carbs} unit="g" color="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" />
          </div>
        )}
      </div>

      {/* Recipe section */}
      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => setRecipeOpen(!recipeOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-primary/70 hover:text-primary transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <ChefHat className="h-3.5 w-3.5" />
            {t('recipe')}
            {complete ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <AlertCircle className="h-3 w-3 text-orange-400" />
            )}
          </span>
          {recipeOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {recipeOpen && (
          <div className="px-3 pb-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('prepTime')}</Label>
              <Input
                type="number"
                value={meal.recipe.prepTimeMin || ''}
                onChange={(e) => updateRecipe({ prepTimeMin: Number(e.target.value) || 0 })}
                placeholder="min"
                className="h-8 text-xs w-24"
                min={0}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">{t('steps')}</Label>
              {recipeSteps.map((step, idx) => (
                <div key={idx} className="flex gap-1.5 items-start">
                  <span className="text-xs text-muted-foreground mt-2 w-5 shrink-0 text-right">
                    {idx + 1}.
                  </span>
                  <Textarea
                    value={step}
                    onChange={(e) => updateRecipeStep(idx, e.target.value)}
                    placeholder={`${t('step')} ${idx + 1}...`}
                    className="text-xs min-h-[36px] resize-y"
                    rows={1}
                  />
                  {recipeSteps.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRecipeStep(idx)}
                      className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addRecipeStep} className="gap-1 text-xs h-7">
                <Plus className="h-3 w-3" />
                {t('addStep')}
              </Button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t('tips')}</Label>
              <Textarea
                value={meal.recipe.tips}
                onChange={(e) => updateRecipe({ tips: e.target.value })}
                placeholder={t('tipsPlaceholder')}
                className="text-xs min-h-[36px] resize-y"
                rows={1}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Editor ───────────────────────────────────────────────────────────────

interface Props {
  initialDays?: DayPlan[];
  onSave: (data: PlanData) => Promise<void>;
  saveLabel?: string;
  savingLabel?: string;
}

export function VisualPlanEditor({ initialDays, onSave, saveLabel, savingLabel }: Props) {
  const t = useTranslations('dietitian.visualEditor');

  const [days, setDays] = useState<DayPlan[]>(() => initialDays ?? createEmpty7Days());
  const [activeDay, setActiveDay] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Total macros across all days
  const totalMacros = useMemo(() => {
    const totals = days.reduce(
      (acc, day) => {
        const dm = sumDayMacros(day.meals);
        return {
          kcal: acc.kcal + dm.kcal,
          protein: acc.protein + dm.protein,
          fat: acc.fat + dm.fat,
          carbs: acc.carbs + dm.carbs,
        };
      },
      { kcal: 0, protein: 0, fat: 0, carbs: 0 }
    );
    // Average per day
    const numDays = days.length || 1;
    return {
      kcal: Math.round(totals.kcal / numDays),
      protein: Math.round(totals.protein / numDays),
      fat: Math.round(totals.fat / numDays),
      carbs: Math.round(totals.carbs / numDays),
    };
  }, [days]);

  // Validation
  const completeDays = useMemo(() => days.map(isDayComplete), [days]);
  const allComplete = completeDays.every(Boolean);
  const has7Days = days.length === 7;

  const currentDay = days[activeDay];

  const updateDay = useCallback(
    (dayIndex: number, updater: (day: DayPlan) => DayPlan) => {
      setDays((prev) => prev.map((d, i) => (i === dayIndex ? updater(d) : d)));
    },
    []
  );

  function updateMeal(mealIndex: number, updated: Meal) {
    updateDay(activeDay, (day) => ({
      ...day,
      meals: day.meals.map((m, i) => (i === mealIndex ? updated : m)),
    }));
  }

  function removeMeal(mealIndex: number) {
    updateDay(activeDay, (day) => ({
      ...day,
      meals: day.meals.filter((_, i) => i !== mealIndex),
    }));
  }

  function copyMeal(mealIndex: number) {
    updateDay(activeDay, (day) => {
      const copied = JSON.parse(JSON.stringify(day.meals[mealIndex])) as Meal;
      copied.name = `${copied.name} (${t('copy')})`;
      const newMeals = [...day.meals];
      newMeals.splice(mealIndex + 1, 0, copied);
      return { ...day, meals: newMeals };
    });
  }

  function addMeal() {
    updateDay(activeDay, (day) => ({
      ...day,
      meals: [...day.meals, createEmptyMeal(t('newMeal'))],
    }));
  }

  function copyDay() {
    if (days.length >= 7) return;
    const copied = JSON.parse(JSON.stringify(currentDay)) as DayPlan;
    const nextDayName = DAY_NAMES[days.length] ?? `${t('day')} ${days.length + 1}`;
    copied.day = nextDayName;
    setDays((prev) => [...prev, copied]);
  }

  function removeDay(index: number) {
    if (days.length <= 1) return;
    setDays((prev) => prev.filter((_, i) => i !== index));
    if (activeDay >= days.length - 1) {
      setActiveDay(Math.max(0, days.length - 2));
    }
  }

  function addDay() {
    if (days.length >= 7) return;
    const nextDayName = DAY_NAMES[days.length] ?? `${t('day')} ${days.length + 1}`;
    setDays((prev) => [...prev, createEmptyDay(nextDayName)]);
  }

  async function handleSave() {
    setError('');

    if (!has7Days) {
      setError(t('need7Days'));
      return;
    }
    if (!allComplete) {
      setError(t('incompleteWarning'));
      return;
    }

    setSaving(true);
    try {
      await onSave({
        days,
        kcal: totalMacros.kcal,
        proteinG: totalMacros.protein,
        fatG: totalMacros.fat,
        carbsG: totalMacros.carbs,
      });
    } catch {
      setError(t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  const dayMacros = currentDay ? sumDayMacros(currentDay.meals) : { kcal: 0, protein: 0, fat: 0, carbs: 0 };

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{t('progress')}</span>
            <span className="text-xs text-muted-foreground">
              {completeDays.filter(Boolean).length} / {days.length} {t('daysComplete')}
            </span>
          </div>
          <div className="flex gap-1">
            {days.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  completeDays[idx] ? 'bg-green-500' : 'bg-orange-300'
                }`}
              />
            ))}
            {Array.from({ length: Math.max(0, 7 - days.length) }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-2 flex-1 rounded-full bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Average daily macros */}
      <Card>
        <CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground mb-2">{t('avgDailyMacros')}</p>
          <div className="flex flex-wrap gap-2">
            <MacroBadge icon={Flame} label="kcal" value={totalMacros.kcal} unit="" color="bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" />
            <MacroBadge icon={Beef} label={t('proteinShort')} value={totalMacros.protein} unit="g" color="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" />
            <MacroBadge icon={Droplet} label={t('fatShort')} value={totalMacros.fat} unit="g" color="bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" />
            <MacroBadge icon={Wheat} label={t('carbsShort')} value={totalMacros.carbs} unit="g" color="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" />
          </div>
        </CardContent>
      </Card>

      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {days.map((day, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveDay(idx)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors relative ${
              idx === activeDay
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {day.day.substring(0, 3)}
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  completeDays[idx] ? 'bg-green-400' : 'bg-orange-400'
                }`}
              />
            </span>
          </button>
        ))}
        {days.length < 7 && (
          <button
            type="button"
            onClick={addDay}
            className="shrink-0 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors border border-dashed border-border"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Active day */}
      {currentDay && (
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{currentDay.day}</CardTitle>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className="text-xs text-muted-foreground">
                  {Math.round(dayMacros.kcal)} kcal · B: {Math.round(dayMacros.protein)}g · T: {Math.round(dayMacros.fat)}g · W: {Math.round(dayMacros.carbs)}g
                </span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              {days.length < 7 && (
                <Button type="button" variant="outline" size="sm" onClick={copyDay} className="gap-1 text-xs h-8">
                  <Copy className="h-3 w-3" />
                  <span className="hidden sm:inline">{t('copyDay')}</span>
                </Button>
              )}
              {days.length > 1 && (
                <Button type="button" variant="outline" size="sm" onClick={() => removeDay(activeDay)} className="gap-1 text-xs h-8 text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                  <span className="hidden sm:inline">{t('removeDay')}</span>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentDay.meals.map((meal, mealIdx) => (
              <MealEditor
                key={mealIdx}
                meal={meal}
                onChange={(updated) => updateMeal(mealIdx, updated)}
                onRemove={() => removeMeal(mealIdx)}
                onCopy={() => copyMeal(mealIdx)}
                t={t}
              />
            ))}
            <Button type="button" variant="outline" onClick={addMeal} className="w-full gap-1.5 text-sm">
              <Plus className="h-3.5 w-3.5" />
              {t('addMeal')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Save */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 gap-1.5"
          size="lg"
        >
          {saving ? (savingLabel ?? t('saving')) : (saveLabel ?? t('save'))}
        </Button>
      </div>
    </div>
  );
}
