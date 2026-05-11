'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeftRight, Check, Loader2, Flame, Beef, Droplet, Wheat } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type { MealSwapAlternative } from '@/types/api';

interface MealSwapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  dayIndex: number;
  mealIndex: number;
  mealName: string;
  token: string;
  onSwapConfirmed: () => void;
}

export function MealSwapModal({
  open,
  onOpenChange,
  planId,
  dayIndex,
  mealIndex,
  mealName,
  token,
  onSwapConfirmed,
}: MealSwapModalProps) {
  const t = useTranslations('dashboard.plan');

  const [loading, setLoading] = useState(false);
  const [confirmingIndex, setConfirmingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swapId, setSwapId] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<MealSwapAlternative[]>([]);
  const [remaining, setRemaining] = useState<number | undefined>();
  const [success, setSuccess] = useState(false);

  async function loadAlternatives() {
    setLoading(true);
    setError(null);
    setAlternatives([]);
    setConfirmingIndex(null);
    setSuccess(false);

    try {
      const result = await api.dietPlans.requestSwap(planId, dayIndex, mealIndex, token);
      setSwapId(result.swap.id);
      setAlternatives(result.swap.alternatives);
      setRemaining(result.swap.remaining);
    } catch {
      setError(t('swapError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSwap(index: number) {
    if (swapId === null) return;

    setConfirmingIndex(index);
    try {
      await api.dietPlans.confirmSwap(planId, swapId, index, token);
      setSuccess(true);
      if (remaining !== undefined) setRemaining(remaining - 1);
      setTimeout(() => {
        onOpenChange(false);
        onSwapConfirmed();
      }, 1200);
    } catch {
      setError(t('swapError'));
    } finally {
      setConfirmingIndex(null);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      loadAlternatives();
    } else {
      setAlternatives([]);
      setSwapId(null);
      setConfirmingIndex(null);
      setError(null);
      setSuccess(false);
    }
    onOpenChange(isOpen);
  }

  function sumMacros(alt: MealSwapAlternative) {
    return alt.items.reduce(
      (acc, item) => ({
        kcal: acc.kcal + (item.kcal || 0),
        protein: acc.protein + (item.protein || 0),
        fat: acc.fat + (item.fat || 0),
        carbs: acc.carbs + (item.carbs || 0),
      }),
      { kcal: 0, protein: 0, fat: 0, carbs: 0 },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-sage-500" />
            {t('swapTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('swapSubtitle', { meal: mealName })}
          </DialogDescription>
        </DialogHeader>

        {/* Remaining swaps badge */}
        {remaining !== undefined && !loading && !success && (
          <div className="flex justify-center">
            <Badge variant="outline" className="text-xs">
              {remaining > 0
                ? t('swapRemaining', { count: remaining })
                : t('swapNoRemaining')}
            </Badge>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">{t('swapLoadingSolver')}</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center py-4">{error}</p>
        )}

        {success && (
          <div className="flex items-center justify-center py-8 gap-3 text-sage-600">
            <Check className="h-6 w-6" />
            <span className="text-sm font-medium">{t('swapSuccess')}</span>
          </div>
        )}

        {!loading && !error && !success && alternatives.length > 0 && (
          <div className="space-y-3">
            {alternatives.map((alt, idx) => {
              const macros = sumMacros(alt);
              const isConfirming = confirmingIndex === idx;

              return (
                <Card key={idx} className="transition-all hover:border-sage-300">
                  <CardContent className="p-4 space-y-3">
                    {/* Meal name */}
                    <p className="text-sm font-medium">{alt.name}</p>

                    {/* Ingredients list */}
                    {alt.items.length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                        {alt.items.map((item, ii) => (
                          <li key={ii}>
                            {item.name}
                            {item.grams ? ` \u2014 ${item.grams}g` : ''}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Macros row + swap button */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Flame className="h-3 w-3" />{Math.round(macros.kcal)} kcal</span>
                        <span className="flex items-center gap-1"><Beef className="h-3 w-3" />{Math.round(macros.protein)}g</span>
                        <span className="flex items-center gap-1"><Droplet className="h-3 w-3" />{Math.round(macros.fat)}g</span>
                        <span className="flex items-center gap-1"><Wheat className="h-3 w-3" />{Math.round(macros.carbs)}g</span>
                      </div>

                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleSwap(idx)}
                        disabled={isConfirming || confirmingIndex !== null}
                        className="shrink-0 gap-1"
                      >
                        {isConfirming && <Loader2 className="h-3 w-3 animate-spin" />}
                        {t('swapConfirmBtn')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
