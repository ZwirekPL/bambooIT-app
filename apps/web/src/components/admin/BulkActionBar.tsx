'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, X } from 'lucide-react';

type BulkAction =
  | 'SET_CATEGORY'
  | 'SET_MEAL_TYPE'
  | 'SET_DIFFICULTY'
  | 'SET_VERIFICATION_STATUS'
  | 'SET_ACTIVE'
  | 'DELETE';

interface BulkActionBarProps {
  selectedCount: number;
  onAction: (action: BulkAction, value?: unknown) => Promise<void>;
  onClear: () => void;
  loading?: boolean;
}

const CATEGORIES = ['main', 'soup', 'salad', 'dessert', 'other'] as const;
const MEAL_TYPES = ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'DINNER', 'SUPPER', 'SNACK', 'DESSERT', 'DRINK', 'SAUCE', 'SIDE_DISH'] as const;
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
const VERIFICATION_STATUSES = ['UNVERIFIED', 'AUTO_VERIFIED', 'MANUALLY_VERIFIED', 'REJECTED'] as const;

const CATEGORY_KEY: Record<string, string> = {
  main: 'categoryMain', soup: 'categorySoup', salad: 'categorySalad',
  dessert: 'categoryDessert', other: 'categoryOther',
};
const MEAL_TYPE_KEY: Record<string, string> = {
  BREAKFAST: 'mealBreakfast', SECOND_BREAKFAST: 'mealSecondBreakfast',
  LUNCH: 'mealLunch', DINNER: 'mealDinner', SUPPER: 'mealSupper',
  SNACK: 'mealSnack', DESSERT: 'mealDessert', DRINK: 'mealDrink',
  SAUCE: 'mealSauce', SIDE_DISH: 'mealSideDish',
};
const DIFFICULTY_KEY: Record<string, string> = {
  EASY: 'difficultyEasy', MEDIUM: 'difficultyMedium', HARD: 'difficultyHard',
};
const STATUS_KEY: Record<string, string> = {
  UNVERIFIED: 'statusUnverified', AUTO_VERIFIED: 'statusAutoVerified',
  MANUALLY_VERIFIED: 'statusManuallyVerified', REJECTED: 'statusRejected',
};

export function BulkActionBar({ selectedCount, onAction, onClear, loading }: BulkActionBarProps) {
  const t = useTranslations('admin.recipes');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleAction = async (action: BulkAction, value?: unknown) => {
    await onAction(action, value);
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-3">
        <span className="text-sm font-medium mr-1">
          {t('bulkSelected', { count: selectedCount })}
        </span>

        {/* Category */}
        <Select disabled={loading} onValueChange={(v) => handleAction('SET_CATEGORY', v)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t('bulkSetCategory')} />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{t(CATEGORY_KEY[c])}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Meal Type */}
        <Select disabled={loading} onValueChange={(v) => handleAction('SET_MEAL_TYPE', v)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t('bulkSetMealType')} />
          </SelectTrigger>
          <SelectContent>
            {MEAL_TYPES.map((m) => (
              <SelectItem key={m} value={m}>{t(MEAL_TYPE_KEY[m])}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Difficulty */}
        <Select disabled={loading} onValueChange={(v) => handleAction('SET_DIFFICULTY', v)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder={t('bulkSetDifficulty')} />
          </SelectTrigger>
          <SelectContent>
            {DIFFICULTIES.map((d) => (
              <SelectItem key={d} value={d}>{t(DIFFICULTY_KEY[d])}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Verification Status */}
        <Select disabled={loading} onValueChange={(v) => handleAction('SET_VERIFICATION_STATUS', v)}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder={t('bulkSetStatus')} />
          </SelectTrigger>
          <SelectContent>
            {VERIFICATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{t(STATUS_KEY[s])}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Activate / Deactivate */}
        <Button variant="outline" size="sm" disabled={loading} onClick={() => handleAction('SET_ACTIVE', true)}>
          {t('bulkActivate')}
        </Button>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => handleAction('SET_ACTIVE', false)}>
          {t('bulkDeactivate')}
        </Button>

        {/* Delete */}
        <Button variant="destructive" size="sm" disabled={loading} onClick={() => setDeleteConfirm(true)} className="gap-1">
          <Trash2 className="h-3 w-3" />
          {t('bulkDelete')}
        </Button>

        {/* Clear selection */}
        <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto gap-1">
          <X className="h-3 w-3" />
        </Button>
      </div>

      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bulkDelete')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('bulkDeleteConfirm', { count: selectedCount })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>{t('cancel')}</Button>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={async () => {
                await handleAction('DELETE');
                setDeleteConfirm(false);
              }}
            >
              {t('bulkDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
