'use client';

import { useTranslations } from 'next-intl';
import { ShieldCheck, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function SafetySection() {
  const t = useTranslations('howAiWorks');

  const items = [1, 2, 3, 4, 5].map((n) =>
    t(`safety${n}` as Parameters<typeof t>[0]),
  );

  return (
    <section className="bg-muted/30 py-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {t('safetyTitle')}
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            {t('safetySubtitle')}
          </p>
        </div>

        <Card className="mx-auto max-w-3xl rounded-[20px] border-brand-green/20 bg-white shadow-sm">
          <CardContent className="p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-brand-green">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold">Clinical Safety</h3>
            </div>
            <ul className="space-y-4">
              {items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" />
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
