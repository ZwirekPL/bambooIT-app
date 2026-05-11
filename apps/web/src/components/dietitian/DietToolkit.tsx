'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { DietToolkitData } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Activity,
  Lightbulb,
  ShieldAlert,
  Apple,
  FileText,
  Target,
  User,
  Scale,
  Wrench,
  Loader2,
  Check,
} from 'lucide-react';

interface SwapSuggestion {
  dayIndex: number;
  slotIndex: number;
  dayName: string;
  mealType: string;
  currentRecipe: { recipeId: string; title: string; adjustedScore: number };
  confidence: string;
  reasons: string[];
  alternatives: Array<{
    recipeId: string;
    title: string;
    adjustedScore: number;
    rejectionReason: string;
    scoreDiff: number;
  }>;
}

interface DietToolkitProps {
  patientId: string;
  token: string;
  planId?: string;
  /** Current day macros from the plan editor */
  currentDayMacros?: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
  } | null;
}

// ─── Accordion Section ───────────────────────────────────────────────────────

function Section({
  title,
  icon,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
          {badge}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// ─── Goal / Diet labels ──────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Redukcja masy ciała',
  gain_weight: 'Przybranie masy',
  maintain_weight: 'Utrzymanie masy',
  muscle_gain: 'Budowa masy mięśniowej',
  health_improvement: 'Poprawa zdrowia',
  sport_performance: 'Wydolność sportowa',
};

const DIET_LABELS: Record<string, string> = {
  STANDARD: 'Standardowa',
  VEGE: 'Wegetariańska',
  VEGAN: 'Wegańska',
  GLUTEN_FREE: 'Bezglutenowa',
  LACTOSE_FREE: 'Bez laktozy',
  KETO: 'Ketogeniczna',
  MEDITERRANEAN: 'Śródziemnomorska',
};

const SEX_LABELS: Record<string, string> = {
  male: 'M',
  female: 'K',
  MALE: 'M',
  FEMALE: 'K',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

// ─── Progress bar ────────────────────────────────────────────────────────────

function MacroBar({
  label,
  current,
  target,
  unit = 'g',
}: {
  label: string;
  current: number;
  target: number;
  unit?: string;
}) {
  const pct = target > 0 ? Math.round((current / target) * 100) : 0;
  const diff = current - target;
  const color =
    Math.abs(pct - 100) <= 5
      ? 'bg-green-500'
      : Math.abs(pct - 100) <= 15
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {current}{unit} / {target}{unit}
          <span className={`ml-1 ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-amber-600' : 'text-green-600'}`}>
            ({diff > 0 ? '+' : ''}{diff}{unit})
          </span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: 'Śniadanie',
  SECOND_BREAKFAST: 'II śniadanie',
  LUNCH: 'Obiad',
  DINNER: 'Kolacja',
  SUPPER: 'Podwieczorek',
  SNACK: 'Przekąska',
  DESSERT: 'Deser',
};

export function DietToolkit({ patientId, token, planId, currentDayMacros }: DietToolkitProps) {
  const t = useTranslations('dietitian.toolkit');
  const router = useRouter();
  const [data, setData] = useState<DietToolkitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [swapSuggestions, setSwapSuggestions] = useState<SwapSuggestion[]>([]);
  const [swapWarnings, setSwapWarnings] = useState<string[]>([]);
  const [swapTotal, setSwapTotal] = useState(0);
  const [expandedSwap, setExpandedSwap] = useState<number | null>(null);
  const [repairing, setRepairing] = useState<string | null>(null);
  const [repaired, setRepaired] = useState<Set<string>>(new Set());

  // Re-fetch suggestions from backend (fresh analysis of current slotDecisions)
  const refreshSuggestions = useCallback(async () => {
    if (!planId) return;
    try {
      const res = await api.dietPlans.getSwapSuggestions(planId, token);
      if (res.ok) {
        setSwapSuggestions(
          [...res.suggestions].sort((a, b) => a.dayIndex - b.dayIndex || a.slotIndex - b.slotIndex),
        );
        setSwapWarnings(res.softWarnings);
        setSwapTotal(res.totalSlots);
      }
    } catch { /* ignore */ }
  }, [planId, token]);

  const handleRepair = useCallback(async (dayIndex: number, slotIndex: number, targetRecipeId?: string) => {
    if (!planId) return;
    const key = `${dayIndex}:${slotIndex}`;
    setRepairing(key);
    try {
      const result = await api.dietPlans.repairSlot(planId, { dayIndex, slotIndex, targetRecipeId }, token);
      if (result.ok) {
        setRepaired((prev) => new Set(prev).add(key));
        // Refresh server data so DietPlanEditor shows updated plan content
        router.refresh();
        // Re-fetch suggestions from backend (fresh analysis)
        await refreshSuggestions();
      }
    } catch {
      // On error, re-fetch suggestions to ensure consistency with DB state
      await refreshSuggestions();
    }
    finally { setRepairing(null); }
  }, [planId, token, router, refreshSuggestions]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    api.dietToolkit
      .get(patientId, token)
      .then((res) => {
        if (!cancelled) setData(res.toolkit);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, token]);

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    api.dietPlans.getSwapSuggestions(planId, token)
      .then((res) => {
        if (!cancelled && res.ok) {
          setSwapSuggestions(
            [...res.suggestions].sort((a, b) => a.dayIndex - b.dayIndex || a.slotIndex - b.slotIndex),
          );
          setSwapWarnings(res.softWarnings);
          setSwapTotal(res.totalSlots);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [planId, token]);

  if (loading) {
    return (
      <div className="w-80 rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
        {t('loading') ?? 'Ładowanie...'}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-80 rounded-lg border bg-card p-4 text-center text-sm text-destructive">
        {t('error') ?? 'Nie udało się załadować danych'}
      </div>
    );
  }

  const { patient, nutritionTargets, chronicDiseases, allergens, recentNotes, policyEngine } = data;
  const hasCritical = chronicDiseases.some((d) => d.severity === 'critical');

  return (
    <div className="w-80 rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* Patient header — always visible */}
      <div className="px-3 py-3 bg-muted/30 border-b">
        <div className="flex items-center gap-2 mb-1.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">
            {patient.firstName ?? ''} {patient.lastName ?? ''}
          </span>
          {hasCritical && (
            <AlertTriangle className="h-4 w-4 text-red-500 ml-auto" />
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          {patient.sex && <span>{SEX_LABELS[patient.sex] ?? patient.sex}</span>}
          {patient.age != null && <span>· {patient.age} lat</span>}
          {patient.bmi != null && (
            <span className="flex items-center gap-0.5">
              · <Scale className="h-3 w-3" /> BMI {patient.bmi}
            </span>
          )}
          {patient.weightKg != null && <span>· {patient.weightKg} kg</span>}
          {patient.heightCm != null && <span>· {patient.heightCm} cm</span>}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {data.mainGoal && (
            <Badge variant="secondary" className="text-[10px]">
              {GOAL_LABELS[data.mainGoal] ?? data.mainGoal}
            </Badge>
          )}
          {data.dietType && (
            <Badge variant="outline" className="text-[10px]">
              {DIET_LABELS[data.dietType] ?? data.dietType}
            </Badge>
          )}
        </div>
      </div>

      {/* Macro targets */}
      {nutritionTargets && (
        <Section
          title={t('macroTargets') ?? 'Cele makro'}
          icon={<Target className="h-4 w-4" />}
          defaultOpen={true}
          badge={currentDayMacros ? (
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-300 text-blue-700 bg-blue-50">
              zaznaczony dzień
            </Badge>
          ) : undefined}
        >
          <div className="space-y-2.5">
            {!currentDayMacros && (
              <p className="text-[10px] text-muted-foreground italic">
                Zaznacz dzień w planie aby zobaczyć makro
              </p>
            )}
            <MacroBar
              label="Kalorie"
              current={currentDayMacros?.kcal ?? 0}
              target={nutritionTargets.targetKcal}
              unit=" kcal"
            />
            <MacroBar
              label="Białko"
              current={currentDayMacros?.protein ?? 0}
              target={nutritionTargets.targetProteinG}
            />
            <MacroBar
              label="Tłuszcze"
              current={currentDayMacros?.fat ?? 0}
              target={nutritionTargets.targetFatG}
            />
            <MacroBar
              label="Węglowodany"
              current={currentDayMacros?.carbs ?? 0}
              target={nutritionTargets.targetCarbsG}
            />
            <div className="text-[10px] text-muted-foreground pt-1">
              BMR: {nutritionTargets.bmr} kcal · TDEE: {nutritionTargets.tdee} kcal
            </div>
          </div>
        </Section>
      )}

      {/* Chronic diseases */}
      {chronicDiseases.length > 0 && (
        <Section
          title={t('diseases') ?? 'Choroby i ograniczenia'}
          icon={<ShieldAlert className="h-4 w-4" />}
          defaultOpen={true}
          badge={
            hasCritical ? (
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                {chronicDiseases.filter((d) => d.severity === 'critical').length} krytyczne
              </Badge>
            ) : undefined
          }
        >
          <div className="space-y-2">
            {chronicDiseases.map((disease) => (
              <div
                key={disease.code}
                className={`rounded-md border p-2 ${SEVERITY_COLORS[disease.severity] ?? ''}`}
              >
                <div className="font-medium text-xs mb-1">{disease.name}</div>
                <ul className="space-y-0.5">
                  {disease.guidelines.map((g, i) => (
                    <li key={i} className="text-[11px] leading-tight flex gap-1">
                      <span className="shrink-0">•</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Allergens */}
      {allergens.length > 0 && (
        <Section
          title={t('allergens') ?? 'Alergeny'}
          icon={<AlertTriangle className="h-4 w-4" />}
          defaultOpen={false}
          badge={
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {allergens.length}
            </Badge>
          }
        >
          <div className="flex flex-wrap gap-1">
            {allergens.map((a) => (
              <Badge key={a.code} variant="destructive" className="text-[10px]">
                {a.name}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {/* Policy engine summary */}
      <Section
        title={t('policyEngine') ?? 'Reguły kliniczne'}
        icon={<Activity className="h-4 w-4" />}
        defaultOpen={policyEngine.matchedRedFlags > 0}
        badge={
          policyEngine.matchedRedFlags > 0 ? (
            <Badge variant="destructive" className="text-[10px] px-1 py-0">
              {policyEngine.matchedRedFlags} RF
            </Badge>
          ) : undefined
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-md border p-2">
              <div className="text-lg font-bold tabular-nums">{policyEngine.matchedPolicies}</div>
              <div className="text-[10px] text-muted-foreground">
                {t('matchedPolicies') ?? 'Aktywnych reguł'}
              </div>
              <div className="text-[9px] text-muted-foreground">
                z {policyEngine.totalPolicies}
              </div>
            </div>
            <div className="rounded-md border p-2">
              <div className={`text-lg font-bold tabular-nums ${policyEngine.matchedRedFlags > 0 ? 'text-red-600' : ''}`}>
                {policyEngine.matchedRedFlags}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {t('matchedRedFlags') ?? 'Red Flags'}
              </div>
              <div className="text-[9px] text-muted-foreground">
                z {policyEngine.totalRedFlags}
              </div>
            </div>
          </div>

          {/* Matched policy names */}
          {policyEngine.matchedPolicyNames.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">
                {t('appliedPolicies') ?? 'Zastosowane reguły:'}
              </p>
              <div className="flex flex-wrap gap-1">
                {policyEngine.matchedPolicyNames.map((name) => (
                  <Badge key={name} variant="secondary" className="text-[10px]">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Matched red flag details */}
          {policyEngine.matchedRedFlagDetails.length > 0 && (
            <div className="space-y-1.5">
              {policyEngine.matchedRedFlagDetails.map((rf) => (
                <div
                  key={rf.name}
                  className={`rounded-md border p-2 ${
                    rf.severity === 'CRITICAL'
                      ? 'bg-red-100 text-red-800 border-red-200'
                      : rf.severity === 'HIGH'
                        ? 'bg-orange-100 text-orange-800 border-orange-200'
                        : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                  }`}
                >
                  <div className="text-[11px] font-medium">{rf.name}</div>
                  <div className="text-[10px]">{rf.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Swap suggestions */}
      {planId && (swapSuggestions.length > 0 || swapWarnings.length > 0) && (
        <Section
          title="Sugestie zamian"
          icon={<Lightbulb className="h-4 w-4" />}
          defaultOpen={swapSuggestions.length > 0}
          badge={
            swapSuggestions.length > 0 ? (
              <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-300 text-amber-700 bg-amber-50">
                {swapSuggestions.length}/{swapTotal}
              </Badge>
            ) : undefined
          }
        >
          <div className="space-y-2">
            {swapWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
            {swapSuggestions.map((s, i) => {
              const slotKey = `${s.dayIndex}:${s.slotIndex}`;
              const isRepairing = repairing === slotKey;
              const isRepaired = repaired.has(slotKey);

              return (
                <div key={slotKey} className={`rounded-md border p-2 ${isRepaired ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setExpandedSwap(expandedSwap === i ? null : i)}
                      className="flex items-center gap-1.5 min-w-0 text-left flex-1"
                    >
                      <Badge
                        variant="outline"
                        className={`text-[9px] shrink-0 ${
                          isRepaired
                            ? 'border-green-300 text-green-700 bg-green-50'
                            : s.confidence === 'LOW'
                              ? 'border-red-300 text-red-700 bg-red-50'
                              : 'border-amber-300 text-amber-700 bg-amber-50'
                        }`}
                      >
                        {isRepaired && <Check className="h-2.5 w-2.5 mr-0.5 inline" />}
                        {s.currentRecipe.adjustedScore}
                      </Badge>
                      <span className="text-[11px] font-medium truncate">
                        {s.dayName} · {MEAL_TYPE_LABELS[s.mealType] ?? s.mealType}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isRepaired && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-5 px-1.5 text-[9px] border-blue-300 text-blue-700 hover:bg-blue-50"
                          disabled={isRepairing || repairing !== null}
                          onClick={() => handleRepair(s.dayIndex, s.slotIndex)}
                        >
                          {isRepairing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <><Wrench className="h-2.5 w-2.5 mr-0.5" />Napraw</>}
                        </Button>
                      )}
                      <button onClick={() => setExpandedSwap(expandedSwap === i ? null : i)}>
                        {expandedSwap === i ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                      </button>
                    </div>
                  </div>
                  {expandedSwap === i && (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground truncate">{s.currentRecipe.title}</p>
                      {s.reasons.map((r, ri) => (
                        <p key={ri} className={`text-[10px] flex items-start gap-1 ${isRepaired ? 'text-green-700' : 'text-amber-700'}`}>
                          {isRepaired ? <Check className="h-2.5 w-2.5 mt-0.5 shrink-0" /> : <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />}
                          {r}
                        </p>
                      ))}
                      {s.alternatives.length > 0 && !isRepaired && (
                        <div className="space-y-1 pt-1">
                          <p className="text-[10px] font-medium text-muted-foreground">Alternatywy (kliknij Zamień):</p>
                          {s.alternatives.map((alt, ai) => (
                            <div key={ai} className="flex items-center justify-between text-[10px] rounded border bg-white px-2 py-1">
                              <div className="flex items-center gap-1 min-w-0">
                                <ArrowRightLeft className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                                <span className="truncate">{alt.title}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] ${
                                    alt.scoreDiff > 0 ? 'border-green-300 text-green-700 bg-green-50' : ''
                                  }`}
                                >
                                  {alt.adjustedScore}{alt.scoreDiff !== 0 ? ` (${alt.scoreDiff > 0 ? '+' : ''}${alt.scoreDiff})` : ''}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1 text-[9px] text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                  disabled={isRepairing || repairing !== null}
                                  onClick={() => handleRepair(s.dayIndex, s.slotIndex, alt.recipeId)}
                                >
                                  {isRepairing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : 'Zamień'}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Recent notes */}
      <Section
        title={t('notes') ?? 'Notatki'}
        icon={<FileText className="h-4 w-4" />}
        defaultOpen={false}
        badge={
          recentNotes.length > 0 ? (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              {recentNotes.length}
            </Badge>
          ) : undefined
        }
      >
        {recentNotes.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('noNotes') ?? 'Brak notatek'}</p>
        ) : (
          <div className="space-y-2">
            {recentNotes.map((note) => (
              <div key={note.id} className="text-xs border rounded-md p-2">
                <p className="line-clamp-3">{note.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(note.createdAt).toLocaleDateString('pl-PL')}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
