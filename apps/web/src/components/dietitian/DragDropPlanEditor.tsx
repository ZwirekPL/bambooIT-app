'use client';

import { useState, useReducer, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { api } from '@/lib/api';
import type { Recipe } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  X,
  Search,
  GripVertical,
  ChefHat,
  Clock,
  Flame,
  Save,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SlotRecipe {
  recipeId: string;
  title: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  scaleFactor: number;
}

interface MealSlot {
  mealName: string;
  mealType: string;
  recipe: SlotRecipe | null;
}

interface DayState {
  name: string;
  slots: MealSlot[];
}

interface EditorState {
  days: DayState[];
}

export interface PlanContent {
  days: Array<{
    day: string;
    meals: Array<{
      name: string;
      mealType: string;
      recipe: SlotRecipe | null;
    }>;
  }>;
}

export interface DragDropPlanEditorProps {
  patientId: string;
  targets: {
    targetKcal: number;
    targetProteinG: number;
    targetFatG: number;
    targetCarbsG: number;
  };
  initialPlan?: PlanContent;
  onSave: (plan: PlanContent) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DAY_NAMES = [
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
  'Niedziela',
];

const DAY_NAMES_SHORT = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];

const DEFAULT_SLOTS: Array<{ mealName: string; mealType: string; pct: number }> = [
  { mealName: 'Śniadanie', mealType: 'BREAKFAST', pct: 0.25 },
  { mealName: 'II Śniadanie', mealType: 'SNACK', pct: 0.10 },
  { mealName: 'Obiad', mealType: 'LUNCH', pct: 0.35 },
  { mealName: 'Podwieczorek', mealType: 'SNACK', pct: 0.10 },
  { mealName: 'Kolacja', mealType: 'DINNER', pct: 0.20 },
];

const MEAL_TYPE_OPTIONS = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'DESSERT'] as const;

// ─── Reducer ────────────────────────────────────────────────────────────────

type EditorAction =
  | { type: 'SET_RECIPE'; dayIdx: number; slotIdx: number; recipe: SlotRecipe }
  | { type: 'REMOVE_RECIPE'; dayIdx: number; slotIdx: number }
  | { type: 'INIT'; state: EditorState };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_RECIPE': {
      const days = state.days.map((day, di) => {
        if (di !== action.dayIdx) return day;
        const slots = day.slots.map((slot, si) => {
          if (si !== action.slotIdx) return slot;
          return { ...slot, recipe: action.recipe };
        });
        return { ...day, slots };
      });
      return { days };
    }
    case 'REMOVE_RECIPE': {
      const days = state.days.map((day, di) => {
        if (di !== action.dayIdx) return day;
        const slots = day.slots.map((slot, si) => {
          if (si !== action.slotIdx) return slot;
          return { ...slot, recipe: null };
        });
        return { ...day, slots };
      });
      return { days };
    }
    case 'INIT':
      return action.state;
    default:
      return state;
  }
}

function buildInitialState(initialPlan?: PlanContent): EditorState {
  if (initialPlan) {
    return {
      days: initialPlan.days.map((d) => ({
        name: d.day,
        slots: d.meals.map((m) => ({
          mealName: m.name,
          mealType: m.mealType,
          recipe: m.recipe,
        })),
      })),
    };
  }
  return {
    days: DAY_NAMES.map((name) => ({
      name,
      slots: DEFAULT_SLOTS.map((s) => ({
        mealName: s.mealName,
        mealType: s.mealType,
        recipe: null,
      })),
    })),
  };
}

// ─── Utility ────────────────────────────────────────────────────────────────

function getSlotTargetKcal(slotIdx: number, totalKcal: number): number {
  return Math.round(totalKcal * (DEFAULT_SLOTS[slotIdx]?.pct ?? 0.2));
}

function computeScaleFactor(recipeKcal: number, targetKcal: number): number {
  if (recipeKcal <= 0) return 1;
  return Math.round((targetKcal / recipeKcal) * 100) / 100;
}

function getRecipeNutrition(snapshot: Recipe['nutritionSnapshot']): {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
} {
  if (!snapshot) return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  return {
    kcal: snapshot.kcal ?? 0,
    protein: snapshot.protein_g ?? 0,
    fat: snapshot.fat_g ?? 0,
    carbs: snapshot.carbs_g ?? 0,
  };
}

function complianceColor(actual: number, target: number): string {
  if (target === 0) return 'text-muted-foreground';
  const ratio = Math.abs(actual - target) / target;
  if (ratio <= 0.1) return 'text-green-600';
  if (ratio <= 0.2) return 'text-yellow-600';
  return 'text-red-600';
}

