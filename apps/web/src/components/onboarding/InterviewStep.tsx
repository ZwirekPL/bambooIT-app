'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function InterviewStep() {
  const t = useTranslations('onboarding.interview');
  const router = useRouter();

  function handleGoToInterview() {
    router.push('/dashboard/wywiad?type=core');
  }

  return (
    <Card className="w-full max-w-lg mx-auto text-center">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleGoToInterview} size="lg" className="w-full">
          {t('submit')}
        </Button>
      </CardContent>
    </Card>
  );
}
