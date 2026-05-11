'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { cleanIngredientName } from '@/lib/ingredient-display';
import type { DietPlan } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { Flame, Beef, Droplet, Wheat, Edit, ChefHat, Clock, Lightbulb, Code, LayoutGrid, AlertCircle, RefreshCw, Wrench } from 'lucide-react';
import {
  VisualPlanEditor,
  planDataToContent,
  contentToPlanData,
  type PlanData,
} from './VisualPlanEditor';
import { AiReportBanner } from './AiReportBanner';
import { useDayMacros } from './PlanWithToolkit';

// ─── recipe types ────────────────────────────────────────────────────────────

interface RecipeData {
  prepTimeMin: number;
  steps: string[];
  tips?: string;
  variants?: Array<{ appliance: string; prepTimeMin: number; steps: string[]; tips?: string }>;
}

interface MealWithRecipe {
  name: string;
  items: (string | Record<string, unknown>)[];
  recipe?: RecipeData;
}

const APPLIANCE_LABELS: Record<string, string> = { THERMOMIX: 'Thermomix', AIRFRYER: 'Airfryer' };

/** Extract ingredients list from meal items for recipe display */
function extractIngredients(meal: MealWithRecipe): Array<{ name: string; grams: number }> {
  const ingredients: Array<{ name: string; grams: number }> = [];
  for (const item of meal.items) {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      const itemIngredients = obj.ingredients as Array<{ name: string; grams: number }> | undefined;
      if (itemIngredients?.length) {
        for (const ing of itemIngredients) {
          if (ing.name && ing.grams > 0) {
            ingredients.push({
              name: cleanIngredientName(ing.name) ?? ing.name,
              grams: Number(ing.grams),
            });
          }
        }
      }
    }
  }
  return ingredients;
}

