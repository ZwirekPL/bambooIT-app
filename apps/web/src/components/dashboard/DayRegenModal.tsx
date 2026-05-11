'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, UtensilsCrossed, Clock, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

type RegenReason = 'DONT_LIKE' | 'TOO_COMPLEX' | 'NO_INGREDIENTS';

interface DayRegenModalProps {
  open: boolean;
  dayName: string;
  remaining: number;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: RegenReason, keepSimilar: boolean) => void;
}

const REASONS: Array<{ value: RegenReason; icon: React.ElementType; labelKey: string; descKey: string }> = [
  { value: 'DONT_LIKE', icon: UtensilsCrossed, labelKey: 'reasonDontLike', descKey: 'reasonDontLikeDesc' },
  { value: 'TOO_COMPLEX', icon: Clock, labelKey: 'reasonTooComplex', descKey: 'reasonTooComplexDesc' },
  { value: 'NO_INGREDIENTS', icon: ShoppingBag, labelKey: 'reasonNoIngredients', descKey: 'reasonNoIngredientsDesc' },
];

export function DayRegenModal({ open, dayName, remaining, loading, onClose, onConfirm }: DayRegenModalProps) {
  const t = useTranslations('dashboard.dayRegen');
  const [reason, setReason] = useState<RegenReason>('DONT_LIKE');
  const [keepSimilar, setKeepSimilar] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            {t('title', { day: dayName })}
          </DialogTitle>
          <DialogDescription>
            {t('description', { remaining })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Reason selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('reasonLabel')}</Label>
            {REASONS.map(({ value, icon: Icon, labelKey, descKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => setReason(value)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                  reason === value
                    ? 'border-brand-green bg-brand-green/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${reason === value ? 'text-brand-green' : 'text-muted-foreground'}`} />
                <div>
                  <p className={`text-sm font-medium ${reason === value ? 'text-brand-green' : ''}`}>{t(labelKey)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(descKey)}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Keep similar toggle */}
          <label htmlFor="keep-similar" className="flex items-center gap-3 py-2 px-1 cursor-pointer">
            <Checkbox id="keep-similar" checked={keepSimilar} onCheckedChange={(v) => setKeepSimilar(v === true)} />
            <div>
              <span className="text-sm font-medium">{t('keepSimilarLabel')}</span>
              <p className="text-xs text-muted-foreground">{t('keepSimilarDesc')}</p>
            </div>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t('cancel')}
          </Button>
          <Button onClick={() => onConfirm(reason, keepSimilar)} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {t('generating')}
              </>
            ) : (
              t('confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
