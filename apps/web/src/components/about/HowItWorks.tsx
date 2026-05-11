'use client';

import { useTranslations } from 'next-intl';
import { ClipboardList, Sparkles, UserCheck, TrendingUp } from 'lucide-react';

const stepIcons = [ClipboardList, Sparkles, UserCheck, TrendingUp];

const stepAccents = [
  { number: 'text-ai-blue', ring: 'border-ai-blue/30 bg-ai-blue/8' },
  { number: 'text-brand-orange', ring: 'border-brand-orange/30 bg-brand-orange/8' },
  { number: 'text-brand-green', ring: 'border-brand-green/30 bg-brand-green/8' },
  { number: 'text-ai-blue', ring: 'border-ai-blue/30 bg-ai-blue/8' },
];

export function HowItWorks() {
  const t = useTranslations('about.howItWorks');

  const steps = [1, 2, 3, 4].map((n, idx) => ({
    Icon: stepIcons[idx],
    accent: stepAccents[idx],
    number: t(`step${n}Number` as Parameters<typeof t>[0]),
    title: t(`step${n}Title` as Parameters<typeof t>[0]),
    desc: t(`step${n}Desc` as Parameters<typeof t>[0]),
  }));

  return (
    <section className="py-20 bg-muted/20">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="mb-14 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          {t('title')}
        </h2>

        <div className="mx-auto max-w-4xl grid grid-cols-1 gap-8 sm:grid-cols-2">
          {steps.map(({ Icon, accent, number, title, desc }, idx) => (
            <div key={idx} className="flex gap-5">
              {/* Step number + icon stack */}
              <div className="flex flex-col items-center gap-2 pt-1 shrink-0">
                <span className={`text-4xl font-extrabold leading-none tabular-nums ${accent.number}`}>
                  {number}
                </span>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${accent.ring}`}>
                  <Icon className={`h-5 w-5 ${accent.number}`} />
                </div>
              </div>

              {/* Content */}
              <div className="pt-1">
                <h3 className="mb-2 font-semibold text-base leading-snug">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
