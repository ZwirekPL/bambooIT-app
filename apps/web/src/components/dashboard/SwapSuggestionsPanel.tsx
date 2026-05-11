'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRightLeft, ChevronDown, ChevronUp, Lightbulb, Wrench, Loader2, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

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

interface RepairResult {
  dayIndex: number;
  slotIndex: number;
  newRecipe: { recipeId: string; title: string; score: number };
}

interface SwapSuggestionsPanelProps {
  planId: string;
  token: string;
  onRepaired?: (result: RepairResult) => void;
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: 'Sniadanie',
  SECOND_BREAKFAST: 'II sniadanie',
  LUNCH: 'Obiad',
  DINNER: 'Kolacja',
  SUPPER: 'Podwieczorek',
  SNACK: 'Przekaska',
  DESSERT: 'Deser',
};

export function SwapSuggestionsPanel({ planId, token, onRepaired }: SwapSuggestionsPanelProps) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<SwapSuggestion[]>([]);
  const [softWarnings, setSoftWarnings] = useState<string[]>([]);
  const [totalSlots, setTotalSlots] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [repairing, setRepairing] = useState<string | null>(null);
  const [repaired, setRepaired] = useState<Set<string>>(new Set());

  const refreshSuggestions = useCallback(async () => {
    try {
      const res = await api.dietPlans.getSwapSuggestions(planId, token);
      if (res.ok) {
        setSuggestions(res.suggestions);
        setSoftWarnings(res.softWarnings);
        setTotalSlots(res.totalSlots);
      }
    } catch { /* ignore */ }
  }, [planId, token]);

  useEffect(() => {
    let mounted = true;
    api.dietPlans.getSwapSuggestions(planId, token)
      .then((res) => {
        if (mounted && res.ok) {
          setSuggestions(res.suggestions);
          setSoftWarnings(res.softWarnings);
          setTotalSlots(res.totalSlots);
        }
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [planId, token]);

  const handleRepair = useCallback(async (
    dayIndex: number,
    slotIndex: number,
    targetRecipeId?: string,
  ) => {
    const key = `${dayIndex}:${slotIndex}`;
    setRepairing(key);
    try {
      const result = await api.dietPlans.repairSlot(
        planId,
        { dayIndex, slotIndex, targetRecipeId },
        token,
      );
      if (result.ok) {
        setRepaired((prev) => new Set(prev).add(key));
        onRepaired?.({
          dayIndex,
          slotIndex,
          newRecipe: result.newRecipe,
        });
        // Refresh server data so plan editor shows updated content
        router.refresh();
        // Re-fetch suggestions from backend (fresh analysis)
        await refreshSuggestions();
      }
    } catch {
      // On error, re-fetch suggestions to ensure consistency with DB
      await refreshSuggestions();
    } finally {
      setRepairing(null);
    }
  }, [planId, token, onRepaired, router, refreshSuggestions]);

  if (loading) return null;
  if (suggestions.length === 0 && softWarnings.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
          <Lightbulb className="h-4 w-4" />
          Sugestie zamian ({suggestions.length} z {totalSlots} slotów)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {softWarnings.length > 0 && (
          <div className="space-y-1 mb-3">
            {softWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {suggestions.map((s, i) => {
          const slotKey = `${s.dayIndex}:${s.slotIndex}`;
          const isRepairing = repairing === slotKey;
          const isRepaired = repaired.has(slotKey);

          return (
            <div
              key={slotKey}
              className={`rounded-lg border p-3 ${
                isRepaired
                  ? 'border-green-200 bg-green-50/30'
                  : 'border-amber-200 bg-white'
              }`}
            >
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      isRepaired
                        ? 'border-green-300 text-green-700 bg-green-50'
                        : s.confidence === 'LOW'
                          ? 'border-red-300 text-red-700 bg-red-50'
                          : 'border-amber-300 text-amber-700 bg-amber-50'
                    }`}
                  >
                    {isRepaired && <Check className="h-3 w-3 mr-0.5 inline" />}
                    {s.currentRecipe.adjustedScore}/100
                  </Badge>
                  <span className="text-xs font-medium text-gray-700 truncate">
                    {s.dayName} — {MEAL_TYPE_LABELS[s.mealType] ?? s.mealType}
                  </span>
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    {s.currentRecipe.title}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Auto-repair button (solver picks best) */}
                  {!isRepaired && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px] border-blue-300 text-blue-700 hover:bg-blue-50"
                      disabled={isRepairing || repairing !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRepair(s.dayIndex, s.slotIndex);
                      }}
                    >
                      {isRepairing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Wrench className="h-3 w-3 mr-1" />
                          Napraw
                        </>
                      )}
                    </Button>
                  )}
                  {s.alternatives.length > 0 && !isRepaired && (
                    <Badge variant="outline" className="text-[10px] border-sage-300 text-sage-700">
                      {s.alternatives.length} alt.
                    </Badge>
                  )}
                  {expanded === i ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {expanded === i && (
                <div className="mt-3 space-y-2">
                  {/* Reasons */}
                  <div className="space-y-1">
                    {s.reasons.map((r, ri) => (
                      <p key={ri} className={`text-xs flex items-start gap-1.5 ${
                        isRepaired ? 'text-green-700' : 'text-amber-700'
                      }`}>
                        {isRepaired
                          ? <Check className="h-3 w-3 mt-0.5 shrink-0" />
                          : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        }
                        {r}
                      </p>
                    ))}
                  </div>

                  {/* Alternatives with direct swap buttons */}
                  {s.alternatives.length > 0 && !isRepaired && (
                    <div className="space-y-1.5 mt-2">
                      <p className="text-xs font-medium text-gray-600">Alternatywy (kliknij aby zamienić):</p>
                      {s.alternatives.map((alt, ai) => (
                        <div
                          key={ai}
                          className="flex items-center justify-between rounded border border-border bg-muted/30 px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ArrowRightLeft className="h-3.5 w-3.5 text-sage-500 shrink-0" />
                            <span className="text-xs truncate">{alt.title}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                alt.scoreDiff > 0
                                  ? 'border-green-300 text-green-700 bg-green-50'
                                  : 'border-gray-300 text-gray-600'
                              }`}
                            >
                              {alt.adjustedScore}/100
                              {alt.scoreDiff !== 0 && ` (${alt.scoreDiff > 0 ? '+' : ''}${alt.scoreDiff})`}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              disabled={isRepairing || repairing !== null}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRepair(s.dayIndex, s.slotIndex, alt.recipeId);
                              }}
                            >
                              {isRepairing ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                'Zamień'
                              )}
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
      </CardContent>
    </Card>
  );
}
