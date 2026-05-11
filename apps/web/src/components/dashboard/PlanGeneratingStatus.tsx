'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface PlanGeneratingStatusProps {
  patientId: string;
  backendToken: string;
}

const POLL_INTERVAL_MS = 5_000; // 5 seconds (was 10s)
const MAX_POLLS = 80; // stop after ~6.5 minutes

const PHASE_LABELS: Record<string, string> = {
  generating: 'Przygotowywanie jadłospisu...',
  completing: 'Uzupełnianie brakujących dni...',
  repairing: 'Weryfikacja ograniczeń żywieniowych...',
  done: 'Plan gotowy!',
  failed: 'Nie udało się wygenerować planu',
};

export function PlanGeneratingStatus({ patientId, backendToken }: PlanGeneratingStatusProps) {
  const t = useTranslations('dashboard.plan');
  const router = useRouter();
  const [pollCount, setPollCount] = useState(0);
  const [progress, setProgress] = useState(15);
  const [failed, setFailed] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState('');

  useEffect(() => {
    if (pollCount >= MAX_POLLS || failed) return;

    const timer = setTimeout(async () => {
      try {
        // First try lightweight status endpoint for the latest plan
        const latestRes = await fetch(
          `/api/proxy/diet-plans/latest/${patientId}`,
          { cache: 'no-store' }
        );

        if (latestRes.ok) {
          const data = await latestRes.json();
          const plan = data?.dietPlan;
          const status = plan?.status;
          const planId = plan?.id;

          // GENERATION_FAILED — stop polling, show error
          if (status === 'GENERATION_FAILED') {
            setFailed(true);
            return;
          }

          // Plan moved beyond AI_DRAFT — refresh to show new state
          if (status && status !== 'AI_DRAFT') {
            setPhaseLabel(PHASE_LABELS.done);
            setProgress(100);
            setTimeout(() => router.refresh(), 500);
            return;
          }

          // Try to get phase info from status endpoint
          if (planId) {
            try {
              const statusRes = await fetch(
                `/api/proxy/diet-plans/${planId}/status`,
                { cache: 'no-store' }
              );
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                if (statusData.phase && PHASE_LABELS[statusData.phase]) {
                  setPhaseLabel(PHASE_LABELS[statusData.phase]);
                }
              }
            } catch {
              // Status endpoint is optional — continue
            }
          }
        }
      } catch {
        // Network error — keep polling
      }

      setPollCount((c) => c + 1);
      // Simulate progress (logarithmic curve, max ~90%)
      setProgress((prev) => Math.min(90, prev + (90 - prev) * 0.06));
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [pollCount, patientId, backendToken, router, failed]);

  if (failed) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="py-12 flex flex-col items-center text-center gap-6">
          <div className="rounded-full bg-red-100 p-5">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-red-900">
              {t('generationFailedTitle', { defaultMessage: 'Nie udało się wygenerować planu' })}
            </h2>
            <p className="text-sm text-red-700 max-w-sm">
              {t('generationFailedDesc', { defaultMessage: 'Przepraszamy, automatyczne generowanie nie powiodło się. Twój dietetyk przygotuje plan indywidualnie.' })}
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => router.refresh()}
          >
            {t('refresh', { defaultMessage: 'Odśwież' })}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Timeout reached
  if (pollCount >= MAX_POLLS) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="py-12 flex flex-col items-center text-center gap-6">
          <div className="rounded-full bg-amber-100 p-5">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-amber-900">
              Generowanie trwa dłużej niż zwykle
            </h2>
            <p className="text-sm text-amber-700 max-w-sm">
              Twój plan jest wciąż przygotowywany. Odśwież stronę za minutę — plan może być już gotowy.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => router.refresh()}
          >
            {t('refresh', { defaultMessage: 'Odśwież' })}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-sage-200 bg-sage-50/50">
      <CardContent className="py-12 flex flex-col items-center text-center gap-6">
        <div className="relative">
          <div className="rounded-full bg-sage-100 p-5">
            <Sparkles className="h-8 w-8 text-sage-600" />
          </div>
          <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-1 shadow-sm">
            <Loader2 className="h-5 w-5 text-sage-500 animate-spin" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t('generatingTitle')}</h2>
          <p className="text-sm text-muted-foreground max-w-sm">{t('generatingDesc')}</p>
        </div>

        <div className="w-full max-w-xs space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {phaseLabel || t('generatingStatus')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
