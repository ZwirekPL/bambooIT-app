'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

export function HowAiWorksHero() {
  const t = useTranslations('howAiWorks');

  return (
    <section className="bg-gradient-to-b from-sage-50/50 to-background py-20">
      <div className="container mx-auto px-4 md:px-6 text-center">
        <Badge variant="sage-outline" className="mb-4">
          {t('badge')}
        </Badge>
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
          {t('title')}
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>
    </section>
  );
}
