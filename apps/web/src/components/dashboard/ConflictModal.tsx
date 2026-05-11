'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { AlertTriangle, ShieldCheck, MessageCircle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/../config/brand';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface PreCheckConflict {
  conflictId: string;
  description: string;
  severity: 'BLOCK' | 'WARN';
  messageKey: string;
  winnerSide: string;
  triggerA: { field: string; value: string };
  triggerB: { field: string; value: string };
  safeOption: { label: string; action: string };
  consultOption: { label: string; price: number; action: string };
  cancelOption: { label: string; action: string; email: string };
}

interface ConflictModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: PreCheckConflict[];
  /** User chose "continue safely" — parent removes the losing preference and re-submits */
  onContinueSafely: () => void;
  /** User chose "cancel" — just close */
  onCancel: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fieldLabel(field: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    mainGoal: t('fieldMainGoal'),
    chronicDiseases: t('fieldChronicDiseases'),
    allergies: t('fieldAllergies'),
    intolerances: t('fieldIntolerances'),
    dietType: t('fieldDietType'),
  };
  return map[field] ?? field;
}

function valueLabel(value: string, t: (key: string) => string): string {
  // Try to get a translated value; fall back to raw value
  try {
    const translated = t(`value_${value}`);
    if (translated && !translated.startsWith('value_')) return translated;
  } catch {
    // key doesn't exist
  }
  return value.replace(/_/g, ' ');
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function ConflictModal({
  open,
  onOpenChange,
  conflicts,
  onContinueSafely,
  onCancel,
}: ConflictModalProps) {
  const t = useTranslations('dashboard.interview.conflict');
  const router = useRouter();

  const hasBlocking = conflicts.some((c) => c.severity === 'BLOCK');

  function handleContinueSafely() {
    onOpenChange(false);
    onContinueSafely();
  }

  function handleConsultation() {
    onOpenChange(false);
    router.push('/zamow?product=CONSULTATION');
  }

  function handleCancel() {
    onOpenChange(false);
    onCancel();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        {/* ── Conflict list ── */}
        <div className="space-y-3 max-h-64 overflow-y-auto py-2">
          {conflicts.map((conflict) => (
            <div
              key={conflict.conflictId}
              className={`rounded-lg border p-3 ${
                conflict.severity === 'BLOCK'
                  ? 'border-red-300 bg-red-50'
                  : 'border-amber-300 bg-amber-50'
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    conflict.severity === 'BLOCK' ? 'text-red-600' : 'text-amber-600'
                  }`}
                />
                <div className="text-sm">
                  <p className="font-medium">
                    {fieldLabel(conflict.triggerA.field, t)}:{' '}
                    <span className="text-muted-foreground">
                      {valueLabel(conflict.triggerA.value, t)}
                    </span>
                    {' '}
                    <span className="text-muted-foreground">×</span>
                    {' '}
                    {fieldLabel(conflict.triggerB.field, t)}:{' '}
                    <span className="text-muted-foreground">
                      {valueLabel(conflict.triggerB.value, t)}
                    </span>
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {t(`messages.${conflict.messageKey}`, {
                      // fallback — if key is missing, show description
                      defaultValue: conflict.description,
                    } as Record<string, string>)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Actions ── */}
        <div className="flex flex-col gap-2 border-t pt-4">
          {/* Safe option */}
          <Button
            variant="sage"
            className="w-full justify-start gap-2"
            onClick={handleContinueSafely}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <div className="text-left">
              <div className="font-medium">{t('safeOption')}</div>
              <div className="text-xs opacity-80">{t('safeOptionHint')}</div>
            </div>
          </Button>

          {/* Consultation option */}
          {hasBlocking && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={handleConsultation}
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <div className="text-left">
                <div className="font-medium">{t('consultOption')}</div>
                <div className="text-xs opacity-80">{t('consultOptionHint')}</div>
              </div>
            </Button>
          )}

          {/* Cancel option */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={handleCancel}
          >
            <X className="h-4 w-4 shrink-0" />
            <div className="text-left">
              <div className="font-medium">{t('cancelOption')}</div>
              <div className="text-xs opacity-80">
                {BRAND.email}
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