function complianceBg(actual: number, target: number): string {
  if (target === 0) return 'bg-muted';
  const ratio = Math.abs(actual - target) / target;
  if (ratio <= 0.1) return 'bg-green-500';
  if (ratio <= 0.2) return 'bg-yellow-500';
  return 'bg-red-500';
}

// ─── Sub-component: DraggableRecipeCard ─────────────────────────────────────

function DraggableRecipeCard({ recipe }: { recipe: Recipe }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`,
    data: { recipe },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const nutrition = getRecipeNutrition(recipe.nutritionSnapshot);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-start gap-2 rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{recipe.name}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Flame className="h-3 w-3" />
            {Math.round(nutrition.kcal)} kcal
          </span>
          {recipe.prepTimeMinutes && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {recipe.prepTimeMinutes} min
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {recipe.mealType && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {recipe.mealType}
            </Badge>
          )}
          {recipe.category && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {recipe.category}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-component: RecipeCardPreview (for DragOverlay) ─────────────────────

function RecipeCardPreview({ recipe }: { recipe: Recipe }) {
  const nutrition = getRecipeNutrition(recipe.nutritionSnapshot);
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-card p-3 shadow-xl w-64 opacity-90">
      <ChefHat className="h-4 w-4 mt-0.5 text-primary shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{recipe.name}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Flame className="h-3 w-3" />
            {Math.round(nutrition.kcal)} kcal
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-component: MealSlotCell ────────────────────────────────────────────

function MealSlotCell({
  dayIdx,
  slotIdx,
  slot,
  targetKcal,
  onRemove,
}: {
  dayIdx: number;
  slotIdx: number;
  slot: MealSlot;
  targetKcal: number;
  onRemove: () => void;
}) {
  const t = useTranslations('dietitian.planEditor');
  const droppableId = `slot-${dayIdx}-${slotIdx}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  const scaledKcal = slot.recipe
    ? Math.round(slot.recipe.kcal * slot.recipe.scaleFactor)
    : 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative rounded-lg border-2 p-2 min-h-[72px] transition-colors',
        !slot.recipe && 'border-dashed border-muted-foreground/30',
        !slot.recipe && isOver && 'border-primary bg-primary/5',
        slot.recipe && 'border-solid',
        slot.recipe && complianceBorderColor(scaledKcal, targetKcal)
      )}
    >
      {slot.recipe ? (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-1">
            <p className="text-xs font-medium leading-tight truncate flex-1">
              {slot.recipe.title}
            </p>
            <button
              onClick={onRemove}
              className="shrink-0 rounded-full p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              aria-label={t('removeRecipe')}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px] px-1 py-0',
                complianceColor(scaledKcal, targetKcal)
              )}
            >
              {scaledKcal} kcal
            </Badge>
            {slot.recipe.scaleFactor !== 1 && (
              <span className="text-[10px] text-muted-foreground">
                x{slot.recipe.scaleFactor}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50 select-none">
          {isOver ? t('dropHere') : t('dragRecipe')}
        </div>
      )}
    </div>
  );
}

function complianceBorderColor(actual: number, target: number): string {
  if (target === 0) return 'border-border';
  const ratio = Math.abs(actual - target) / target;
  if (ratio <= 0.1) return 'border-green-300';
  if (ratio <= 0.2) return 'border-yellow-300';
  return 'border-red-300';
}

// ─── Sub-component: DaySummaryBar ───────────────────────────────────────────

