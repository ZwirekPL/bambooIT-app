'use client';

import { useTranslations } from 'next-intl';
import { ShieldCheck, BadgeCheck, ShoppingCart, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

const trustBadgeIcons = [ShieldCheck, BadgeCheck, ShoppingCart, Bot];

export function AboutHero() {
  const t = useTranslations('about.hero');

  const trustBadges = [
    t('trustBadge1'),
    t('trustBadge2'),
    t('trustBadge3'),
    t('trustBadge4'),
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[hsl(220,100%,56%,0.06)] via-background to-background py-24">
      {/* Subtle decorative glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[300px] w-[400px] sm:h-[400px] sm:w-[500px] md:h-[480px] md:w-[640px] rounded-full blur-3xl opacity-30"
        style={{ background: 'radial-gradient(ellipse, hsl(220,100%,56%,0.18) 0%, transparent 70%)' }}
      />

      <div className="container relative mx-auto px-4 md:px-6 text-center">
        {/* Badge */}
        <Badge variant="ai-blue" className="mb-6 px-4 py-1.5 text-sm font-semibold">
          {t('badge')}
        </Badge>

        {/* Heading */}
        <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-balance">
          {t('title')}
        </h1>

        {/* Lead */}
        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground text-balance">
          {t('subtitle')}
        </p>

        {/* Trust badges */}
        <div className="mb-10 flex flex-wrap justify-center gap-3">
          {trustBadges.map((label, idx) => {
            const Icon = trustBadgeIcons[idx];
            return (
              <div
                key={idx}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm"
              >
                <Icon className="h-4 w-4 text-brand-green shrink-0" />
                {label}
              </div>
            );
          })}
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="orange" size="lg">
            <Link href="/dashboard">{t('cta')}</Link>
          </Button>
          <Button asChild variant="green-outline" size="lg">
            <Link href="/oferta">{t('ctaSecondary')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
