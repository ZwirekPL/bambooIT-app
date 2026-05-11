'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import {
  ClipboardList,
  Brain,
  ShieldCheck,
  Calculator,
  UserCheck,
  ShoppingCart,
} from 'lucide-react';

const STEP_ICONS = [ClipboardList, Brain, ShieldCheck, Calculator, UserCheck, ShoppingCart];

const STEP_COLORS = [
  'bg-blue-50 text-blue-600',
  'bg-purple-50 text-purple-600',
  'bg-red-50 text-red-600',
  'bg-amber-50 text-amber-600',
  'bg-green-50 text-green-600',
  'bg-teal-50 text-teal-600',
];

export function AiProcessSection() {
  const t = useTranslations('howAiWorks');

  const steps = [1, 2, 3, 4, 5, 6].map((n, idx) => ({
    icon: STEP_ICONS[idx],
    color: STEP_COLORS[idx],
    title: t(`step${n}Title` as Parameters<typeof t>[0]),
    desc: t(`step${n}Desc` as Parameters<typeof t>[0]),
  }));

  return (
    <section className="py-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {t('processTitle')}
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            {t('processSubtitle')}
          </p>
        </div>

        <div className="mx-auto max-w-4xl space-y-6">
          {steps.map(({ icon: Icon, color, title, desc }, idx) => (
            <Card
              key={idx}
              className="rounded-[16px] border border-border bg-white shadow-sm"
            >
              <CardContent className="flex items-start gap-5 p-6">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                      {idx + 1}
                    </span>
                    <h3 className="text-lg font-semibold">{title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {desc}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
