'use client';

import { useTranslations } from 'next-intl';
import { Target, Globe, ShieldCheck, Cpu } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const valueIcons = [Target, Globe, ShieldCheck, Cpu];

const valueAccents = [
  'text-brand-green bg-brand-green/10',
  'text-ai-blue bg-ai-blue/10',
  'text-brand-orange bg-brand-orange/10',
  'text-brand-green bg-brand-green/10',
];

export function OurValues() {
  const t = useTranslations('about.values');

  const values = [1, 2, 3, 4].map((n, idx) => ({
    Icon: valueIcons[idx],
    accent: valueAccents[idx],
    title: t(`item${n}Title` as Parameters<typeof t>[0]),
    desc: t(`item${n}Desc` as Parameters<typeof t>[0]),
  }));

  return (
    <section className="py-20">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          {t('title')}
        </h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map(({ Icon, accent, title, desc }, idx) => (
            <Card
              key={idx}
              className="rounded-[20px] border border-border bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <CardContent className="p-6">
                <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${accent}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-semibold text-base leading-snug">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
