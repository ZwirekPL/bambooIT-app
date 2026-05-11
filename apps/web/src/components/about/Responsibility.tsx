'use client';

import { useTranslations } from 'next-intl';
import { ShieldAlert, Bot } from 'lucide-react';

export function Responsibility() {
  const t = useTranslations('about.responsibility');

  return (
    <section className="py-20 bg-muted/20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mx-auto max-w-3xl rounded-[20px] border border-border bg-white p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10">
              <ShieldAlert className="h-5 w-5 text-brand-orange" />
            </div>
            <h2 className="text-xl font-bold">{t('title')}</h2>
          </div>

          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{t('text')}</p>

          <div className="flex items-start gap-3 rounded-xl border border-ai-blue/20 bg-ai-blue/5 px-4 py-3">
            <Bot className="mt-0.5 h-4 w-4 shrink-0 text-ai-blue" />
            <p className="text-sm leading-relaxed text-foreground/80">{t('aiNote')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
