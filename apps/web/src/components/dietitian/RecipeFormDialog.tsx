'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import { cleanIngredientName } from '@/lib/ingredient-display';
import type { Recipe, NutritionPreview } from '@/types/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronUp, ChevronDown, Check, Loader2 } from 'lucide-react';
import { IngredientPicker, type IngredientRow } from './IngredientPicker';

// ─── Tag auto-fill logic ─────────────────────────────────────────────────────

const TAG_TO_MEAL: Record<string, string> = {
  'śniadanie': 'breakfast', 'sniadanie': 'breakfast', 'breakfast': 'breakfast',
  'obiad': 'lunch', 'lunch': 'lunch',
  'kolacja': 'dinner', 'dinner': 'dinner',
  'przekąska': 'snack', 'przekaska': 'snack', 'snack': 'snack',
};
const TAG_TO_CATEGORY: Record<string, string> = {
  'danie główne': 'main', 'danie glowne': 'main', 'main': 'main',
  'zupa': 'soup', 'soup': 'soup',
  'sałatka': 'salad', 'salatka': 'salad', 'salad': 'salad',
  'deser': 'dessert', 'dessert': 'dessert',
};
// Normalize free-text DB categories (e.g. "Dania główne") to enum values
const CATEGORY_NORMALIZE: Record<string, string> = {
  'dania główne': 'main', 'dania glowne': 'main', 'danie główne': 'main', 'danie glowne': 'main', 'main': 'main',
  'zupy': 'soup', 'zupa': 'soup', 'soup': 'soup',
  'sałatki': 'salad', 'salatki': 'salad', 'sałatka': 'salad', 'salatka': 'salad', 'salad': 'salad',
  'desery': 'dessert', 'deser': 'dessert', 'dessert': 'dessert',
  'inne': 'other', 'other': 'other',
};
const TAG_TO_DIFFICULTY: Record<string, string> = {
  'łatwy': 'easy', 'łatwe': 'easy', 'latwy': 'easy', 'szybkie': 'easy', 'szybki': 'easy', 'proste': 'easy', 'prosty': 'easy', 'easy': 'easy',
  'średni': 'medium', 'sredni': 'medium', 'medium': 'medium',
  'trudny': 'hard', 'trudne': 'hard', 'hard': 'hard',
};

const MEAL_ENUM_MAP: Record<string, string> = {
  breakfast: 'breakfast', second_breakfast: 'second_breakfast',
  lunch: 'lunch', dinner: 'dinner', supper: 'supper', snack: 'snack',
  dessert: 'dessert', drink: 'drink', sauce: 'sauce', side_dish: 'side_dish',
};
const MEAL_LABEL_KEY: Record<string, string> = {
  breakfast: 'mealBreakfast', second_breakfast: 'mealSecondBreakfast',
  lunch: 'mealLunch', dinner: 'mealDinner', supper: 'mealSupper',
  snack: 'mealSnack', dessert: 'mealDessert', drink: 'mealDrink',
  sauce: 'mealSauce', side_dish: 'mealSideDish',
};
const DIFF_ENUM_MAP: Record<string, string> = {
  easy: 'easy', medium: 'medium', hard: 'hard',
};

function autoFillFromTags(tagList: string[]): { meal?: string; cat?: string; diff?: string } {
  let meal: string | undefined;
  let cat: string | undefined;
  let diff: string | undefined;
  for (const tag of tagList.map(t => t.trim().toLowerCase()).filter(Boolean)) {
    if (!meal && TAG_TO_MEAL[tag]) meal = TAG_TO_MEAL[tag];
    if (!cat && TAG_TO_CATEGORY[tag]) cat = TAG_TO_CATEGORY[tag];
    if (!diff && TAG_TO_DIFFICULTY[tag]) diff = TAG_TO_DIFFICULTY[tag];
  }
  return { meal, cat, diff };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecipeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: Recipe | null;
  token: string;
  onSaved: () => void;
  translationNamespace?: string;
  apiNamespace?: 'recipes' | 'adminRecipes';
  cleanProductNamespace?: 'cleanProducts' | 'adminCleanProducts';
}