function DaySummaryBar({
  day,
  targets,
}: {
  day: DayState;
  targets: DragDropPlanEditorProps['targets'];
}) {
  const t = useTranslations('dietitian.planEditor');
  let totalKcal = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;

  for (const slot of day.slots) {
    if (slot.recipe) {
      const sf = slot.recipe.scaleFactor;
      totalKcal += slot.recipe.kcal * sf;
      totalProtein += slot.recipe.protein * sf;
      totalFat += slot.recipe.fat * sf;
      totalCarbs += slot.recipe.carbs * sf;
    }
  }

  const kcalPct = targets.targetKcal > 0
    ? Math.min(100, Math.round((totalKcal / targets.targetKcal) * 100))
    : 0;

  return (
    <div className="space-y-1 px-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className={complianceColor(totalKcal, targets.targetKcal)}>
          {Math.round(totalKcal)}
        </span>
        <span className="text-muted-foreground">/ {targets.targetKcal} kcal</span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            complianceBg(totalKcal, targets.targetKcal)
          )}
          style={{ width: `${Math.min(100, kcalPct)}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-0.5 text-[9px] text-muted-foreground">
        <span className={complianceColor(totalProtein, targets.targetProteinG)}>
          {t('proteinShort')} {Math.round(totalProtein)}g
        </span>
        <span className={complianceColor(totalFat, targets.targetFatG)}>
          {t('fatShort')} {Math.round(totalFat)}g
        </span>
        <span className={complianceColor(totalCarbs, targets.targetCarbsG)}>
          {t('carbsShort')} {Math.round(totalCarbs)}g
        </span>
      </div>
    </div>
  );
}

// ─── Sub-component: WeekSummary ─────────────────────────────────────────────

function WeekSummary({
  days,
  targets,
}: {
  days: DayState[];
  targets: DragDropPlanEditorProps['targets'];
}) {
  const t = useTranslations('dietitian.planEditor');

  let totalKcal = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let filledDays = 0;

  for (const day of days) {
    let dayHasRecipe = false;
    for (const slot of day.slots) {
      if (slot.recipe) {
        dayHasRecipe = true;
        const sf = slot.recipe.scaleFactor;
        totalKcal += slot.recipe.kcal * sf;
        totalProtein += slot.recipe.protein * sf;
        totalFat += slot.recipe.fat * sf;
        totalCarbs += slot.recipe.carbs * sf;
      }
    }
    if (dayHasRecipe) filledDays++;
  }

  const divisor = filledDays || 1;
  const avgKcal = Math.round(totalKcal / divisor);
  const avgProtein = Math.round(totalProtein / divisor);
  const avgFat = Math.round(totalFat / divisor);
  const avgCarbs = Math.round(totalCarbs / divisor);

  const compliance =
    targets.targetKcal > 0
      ? Math.round((avgKcal / targets.targetKcal) * 100)
      : 0;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">{t('weekSummary')}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">{t('avgKcal')}</p>
          <p className={cn('text-lg font-semibold', complianceColor(avgKcal, targets.targetKcal))}>
            {avgKcal}
            <span className="text-xs text-muted-foreground font-normal ml-1">
              / {targets.targetKcal}
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('proteinShort')}</p>
          <p className={cn('text-lg font-semibold', complianceColor(avgProtein, targets.targetProteinG))}>
            {avgProtein}g
            <span className="text-xs text-muted-foreground font-normal ml-1">
              / {targets.targetProteinG}g
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('fatShort')}</p>
          <p className={cn('text-lg font-semibold', complianceColor(avgFat, targets.targetFatG))}>
            {avgFat}g
            <span className="text-xs text-muted-foreground font-normal ml-1">
              / {targets.targetFatG}g
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('carbsShort')}</p>
          <p className={cn('text-lg font-semibold', complianceColor(avgCarbs, targets.targetCarbsG))}>
            {avgCarbs}g
            <span className="text-xs text-muted-foreground font-normal ml-1">
              / {targets.targetCarbsG}g
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('compliance')}</p>
          <p className={cn('text-lg font-semibold', complianceColor(compliance, 100))}>
            {compliance}%
          </p>
          <p className="text-[10px] text-muted-foreground">
            {filledDays}/7 {t('daysPlanned')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-component: RecipeSidePanel ─────────────────────────────────────────

function RecipeSidePanel() {
  const t = useTranslations('dietitian.planEditor');
  const { data: session } = useSession();
  const token = '';

  const [search, setSearch] = useState('');
  const [mealTypeFilter, setMealTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchRecipes = useCallback(
    async (p: number, append: boolean) => {
      if (!token) return;
      setLoading(true);
      try {
        const params: { page: number; limit: number; search?: string; category?: string } = {
          page: p,
          limit: 20,
        };
        if (search.trim()) params.search = search.trim();
        if (categoryFilter !== 'all') params.category = categoryFilter;

        const res = await api.recipes.list(params, token);

        let items = res.items;

        // Client-side mealType filter (API may not support this param directly)
        if (mealTypeFilter !== 'all') {
          items = items.filter((r) => r.mealType === mealTypeFilter);
        }

        if (append) {
          setRecipes((prev) => [...prev, ...items]);
        } else {
          setRecipes(items);
        }
        setTotal(res.total);
        setHasMore(p * 20 < res.total);
      } catch {
        // Silently handle — user sees empty state
      } finally {
        setLoading(false);
      }
    },
    [token, search, mealTypeFilter, categoryFilter]
  );

  // Debounced fetch on filter change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchRecipes(1, false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchRecipes]);

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchRecipes(nextPage, true);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-2 p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchRecipes')}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={mealTypeFilter} onValueChange={setMealTypeFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t('mealType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allMealTypes')}</SelectItem>
              {MEAL_TYPE_OPTIONS.map((mt) => (
                <SelectItem key={mt} value={mt}>
                  {mt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t('category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allCategories')}</SelectItem>
              <SelectItem value="obiad">Obiad</SelectItem>
              <SelectItem value="sniadanie">Śniadanie</SelectItem>
              <SelectItem value="kolacja">Kolacja</SelectItem>
              <SelectItem value="przekaska">Przekąska</SelectItem>
              <SelectItem value="deser">Deser</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {recipes.map((recipe) => (
          <DraggableRecipeCard key={recipe.id} recipe={recipe} />
        ))}

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && recipes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t('noRecipes')}
          </p>
        )}

        {hasMore && !loading && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={handleLoadMore}
          >
            {t('loadMore')} ({recipes.length}/{total})
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function DragDropPlanEditor({
  patientId: _patientId,
  targets,
  initialPlan,
  onSave,
}: DragDropPlanEditorProps) {
  const t = useTranslations('dietitian.planEditor');
  const [state, dispatch] = useReducer(editorReducer, initialPlan, buildInitialState);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const recipe = event.active.data.current?.recipe as Recipe | undefined;
    if (recipe) setActiveRecipe(recipe);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveRecipe(null);
      const { active, over } = event;
      if (!over) return;

      const recipe = active.data.current?.recipe as Recipe | undefined;
      if (!recipe) return;

      const overId = String(over.id);
      if (!overId.startsWith('slot-')) return;

      const parts = overId.split('-');
      const dayIdx = parseInt(parts[1], 10);
      const slotIdx = parseInt(parts[2], 10);

      if (isNaN(dayIdx) || isNaN(slotIdx)) return;

      const nutrition = getRecipeNutrition(recipe.nutritionSnapshot);
      const slotTargetKcal = getSlotTargetKcal(slotIdx, targets.targetKcal);
      const scaleFactor = computeScaleFactor(nutrition.kcal, slotTargetKcal);

      dispatch({
        type: 'SET_RECIPE',
        dayIdx,
        slotIdx,
        recipe: {
          recipeId: recipe.id,
          title: recipe.name,
          kcal: nutrition.kcal,
          protein: nutrition.protein,
          fat: nutrition.fat,
          carbs: nutrition.carbs,
          scaleFactor,
        },
      });
    },
    [targets.targetKcal]
  );

  function handleRemove(dayIdx: number, slotIdx: number) {
    dispatch({ type: 'REMOVE_RECIPE', dayIdx, slotIdx });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const planContent: PlanContent = {
        days: state.days.map((day) => ({
          day: day.name,
          meals: day.slots.map((slot) => ({
            name: slot.mealName,
            mealType: slot.mealType,
            recipe: slot.recipe,
          })),
        })),
      };
      await onSave(planContent);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[600px]">
        {/* ── Main grid area ── */}
        <div className="flex-1 overflow-auto">
          <div className="space-y-4">
            {/* Header row with day names */}
            <div className="grid grid-cols-7 gap-2">
              {state.days.map((day, di) => (
                <div key={di} className="text-center">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {DAY_NAMES_SHORT[di]}
                  </p>
                </div>
              ))}
            </div>

            {/* Meal slot rows */}
            {DEFAULT_SLOTS.map((slotDef, si) => (
              <div key={si}>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 pl-1">
                  {slotDef.mealName} ({Math.round(slotDef.pct * 100)}%)
                </p>
                <div className="grid grid-cols-7 gap-2">
                  {state.days.map((day, di) => (
                    <MealSlotCell
                      key={`${di}-${si}`}
                      dayIdx={di}
                      slotIdx={si}
                      slot={day.slots[si]}
                      targetKcal={getSlotTargetKcal(si, targets.targetKcal)}
                      onRemove={() => handleRemove(di, si)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Day summaries */}
            <div className="grid grid-cols-7 gap-2 pt-2 border-t">
              {state.days.map((day, di) => (
                <DaySummaryBar key={di} day={day} targets={targets} />
              ))}
            </div>

            {/* Week summary */}
            <WeekSummary days={state.days} targets={targets} />

            {/* Save button */}
            <div className="flex justify-end pt-2 pb-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="lg"
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? t('saving') : t('savePlan')}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Recipe sidebar ── */}
        <div className="w-72 shrink-0 border rounded-lg bg-card overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b bg-muted/50">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <ChefHat className="h-4 w-4" />
              {t('recipesPanel')}
            </h3>
          </div>
          <RecipeSidePanel />
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeRecipe ? <RecipeCardPreview recipe={activeRecipe} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
