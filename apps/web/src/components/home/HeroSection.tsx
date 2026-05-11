import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Sparkles, ShieldCheck, UserCheck, ShoppingCart, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SmartCtaLink } from '@/components/shared/SmartCtaLink';

export function HeroSection() {
  const t = useTranslations('home.hero');

  const trustBadges = [
    { Icon: ShieldCheck, key: 'trustBadge1' },
    { Icon: UserCheck,   key: 'trustBadge2' },
    { Icon: ShoppingCart,key: 'trustBadge3' },
    { Icon: Target,      key: 'trustBadge4' },
  ] as const;

  return (
    <section className="relative overflow-hidden bg-background pb-20 pt-10 md:pt-16">
      {/* Subtle background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-brand-green/8 blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-brand-orange/8 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">

          {/* Left — copy */}
          <div className="animate-fade-in-up">
            {/* AI badge */}
            <Badge variant="ai-blue" className="mb-6 gap-1.5 px-3 py-1.5 text-xs">
              <Sparkles className="h-3 w-3" />
              {t('badge')}
            </Badge>

            <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl xl:text-6xl">
              {t('title')}{' '}
              <span className="text-brand-green">{t('titleHighlight')}</span>
            </h1>

            <p className="mb-8 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t('subtitle')}
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3">
              <SmartCtaLink
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-orange px-8 py-3.5 text-base font-semibold text-white shadow hover:bg-brand-orange/90 transition-colors"
              >
                {t('cta')}
                <ArrowRight className="h-4 w-4" />
              </SmartCtaLink>
              <Button asChild variant="green-outline" size="xl">
                <Link href="/oferta">{t('ctaSecondary')}</Link>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
              {trustBadges.map(({ Icon, key }) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-brand-green" />
                  <span>{t(key)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — hero image card (visible on all screens) */}
          <div className="relative flex items-center justify-center">
            {/* Blurred glow behind card */}
            <div
              className="absolute inset-0 -z-10 flex items-center justify-center"
              aria-hidden="true"
            >
              <div className="h-48 w-48 lg:h-72 lg:w-72 rounded-full bg-gradient-to-br from-brand-green/20 to-brand-orange/20 blur-3xl" />
            </div>

            {/* Image card */}
            <div className="relative overflow-hidden rounded-2xl lg:rounded-3xl border border-border bg-white shadow-xl max-w-[280px] lg:max-w-none">
              <Image
                src="/obrazek_z_logo.png"
                alt="e-dietetyk — spersonalizowany plan żywieniowy"
                width={480}
                height={360}
                className="block h-auto w-full object-cover"
                priority
              />
            </div>

            {/* AI active chip — hidden on mobile for cleaner look */}
            <div className="absolute -right-2 top-2 lg:-right-4 lg:top-4 hidden sm:flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 lg:px-4 lg:py-2.5 shadow-lg">
              <div className="h-2 w-2 animate-pulse rounded-full bg-ai-blue" />
              <span className="text-xs font-semibold text-foreground">{t('aiActive')}</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