function RecipeBlock({ recipe, ingredients, label }: {
  recipe: { prepTimeMin: number; steps: string[]; tips?: string };
  ingredients?: Array<{ name: string; grams: number }>;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold text-primary/70 uppercase tracking-wide">{label}</p>}
      {/* Ingredient list with grams */}
      {ingredients && ingredients.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Składniki</p>
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
        <span>{recipe.prepTimeMin} min</span>
      </div>
      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
        {recipe.steps.map((step, i) => <li key={i}>{step}</li>)}
      </ol>
      {recipe.tips && (
        <div className="flex items-start gap-2 text-xs text-primary/60 bg-muted rounded-md px-3 py-2">
          <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{recipe.tips}</span>
        </div>
      )}
    </div>
  );
}

// ─── content renderer (read-only) ────────────────────────────────────────────

function formatItem(item: string | Record<string, unknown>): string {
  if (typeof item === 'string') return item;
  const parts = [String(item.name ?? '')];
  if (item.grams) parts.push(`${item.grams}g`);
  const macros: string[] = [];
  if (item.kcal) macros.push(`${item.kcal} kcal`);
  if (item.protein) macros.push(`B: ${item.protein}g`);
  if (item.fat) macros.push(`T: ${item.fat}g`);
  if (item.carbs) macros.push(`W: ${item.carbs}g`);
  if (macros.length) parts.push(`(${macros.join(', ')})`);
  return parts.join(' — ');
}

function ViewContent({ content, selectedDays, onToggleDay }: {
  content: Record<string, unknown>;
  selectedDays?: Set<string>;
  onToggleDay?: (day: string) => void;
}) {
  const days = content.days as
    | Array<{ day: string; meals: MealWithRecipe[] }>
    | undefined;

  if (days?.length) {
    return (
      <div className="space-y-4">
        {days.map((d, di) => (
          <div key={di} className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted px-4 py-2 font-semibold text-sm flex items-center gap-2">
              {selectedDays && onToggleDay && (
                <input
                  type="checkbox"
                  checked={selectedDays.has(d.day)}
                  onChange={() => onToggleDay(d.day)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
              )}
              {d.day}
            </div>
            <div className="divide-y divide-border">
              {d.meals?.map((meal, mi) => (
                <div key={mi} className="px-4 py-3">
                  <p className="text-sm font-medium mb-1">{meal.name}</p>
                  {meal.items?.length > 0 && (
                    <ul className="text-sm text-muted-foreground space-y-0.5 list-disc list-inside">
                      {meal.items.map((item, ii) => (
                        <li key={ii}>{formatItem(item)}</li>
                      ))}
                    </ul>
                  )}
                  {meal.recipe && meal.recipe.steps?.length > 0 && (
                    <Accordion type="single" collapsible className="mt-2">
                      <AccordionItem value={`recipe-${di}-${mi}`} className="border-none">
                        <AccordionTrigger className="py-2 text-xs font-medium text-primary/70 hover:text-primary">
                          <span className="flex items-center gap-1.5">
                            <ChefHat className="h-3.5 w-3.5" />
                            Przepis
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-2 pt-0">
                          <div className="space-y-4">
                            <RecipeBlock
                              recipe={meal.recipe}
                              ingredients={extractIngredients(meal)}
                            />
                            {meal.recipe.variants?.map((variant, vi) => (
                              <RecipeBlock
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
        ))}
      </div>
    );
  }

  const text = content.text as string | undefined;
  if (text) {
    return <pre className="text-sm whitespace-pre-wrap text-foreground font-sans leading-relaxed">{text}</pre>;
  }

  return (
    <pre className="text-xs text-muted-foreground font-mono overflow-auto">
      {JSON.stringify(content, null, 2)}
    </pre>
  );
}

// ─── macro display card ───────────────────────────────────────────────────────

function MacroCard({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ElementType;
  label: string;
  value: number | undefined | null;
  unit: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <Icon className="h-5 w-5 text-primary shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold leading-tight">
          {value} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
        </p>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  plan: DietPlan;
  showRegenerateButton?: boolean;
}

export function DietPlanEditor({ plan, showRegenerateButton }: Props) {
  const { setMacros: setDayMacros } = useDayMacros();
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations('dietitian.planDetail');

  const [editing, setEditing] = useState(false);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [jsonSaving, setJsonSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [autoAdjusting, setAutoAdjusting] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [partialRegenerating, setPartialRegenerating] = useState(false);

  const isEditable = !['SENT', 'PUBLISHED'].includes(plan.status);
  const hasKcalIssue = plan.aiProcessingReport?.issues.some(
    i => i.type === 'KCAL_DEVIATION' || i.type === 'HARD_FLOOR' || i.type === 'MACRO_DEVIATION'
  );

  const [generationPhase, setGenerationPhase] = useState('');

  const pollUntilReady = useCallback(async (planId: string, token: string, maxAttempts = 80) => {
    const PHASE_LABELS: Record<string, string> = {
      generating: 'Generowanie planu...',
      completing: 'Uzupełnianie brakujących dni...',
      repairing: 'Naprawianie ograniczeń żywieniowych...',
      done: 'Plan gotowy!',
      failed: 'Generowanie nie powiodło się',
    };

    for (let i = 0; i < maxAttempts; i++) {
      // Progressive interval: 3s for first 30s, then 5s
      const delay = i < 10 ? 3000 : 5000;
      await new Promise(r => setTimeout(r, delay));
      try {
        const statusResult = await api.dietPlans.getStatus(planId, token);
        setGenerationPhase(PHASE_LABELS[statusResult.phase] || 'Przetwarzanie...');

        if (statusResult.status === 'GENERATION_FAILED') {
          const { plan: updated } = await api.dietPlans.getById(planId, token);
          return updated;
        }
        if (statusResult.status !== 'AI_DRAFT') {
          const { plan: updated } = await api.dietPlans.getById(planId, token);
          return updated;
        }
      } catch {
        // continue polling
      }
    }
    return null;
  }, []);

  const [regenMainError, setRegenMainError] = useState('');

  const handleRegenerate = useCallback(async () => {
    const token = '';
    setRegenerating(true);
    setRegenMainError('');
    try {
      const result = await api.dietPlans.triggerGenerate(plan.patientId, token);
      const newPlanId = result.dietPlanId;

      if (!result.n8nTriggered && !result.aiTriggered) {
        // Plan ready immediately (no AI polling needed)
        setGenerationPhase('Plan gotowy!');
        setTimeout(() => setGenerationPhase(''), 2000);
      } else if (result.n8nTriggered || result.aiTriggered) {
        // AI: poll the NEW plan until AI responds (up to ~4 min)
        setGenerationPhase('Generowanie planu przez AI...');
        const updated = await pollUntilReady(newPlanId, token);
        setGenerationPhase('');
        if (!updated) {
          setRegenMainError('Generowanie trwa dłużej niż zwykle. Odśwież stronę za minutę — plan może być już gotowy.');
          return;
        }
        if (updated.status === 'GENERATION_FAILED') {
          setRegenMainError('Generowanie planu nie powiodło się. Spróbuj ponownie lub stwórz plan ręcznie.');
          return;
        }
      }

      // Navigate to the new plan (or same if idempotency returned existing)
      if (newPlanId !== plan.id) {
        router.push(`/dietetyk/pacjenci/${plan.patientId}/plany/${newPlanId}`);
      }
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd';
      setRegenMainError(`Błąd regeneracji: ${msg}`);
    } finally {
      setRegenerating(false);
    }
  }, [session, plan.patientId, plan.id, router, pollUntilReady]);

  const handleAutoAdjust = useCallback(async () => {
    const token = '';
    setAutoAdjusting(true);
    try {
      await api.dietPlans.autoAdjust(plan.id, token);
      router.refresh();
    } catch {
      // silent
    } finally {
      setAutoAdjusting(false);
    }
  }, [session, plan.id, router]);

  const handleToggleDay = useCallback((day: string) => {
    setSelectedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }, []);

  // Compute macros for selected days and push to shared context (DietToolkit reads it)
  useEffect(() => {
    if (selectedDays.size === 0) {
      setDayMacros(null);
      return;
    }

    const days = (plan.content as { days?: Array<{ day: string; meals: Array<{ items: Array<{ kcal?: number; protein?: number; fat?: number; carbs?: number }> }> }> })?.days;
    if (!days) {
      setDayMacros(null);
      return;
    }

    let kcal = 0, protein = 0, fat = 0, carbs = 0;
    let count = 0;
    for (const d of days) {
      if (!selectedDays.has(d.day)) continue;
      count++;
      for (const meal of d.meals ?? []) {
        for (const item of meal.items ?? []) {
          kcal += Number(item.kcal) || 0;
          protein += Number(item.protein) || 0;
          fat += Number(item.fat) || 0;
          carbs += Number(item.carbs) || 0;
        }
      }
    }

    if (count > 1) {
      kcal = Math.round(kcal / count);
      protein = Math.round(protein / count);
      fat = Math.round(fat / count);
      carbs = Math.round(carbs / count);
    } else {
      kcal = Math.round(kcal);
      protein = Math.round(protein);
      fat = Math.round(fat);
      carbs = Math.round(carbs);
    }

    setDayMacros({ kcal, protein, fat, carbs });
  }, [selectedDays, plan.content, setDayMacros]);

  const [regenError, setRegenError] = useState('');

  const handlePartialRegenerate = useCallback(async () => {
    if (selectedDays.size === 0) return;
    const token = '';
    setPartialRegenerating(true);
    setRegenError('');
    try {
      const result = await api.dietPlans.regeneratePartial(plan.id, { days: [...selectedDays] }, token);
      if (!result.triggered) {
        setRegenError(result.message || 'Nie udało się uruchomić regeneracji');
        return;
      }
      // Poll until AI responds (up to ~4 min)
      setGenerationPhase('Regenerowanie zaznaczonych dni...');
      const updated = await pollUntilReady(plan.id, token);
      setGenerationPhase('');
      if (!updated) {
        setRegenError('Regeneracja trwa dłużej niż zwykle. Odśwież stronę za minutę.');
      } else if (updated.status === 'GENERATION_FAILED') {
        setRegenError('Regeneracja nie powiodła się. Spróbuj ponownie.');
      }
      setSelectedDays(new Set());
      router.refresh();
    } catch {
      setRegenError('Wystąpił błąd podczas regeneracji');
      router.refresh();
    } finally {
      setPartialRegenerating(false);
    }
  }, [session, plan.id, selectedDays, router, pollUntilReady]);

  // Try to parse existing content into visual editor format
  const initialDays = contentToPlanData(plan.content);

  function startEditing(useJson: boolean) {
    if (useJson) {
      setJsonText(JSON.stringify(plan.content, null, 2));
      setJsonError('');
      setJsonMode(true);
    } else {
      setJsonMode(false);
    }
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setJsonMode(false);
    setJsonError('');
  }

  async function handleVisualSave(data: PlanData) {
    const token = '';
    const content = planDataToContent(data.days);

    await api.dietPlans.updateContent(
      plan.id,
      {
        kcal: data.kcal,
        proteinG: data.proteinG,
        fatG: data.fatG,
        carbsG: data.carbsG,
        content,
      },
      token
    );
    setEditing(false);
    router.refresh();
  }

  async function handleJsonSave() {
    setJsonError('');

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      setJsonError(t('jsonParseError'));
      return;
    }

    // Validate that it has days array
    const days = parsed.days as unknown[] | undefined;
    if (!Array.isArray(days) || days.length !== 7) {
      setJsonError(t('jsonMissingDays'));
      return;
    }

    // Calculate macros from content if possible
    const parsedDays = contentToPlanData(parsed);
    let kcal = 0;
    let proteinG = 0;
    let fatG = 0;
    let carbsG = 0;

    if (parsedDays) {
      const content = planDataToContent(parsedDays);
      parsed = content; // Use normalized content

      // Calculate average daily macros
      for (const day of parsedDays) {
        for (const meal of day.meals) {
          for (const item of meal.items) {
            kcal += item.kcal || 0;
            proteinG += item.protein || 0;
            fatG += item.fat || 0;
            carbsG += item.carbs || 0;
          }
        }
      }
      const numDays = parsedDays.length || 1;
      kcal = Math.round(kcal / numDays);
      proteinG = Math.round(proteinG / numDays);
      fatG = Math.round(fatG / numDays);
      carbsG = Math.round(carbsG / numDays);
    }

    setJsonSaving(true);
    try {
      const token = '';
      await api.dietPlans.updateContent(
        plan.id,
        { kcal, proteinG, fatG, carbsG, content: parsed },
        token
      );
      setEditing(false);
      setJsonMode(false);
      router.refresh();
    } catch {
      setJsonError(t('saveError'));
    } finally {
      setJsonSaving(false);
    }
  }

  // Edit mode — JSON
  if (editing && jsonMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('editPlan')}</h2>
          <div className="flex gap-2">
            {initialDays && (
              <Button variant="outline" size="sm" onClick={() => startEditing(false)} className="gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5" />
                {t('visualMode')}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={cancelEditing}>
              {t('cancelEdit')}
            </Button>
          </div>
        </div>
        <Textarea
          value={jsonText}
          onChange={(e) => { setJsonText(e.target.value); setJsonError(''); }}
          className="font-mono text-xs min-h-[400px] resize-y"
          rows={20}
        />
        {jsonError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {jsonError}
          </div>
        )}
        <Button onClick={handleJsonSave} disabled={jsonSaving} className="w-full" size="lg">
          {jsonSaving ? t('saving') : t('savePlan')}
        </Button>
      </div>
    );
  }

  // Edit mode — Visual editor
  if (editing && initialDays) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('editPlan')}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => startEditing(true)} className="gap-1.5">
              <Code className="h-3.5 w-3.5" />
              {t('jsonMode')}
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelEditing}>
              {t('cancelEdit')}
            </Button>
          </div>
        </div>
        <VisualPlanEditor
          initialDays={initialDays}
          onSave={handleVisualSave}
          saveLabel={t('savePlan')}
          savingLabel={t('saving')}
        />
      </div>
    );
  }

  // Read-only view
  return (
    <div className="space-y-4">
      {/* Generation source badge — only visible for ADMIN */}
      {plan.aiModel === 'database' && session?.user?.role === 'ADMIN' && (
        <div className="flex items-center gap-2 rounded-lg border border-sage-200 bg-sage-50/50 px-4 py-2.5 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-medium text-sage-700">
            DB
          </span>
          <span className="text-muted-foreground">
            Plan wygenerowany z bazy przepisów (natychmiast, 0 PLN)
          </span>
        </div>
      )}

      {/* Top-level regenerate button */}
      {showRegenerateButton && isEditable && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <Button
              onClick={handleRegenerate}
              disabled={regenerating || partialRegenerating}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'Trwa generowanie...' : 'Regeneruj plan przez AI'}
            </Button>
            {regenerating && (
              <span className="text-sm text-muted-foreground">
                {generationPhase || 'Oczekiwanie na odpowiedź AI...'}
              </span>
            )}
          </div>
          {regenMainError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {regenMainError}
            </div>
          )}
        </div>
      )}

      {/* AI Processing Report (32.2.4) + Regeneration actions (32.2.5-32.2.6) */}
      {plan.aiProcessingReport && (
        <div className="space-y-3">
          <AiReportBanner report={plan.aiProcessingReport} />
          {isEditable && plan.aiProcessingReport.issues.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating || autoAdjusting}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                {regenerating ? 'Generowanie...' : 'Wygeneruj ponownie'}
              </Button>
              {hasKcalIssue && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoAdjust}
                  disabled={regenerating || autoAdjusting}
                  className="gap-1.5"
                >
                  <Wrench className={`h-3.5 w-3.5 ${autoAdjusting ? 'animate-spin' : ''}`} />
                  {autoAdjusting ? 'Korygowanie...' : 'Napraw automatycznie'}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Macros */}
      <Card className="border-border">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base">{t('macros')}</CardTitle>
          {isEditable && !editing && (
            <div className="flex gap-1">
              {initialDays && (
                <Button variant="ghost" size="sm" onClick={() => startEditing(false)} className="gap-1.5">
                  <Edit className="h-3.5 w-3.5" />
                  {t('editPlan')}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => startEditing(true)} className="gap-1.5">
                <Code className="h-3.5 w-3.5" />
                {t('jsonMode')}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MacroCard icon={Flame} label={t('kcalLabel')} value={plan.kcal} unit="kcal" />
            <MacroCard icon={Beef} label={t('proteinLabel')} value={plan.proteinG} unit="g" />
            <MacroCard icon={Droplet} label={t('fatLabel')} value={plan.fatG} unit="g" />
            <MacroCard icon={Wheat} label={t('carbsLabel')} value={plan.carbsG} unit="g" />
            {!plan.kcal && !plan.proteinG && !plan.fatG && !plan.carbsG && (
              <p className="text-sm text-muted-foreground col-span-4">{t('noMacros')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('contentTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ViewContent
            content={plan.content}
            selectedDays={isEditable ? selectedDays : undefined}
            onToggleDay={isEditable ? handleToggleDay : undefined}
          />
          {isEditable && selectedDays.size > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePartialRegenerate}
                disabled={partialRegenerating || regenerating}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${partialRegenerating ? 'animate-spin' : ''}`} />
                {partialRegenerating
                  ? 'Oczekiwanie na AI...'
                  : `Regeneruj zaznaczone (${selectedDays.size})`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDays(new Set())}
              >
                Wyczyść
              </Button>
            </div>
          )}
          {regenError && (
            <div className="mt-3 flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {regenError}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
