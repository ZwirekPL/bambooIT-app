import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Check, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SmartCtaLink } from '@/components/shared/SmartCtaLink';

export function PricingPreviewSection() {
  const t = useTranslations('home.pricing');

  const plans = [
    {
      key: 'trial',
      price: '0',
      period: t('trialPeriod'),
      badge: t('trialBadge'),
      features: [t('trialFeature1'), t('trialFeature2'), t('trialFeature3')],
      highlight: false,
    },
    {
      key: 'monthly',
      price: '129',
      period: t('monthlyPeriod'),
      badge: t('monthlyBadge'),
      features: [t('monthlyFeature1'), t('monthlyFeature2'), t('monthlyFeature3')],
      highlight: true,
    },
    {
      key: 'yearly',
      price: '99',
      period: t('yearlyPeriod'),
      badge: t('yearlyBadge'),
      features: [t('yearlyFeature1'), t('yearlyFeature2'), t('yearlyFeature3')],
      highlight: false,
    },
  ];

  return (
    <section className="py-20 bg-sage-50/40">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('title')}</h2>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.key}
              className={`relative ${plan.highlight ? 'border-brand-green shadow-lg ring-2 ring-brand-green/20' : 'border-border'}`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-brand-green text-white">{t('popular')}</Badge>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{plan.badge}</p>
                <CardTitle className="text-3xl font-extrabold mt-2">
                  {plan.price} <span className="text-base font-normal text-muted-foreground">PLN</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{plan.period}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-brand-green shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <SmartCtaLink
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-green/90 transition-colors"
                >
                  {t('cta')}
                </SmartCtaLink>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/oferta"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-green hover:underline"
          >
            {t('seeFullOffer')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
