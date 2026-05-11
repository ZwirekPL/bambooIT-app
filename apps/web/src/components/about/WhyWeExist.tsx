'use client';

import { useTranslations } from 'next-intl';
import { Lightbulb } from 'lucide-react';

export function WhyWeExist() {
  const t = useTranslations('about.why');

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mx-auto max-w-5xl grid grid-cols-1 gap-10 md:grid-cols-2 items-center">
          {/* Text column */}
          <div>
            <h2 className="mb-5 text-3xl font-bold tracking-tight sm:text-4xl">
              {t('title')}
            </h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {t('text')}
            </p>
          </div>

          {/* Illustration card */}
          <div className="flex justify-center md:justify-end">
            <div
              className="relative flex h-56 w-56 items-center justify-center rounded-3xl shadow-lg"
              style={{
                background:
                  'linear-gradient(135deg, hsl(138,64%,34%,0.12) 0%, hsl(30,100%,48%,0.12) 100%)',
                border: '1px solid hsl(var(--border))',
              }}
            >
              {/* Inner glow ring */}
              <div
                aria-hidden
                className="absolute inset-4 rounded-2xl opacity-60"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 50%, hsl(30,100%,48%,0.20) 0%, hsl(138,64%,34%,0.10) 60%, transparent 100%)',
                }}
              />
              <div className="relative flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md">
                  <Lightbulb className="h-8 w-8 text-brand-orange" />
                </div>
                <span className="text-sm font-semibold text-foreground/70 tracking-wide uppercase">
                  Hybrid Model
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
