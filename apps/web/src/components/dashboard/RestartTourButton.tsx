'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Play } from 'lucide-react';

export function RestartTourButton() {
  const t = useTranslations('dashboard.profile');
  const [hasSavedProgress, setHasSavedProgress] = useState(false);

  useEffect(() => {
    const isActive = localStorage.getItem('tour_patient_active') === '1';
    const isCompleted = localStorage.getItem('tour_patient_completed') === '1';
    const step = parseInt(localStorage.getItem('tour_patient_step') ?? '0', 10);
    setHasSavedProgress(isActive && !isCompleted && step > 0);
  }, []);

  const handleRestart = () => {
    localStorage.setItem('tour_patient_active', '1');
    localStorage.setItem('tour_patient_step', '0');
    localStorage.removeItem('tour_patient_completed');
    localStorage.removeItem('onboarding_tour_completed');
    window.location.href = window.location.pathname.replace(/\/profil$/, '');
  };

  const handleResume = () => {
    // Keep existing step — just make sure active flag is set
    localStorage.setItem('tour_patient_active', '1');
    localStorage.removeItem('tour_patient_completed');
    window.location.href = window.location.pathname.replace(/\/profil$/, '');
  };

  return (
    <Card className="border-border">
      <CardContent className="py-6 space-y-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('restartTourTitle') ?? 'Tour aplikacji'}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('restartTourDesc') ?? 'Uruchom ponownie interaktywny tour po wszystkich funkcjach aplikacji.'}
        </p>
        <div className="flex gap-2">
          {hasSavedProgress && (
            <Button variant="default" className="gap-2" onClick={handleResume}>
              <Play className="h-4 w-4" />
              {t('resumeTourButton') ?? 'Kontynuuj tour'}
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={handleRestart}>
            <RotateCcw className="h-4 w-4" />
            {t('restartTourButton') ?? 'Uruchom od początku'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
