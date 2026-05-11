'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function TourStep() {
  const t = useTranslations('onboarding.tour');
  const router = useRouter();

  function handleStartTour() {
    localStorage.setItem('show_dashboard_tour', 'true');
    router.push('/dashboard');
  }

  function handleSkip() {
    localStorage.setItem('onboarding_tour_completed', 'true');
    router.push('/dashboard');
  }

  return (
    <Card className="w-full max-w-lg mx-auto text-center">
      <CardHeader>
        <div className="mx-auto mb-4 text-5xl">&#127881;</div>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button onClick={handleStartTour} size="lg">
          {t('startTour')}
        </Button>
        <Button onClick={handleSkip} variant="ghost" size="sm">
          {t('skip')}
        </Button>
      </CardContent>
    </Card>
  );
}
