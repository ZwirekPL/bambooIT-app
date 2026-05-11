'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export function HowAiWorksCta() {
  const t = useTranslations('howAiWorks');

  return (
    <section className="py-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-muted/30 p-8 text-center">
          <h2 className="mb-2 text-2xl font-semibold">{t('ctaTitle')}</h2>
          <p className="mb-6 text-muted-foreground">{t('ctaSubtitle')}</p>
          <Button asChild size="lg">
            <Link href="/oferta">{t('ctaButton')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