type StepPhase = 'prep' | 'cook';

interface StepInput {
  instruction: string;
  durationMinutes: string;
  phase: StepPhase;
}

const WIZARD_STEPS = [1, 2, 3, 4] as const;

// ─── Main Component ──────────────────────────────────────────────────────────

export function RecipeFormDialog({
  open,
  onOpenChange,
  recipe,
  token,
  onSaved,
  translationNamespace = 'dietitian.recipes',
  apiNamespace = 'recipes',
  cleanProductNamespace = 'cleanProducts',
}: RecipeFormDialogProps) {
  const t = useTranslations(translationNamespace);
  const isEdit = !!recipe;

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Basics
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [mealType, setMealType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('4');
  const [tags, setTags] = useState('');
  const [tips, setTips] = useState('');
  const [notesDietitian, setNotesDietitian] = useState('');

  // Step 2: Ingredients
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);

  // Step 3: Steps
  const [steps, setSteps] = useState<StepInput[]>([{ instruction: '', durationMinutes: '', phase: 'prep' }]);

  // Step 4: Preview
  const [nutritionPreview, setNutritionPreview] = useState<NutritionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // General
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ─── Init / Reset ────────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setNutritionPreview(null);
      setError('');
      setSuccess('');

      if (recipe) {
        setName(recipe.name);
        setNameEn(recipe.nameEn ?? '');
        setDescription(recipe.description ?? '');
        setPrepTime(recipe.prepTimeMinutes ? String(recipe.prepTimeMinutes) : '');
        setCookTime(recipe.cookTimeMinutes ? String(recipe.cookTimeMinutes) : '');
        setServings(recipe.servings ? String(recipe.servings) : '4');
        setTags(recipe.tags?.join(', ') ?? '');
        setTips((recipe as { tips?: string }).tips ?? '');
        setNotesDietitian((recipe as { notesDietitian?: string }).notesDietitian ?? '');
        setSteps(
          recipe.steps?.length
            ? recipe.steps.map(s => ({ instruction: s.instruction, durationMinutes: s.durationMinutes ? String(s.durationMinutes) : '', phase: (s.phase as StepPhase) || 'prep' }))
            : [{ instruction: '', durationMinutes: '', phase: 'prep' }]
        );
        // Map existing ingredients
        if (recipe.ingredients?.length) {
          setIngredients(
            recipe.ingredients.map((ing, idx) => ({
              id: `edit-${ing.id}`,
              cleanProductId: ing.cleanProductId ?? ing.cleanProduct?.id ?? '',
              foodProductId: ing.foodProductId ?? ing.foodProduct?.id ?? undefined,
              productName:
                ing.cleanProduct?.name ??
                ing.foodProduct?.name ??
                cleanIngredientName(ing.displayName) ??
                '?',
              portions: ing.cleanProduct?.portions ?? [],
              nutrientsPer100g: {
                kcal: ing.cleanProduct?.nutrients?.kcalPer100g ?? 0,
                protein: ing.cleanProduct?.nutrients?.proteinPer100g ?? 0,
                fat: ing.cleanProduct?.nutrients?.fatPer100g ?? 0,
                carbs: ing.cleanProduct?.nutrients?.carbsPer100g ?? 0,
              },
              quantity: Number(ing.quantity) || 0,
              unit: ing.unit ?? 'g',
              grams: Number(ing.grams) || 0,
              isOptional: ing.isOptional,
              groupName: ing.groupName ?? '',
              notes: ing.notes ?? '',
              sortOrder: idx,
            }))
          );
        } else {
          setIngredients([]);
        }
        const { meal, cat, diff } = autoFillFromTags(recipe.tags ?? []);
        const normMeal = MEAL_ENUM_MAP[recipe.mealType?.toLowerCase() ?? ''] || recipe.mealType?.toLowerCase() || '';
        const rawCat = recipe.category?.toLowerCase() || '';
        const normCat = CATEGORY_NORMALIZE[rawCat] || rawCat;
        const normDiff = DIFF_ENUM_MAP[recipe.difficulty?.toLowerCase() ?? ''] || recipe.difficulty?.toLowerCase() || '';
        setCategory(normCat || cat || '');
        setMealType(normMeal || meal || '');
        setDifficulty(normDiff || diff || '');
      } else {
        setName('');
        setNameEn('');
        setDescription('');
        setCategory('');
        setMealType('');
        setDifficulty('');
        setPrepTime('');
        setCookTime('');
        setServings('4');
        setTags('');
        setSteps([{ instruction: '', durationMinutes: '', phase: 'prep' }]);
        setIngredients([]);
      }
    }
  }, [open, recipe]);

  // ─── Tag auto-fill ───────────────────────────────────────────────────────

  const handleTagsChange = (value: string) => {
    setTags(value);
    const { meal, cat, diff } = autoFillFromTags(value.split(','));
    if (!mealType && meal) setMealType(meal);
    if (!category && cat) setCategory(cat);
    if (!difficulty && diff) setDifficulty(diff);
  };

  // ─── Steps management ────────────────────────────────────────────────────

  const addStep = () => setSteps(prev => [...prev, { instruction: '', durationMinutes: '', phase: 'prep' }]);
  const removeStep = (idx: number) => setSteps(prev => prev.filter((_, i) => i !== idx));
  const updateStep = (idx: number, field: keyof StepInput, value: string) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };
  const moveStep = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    setSteps(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  // ─── Auto-calc prep/cook time from steps ─────────────────────────────────

  const calcTimesFromSteps = useCallback(() => {
    let prep = 0;
    let cook = 0;
    for (const s of steps) {
      const mins = Number(s.durationMinutes) || 0;
      if (s.phase === 'cook') cook += mins;
      else prep += mins;
    }
    return { prep, cook };
  }, [steps]);

  const applyStepTimes = () => {
    const { prep, cook } = calcTimesFromSteps();
    setPrepTime(prep > 0 ? String(prep) : '');
    setCookTime(cook > 0 ? String(cook) : '');
  };

  // ─── Step validation ─────────────────────────────────────────────────────

  function canGoNext(): boolean {
    switch (currentStep) {
      case 1: return name.trim().length > 0;
      case 2: return ingredients.length > 0 && ingredients.every(i => i.grams > 0 && (i.cleanProductId || i.foodProductId));
      case 3: return steps.some(s => s.instruction.trim().length > 0);
      default: return true;
    }
  }

  // ─── Nutrition preview ───────────────────────────────────────────────────

  const cleanProductApi = api[cleanProductNamespace] as typeof api.cleanProducts;

  const loadPreview = useCallback(async () => {
    // Only include ingredients with a real cleanProductId (skip legacy foodProduct-only items)
    const valid = ingredients.filter(i => i.cleanProductId && !i.foodProductId && i.grams > 0);
    if (valid.length === 0) return;
    setPreviewLoading(true);
    try {
      const result = await cleanProductApi.previewNutrition(
        valid.map(i => ({ cleanProductId: i.cleanProductId, grams: Number(i.grams) })),
        Math.max(1, Math.round(Number(servings) || 1)),
        token
      );
      setNutritionPreview(result);
    } catch (err) {
      console.error('Failed to load nutrition preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, [ingredients, servings, token, cleanProductApi]);

  // Load preview when entering step 4
  useEffect(() => {
    if (currentStep === 4) {
      loadPreview();
    }
  }, [currentStep, loadPreview]);

  // ─── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    const stepsData = steps
      .filter(s => s.instruction.trim())
      .map((s, i) => ({
        stepNumber: i + 1,
        instruction: s.instruction.trim(),
        durationMinutes: s.durationMinutes ? Number(s.durationMinutes) : undefined,
        phase: s.phase,
      }));

    const ingredientsData = ingredients.map((ing, idx) => ({
      cleanProductId: ing.cleanProductId || undefined,
      foodProductId: ing.foodProductId || undefined,
      sortOrder: idx,
      quantity: ing.quantity,
      unit: ing.unit,
      grams: ing.grams,
      isOptional: ing.isOptional || undefined,
      groupName: ing.groupName || undefined,
      notes: ing.notes || undefined,
    }));

    const data = {
      name,
      nameEn: nameEn || undefined,
      description: description || undefined,
      category: category || undefined,
      mealType: mealType || undefined,
      difficulty: difficulty || undefined,
      prepTimeMinutes: prepTime ? Number(prepTime) : undefined,
      cookTimeMinutes: cookTime ? Number(cookTime) : undefined,
      servings: servings ? Number(servings) : undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      tips: tips || undefined,
      notesDietitian: notesDietitian || undefined,
      ingredients: ingredientsData,
      steps: stepsData.length ? stepsData : undefined,
    };

    try {
      if (isEdit) {
        await api[apiNamespace].update(recipe.id, data, token);
        setSuccess(t('updateSuccess'));
      } else {
        await api[apiNamespace].create(data, token);
        setSuccess(t('createSuccess'));
      }
      setTimeout(() => onSaved(), 500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  // ─── Render helpers ──────────────────────────────────────────────────────

  const stepLabels = [t('wizardStep1'), t('wizardStep2'), t('wizardStep3'), t('wizardStep4')];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editRecipe') : t('addRecipe')}</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-4">
          {WIZARD_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => {
                // Allow going back, or forward only if valid
                if (step < currentStep || (step === currentStep + 1 && canGoNext())) {
                  setCurrentStep(step);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                step === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : step < currentStep
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {step < currentStep ? (
                <Check className="h-3 w-3" />
              ) : (
                <span>{step}</span>
              )}
              <span className="hidden sm:inline">{stepLabels[step - 1]}</span>
            </button>
          ))}
        </div>

        {/* Step 1: Basics */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="r-name">{t('formName')} *</Label>
              <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="r-nameEn">{t('formNameEn')}</Label>
              <Input id="r-nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="r-desc">{t('formDescription')}</Label>
              <Textarea id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('formCategory')}</Label>
                <Select value={category || 'none'} onValueChange={(v) => setCategory(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="main">{t('categoryMain')}</SelectItem>
                    <SelectItem value="soup">{t('categorySoup')}</SelectItem>
                    <SelectItem value="salad">{t('categorySalad')}</SelectItem>
                    <SelectItem value="dessert">{t('categoryDessert')}</SelectItem>
                    <SelectItem value="other">{t('categoryOther')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('formMealType')}</Label>
                <Select value={mealType || 'none'} onValueChange={(v) => setMealType(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="breakfast">{t('mealBreakfast')}</SelectItem>
                    <SelectItem value="second_breakfast">{t('mealSecondBreakfast')}</SelectItem>
                    <SelectItem value="lunch">{t('mealLunch')}</SelectItem>
                    <SelectItem value="dinner">{t('mealDinner')}</SelectItem>
                    <SelectItem value="supper">{t('mealSupper')}</SelectItem>
                    <SelectItem value="snack">{t('mealSnack')}</SelectItem>
                    <SelectItem value="dessert">{t('mealDessert')}</SelectItem>
                    <SelectItem value="drink">{t('mealDrink')}</SelectItem>
                    <SelectItem value="sauce">{t('mealSauce')}</SelectItem>
                    <SelectItem value="side_dish">{t('mealSideDish')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('formDifficulty')}</Label>
              <Select value={difficulty || 'none'} onValueChange={(v) => setDifficulty(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="easy">{t('difficultyEasy')}</SelectItem>
                  <SelectItem value="medium">{t('difficultyMedium')}</SelectItem>
                  <SelectItem value="hard">{t('difficultyHard')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="r-servings">{t('formServings')}</Label>
                <Input id="r-servings" type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-tags">{t('formTags')}</Label>
                <Input id="r-tags" value={tags} onChange={(e) => handleTagsChange(e.target.value)} placeholder="zdrowe, szybkie, fit" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="r-tips">{t('formTips')}</Label>
              <Textarea id="r-tips" value={tips} onChange={(e) => setTips(e.target.value)} rows={2} placeholder={t('formTipsPlaceholder')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="r-notes">{t('formNotesDietitian')}</Label>
              <Textarea id="r-notes" value={notesDietitian} onChange={(e) => setNotesDietitian(e.target.value)} rows={2} placeholder={t('formNotesDietitianPlaceholder')} />
            </div>
          </div>
        )}

        {/* Step 2: Ingredients */}
        {currentStep === 2 && (
          <>
            <IngredientPicker
              ingredients={ingredients}
              onChange={setIngredients}
              token={token}
              translationNamespace={translationNamespace}
              cleanProductNamespace={cleanProductNamespace}
            />
            {ingredients.length > 0 && !ingredients.every(i => i.grams > 0) && (
              <p className="text-xs text-destructive mt-2">{t('formIngredientGramsError')}</p>
            )}
          </>
        )}

        {/* Step 3: Preparation Steps */}
        {currentStep === 3 && (
          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <span className="text-xs text-muted-foreground pt-2 min-w-[20px]">{idx + 1}.</span>
                <div className="flex-1 space-y-1">
                  <Textarea
                    value={step.instruction}
                    onChange={(e) => updateStep(idx, 'instruction', e.target.value)}
                    placeholder={t('formStepInstruction')}
                    rows={2}
                  />
                </div>
                <div className="w-20 space-y-1">
                  {idx === 0 && <span className="text-[11px] text-muted-foreground">{t('formStepDuration')}</span>}
                  <Input
                    type="number"
                    min="0"
                    value={step.durationMinutes}
                    onChange={(e) => updateStep(idx, 'durationMinutes', e.target.value)}
                    placeholder={t('min')}
                  />
                </div>
                <div className="w-[72px] space-y-1">
                  {idx === 0 && <span className="text-[11px] text-muted-foreground">{t('formStepPhase')}</span>}
                  <Select value={step.phase} onValueChange={(v) => updateStep(idx, 'phase', v)}>
                    <SelectTrigger className="h-9 text-xs px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prep">{t('phasePrep')}</SelectItem>
                      <SelectItem value="cook">{t('phaseCook')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveStep(idx, -1)} disabled={idx === 0}>
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                {steps.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(idx)} className="shrink-0">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addStep} className="gap-1">
                <Plus className="h-3 w-3" />
                {t('formAddStep')}
              </Button>
            </div>
            {/* Time summary from steps */}
            {steps.some(s => s.durationMinutes) && (() => {
              const { prep, cook } = calcTimesFromSteps();
              return (
                <p className="text-xs text-muted-foreground">
                  {t('formStepTimeSummary', { prep, cook, total: prep + cook })}
                </p>
              );
            })()}
          </div>
        )}

        {/* Step 4: Summary + Nutrition Preview */}
        {currentStep === 4 && (
          <div className="space-y-4">
            {/* Nutrition */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">{t('wizardPreviewNutrition')}</h3>
              {previewLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('wizardPreviewLoading')}
                </div>
              ) : nutritionPreview ? (
                <div className="space-y-3">
                  {/* Per serving */}
                  <div className="grid grid-cols-4 gap-2">
                    {(['kcal', 'protein', 'fat', 'carbs'] as const).map((key) => {
                      const val = nutritionPreview.perServing[key];
                      const display = key === 'kcal'
                        ? Math.round(val)
                        : (Math.round(val * 10) / 10).toFixed(1);
                      return (
                        <div key={key} className="text-center p-2 rounded-lg bg-muted">
                          <div className="text-lg font-semibold">
                            {display}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t(key)}{key !== 'kcal' ? ' (g)' : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('wizardPerServing')} ({nutritionPreview.servings} {t('servings').toLowerCase()})
                  </p>

                  {/* Breakdown */}
                  {nutritionPreview.breakdown.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-xs">
                        {t('wizardIngredientBreakdown')}
                      </summary>
                      <div className="mt-2 space-y-1">
                        {nutritionPreview.breakdown.map((item) => (
                          <div
                            key={item.cleanProductId}
                            className={`flex justify-between text-xs rounded px-1 ${
                              item.hasMicronutrients === false
                                ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400'
                                : ''
                            }`}
                          >
                            <span className="truncate flex-1">
                              {item.name} ({item.grams}g)
                              {item.hasMicronutrients === false && (
                                <span className="ml-1 text-[10px] opacity-70">({t('wizardNoMicro')})</span>
                              )}
                            </span>
                            <span className={`ml-2 ${item.hasMicronutrients === false ? '' : 'text-muted-foreground'}`}>
                              {Math.round(item.kcal)} kcal
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Warnings */}
                  {nutritionPreview.warnings?.length > 0 && (
                    <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                      {nutritionPreview.warnings.join('; ')}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Summary */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{name}</Badge>
                {category && <Badge variant="secondary">{
                  ['main', 'soup', 'salad', 'dessert', 'other'].includes(category)
                    ? t(`category${category.charAt(0).toUpperCase()}${category.slice(1)}`)
                    : category
                }</Badge>}
                {mealType && <Badge variant="secondary">{t(MEAL_LABEL_KEY[mealType] ?? mealType)}</Badge>}
                {difficulty && <Badge variant="secondary">{
                  ['easy', 'medium', 'hard'].includes(difficulty)
                    ? t(`difficulty${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)}`)
                    : difficulty
                }</Badge>}
              </div>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
              {(prepTime || cookTime) && (
                <div className="flex gap-4 text-sm">
                  {prepTime && (
                    <span className="text-muted-foreground">
                      {t('prepTime')}: <span className="font-medium text-foreground">{prepTime} min</span>
                    </span>
                  )}
                  {cookTime && (
                    <span className="text-muted-foreground">
                      {t('cookTime')}: <span className="font-medium text-foreground">{cookTime} min</span>
                    </span>
                  )}
                  {prepTime && cookTime && (
                    <span className="text-muted-foreground">
                      {t('totalTime')}: <span className="font-medium text-foreground">{Number(prepTime) + Number(cookTime)} min</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Ingredient summary */}
            <div className="space-y-1 border-t pt-3">
              <h4 className="text-sm font-medium">{t('ingredients')} ({ingredients.length})</h4>
              {ingredients.map((ing) => (
                <div key={ing.id} className="text-xs text-muted-foreground flex gap-1">
                  <span>{ing.productName}</span>
                  <span>— {ing.grams}g</span>
                  {ing.isOptional && <span className="italic">({t('optional')})</span>}
                </div>
              ))}
            </div>

            {/* Steps summary */}
            <div className="space-y-1 border-t pt-3">
              <h4 className="text-sm font-medium">{t('preparation')} ({steps.filter(s => s.instruction.trim()).length})</h4>
              {steps.filter(s => s.instruction.trim()).map((step, idx) => (
                <div key={idx} className="text-xs text-muted-foreground">
                  {idx + 1}. {step.instruction.trim().slice(0, 80)}
                  {step.instruction.trim().length > 80 ? '…' : ''}
                  {step.durationMinutes && <span className="ml-1">({step.durationMinutes} min)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error / Success */}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          <div>
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
                {t('wizardPrev')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            {currentStep < 4 ? (
              <Button
                type="button"
                onClick={() => {
                  // Auto-calculate times when moving from step 3 to step 4
                  if (currentStep === 3) {
                    applyStepTimes();
                  }
                  setCurrentStep(currentStep + 1);
                }}
                disabled={!canGoNext()}
              >
                {t('wizardNext')}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  t('wizardSave')
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
