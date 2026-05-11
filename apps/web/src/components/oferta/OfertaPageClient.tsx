'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PricingCard } from './PricingCard';
import { ForWhomSection } from './ForWhomSection';
import { MealPlanContents } from './MealPlanContents';
import { ComparisonTable } from './ComparisonTable';
import { NoRiskSection } from './NoRiskSection';
import { OfertaFaq } from './OfertaFaq';
import type { CheckoutProductType } from '@/types/api';

type Tab = 'subscription' | 'one-time';
type SubBilling = 'monthly' | 'yearly';

export function OfertaPageClient() {
  const t = useTranslations('pricing');
  const { data: session } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('subscription');
  const [subBilling, setSubBilling] = useState<SubBilling>('monthly');

  const handleCtaClick = useCallback((productType: CheckoutProductType) => {
    if (!session?.user) {
      router.push('/zaloguj');
      return;
    }
    // All paid products go to checkout
    router.push(`/zamow?product=${productType}` as '/zamow');
  }, [session, router]);

  const forWhomItems: [
    { label: string; plan: string },
    { label: string; plan: string },
    { label: string; plan: string },
    { label: string; plan: string },
  ] = [
    { label: t('forWhom1Label'), plan: t('forWhom1Plan') },
    { label: t('forWhom2Label'), plan: t('forWhom2Plan') },
    { label: t('forWhom3Label'), plan: t('forWhom3Plan') },
    { label: t('forWhom4Label'), plan: t('forWhom4Plan') },
  ];

  const contentsItems: [string, string, string, string, string, string, string] = [
    t('contents1'),
    t('contents2'),
    t('contents3'),
    t('contents4'),
    t('contents5'),
    t('contents6'),
    t('contents7'),
  ];

  const tableHeaders: [string, string, string, string, string] = [
    '',
    t('compareHeaderTrial'),
    t('compareHeaderMonthly'),
    t('compareHeaderOneTime'),
    t('compareHeaderConsultation'),
  ];

  const tableRows = [
    { label: t('compareFeatureWeeklyPlans'), values: ['1', '1', '1', '—'] as [string, string, string, string] },
    { label: t('compareFeatureMealSwaps'), values: ['5', '5', '5', '—'] as [string, string, string, string] },
    { label: t('compareFeatureInterview'), values: ['✓', '✓', '✓', '✓'] as [string, string, string, string] },
    { label: t('compareFeatureMonitoring'), values: ['✓', '✓', '✓', '—'] as [string, string, string, string] },
    { label: t('compareFeatureDietitian'), values: ['✓', '✓', '✓', '✓'] as [string, string, string, string] },
    { label: t('compareFeatureLabAnalysis'), values: ['—', '—', '—', '✓'] as [string, string, string, string] },
  ];

  const faqItems = [
    { q: t('faq1Q'), a: t('faq1A') },
    { q: t('faq2Q'), a: t('faq2A') },
    { q: t('faq3Q'), a: t('faq3A') },
    { q: t('faq4Q'), a: t('faq4A') },
    { q: t('faq5Q'), a: t('faq5A') },
  ];

  // Subscription card: monthly or yearly
  const isYearly = subBilling === 'yearly';
  const subKey = isYearly ? 'yearly' : 'monthly';
  const subProductType = isYearly ? 'OPIEKA_ROCZNA' : 'OPIEKA_MIESIECZNA';

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-sage-50/50 to-background py-20">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <Badge variant="sage-outline" className="mb-4">
            {t('badge')}
          </Badge>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl">{t('title')}</h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground mb-8">{t('subtitle')}</p>

          {/* Main tab toggle: Subscriptions / One-time */}
          <div
            className="inline-flex items-center gap-0.5 rounded-lg border border-border p-0.5"
            role="group"
          >
            <button
              onClick={() => setTab('subscription')}
              aria-pressed={tab === 'subscription'}
              className={cn(
                'rounded-md px-5 py-1.5 text-sm font-semibold transition-colors duration-200',
                tab === 'subscription'
                  ? 'bg-sage-500 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('toggleSubscription')}
            </button>
            <button
              onClick={() => setTab('one-time')}
              aria-pressed={tab === 'one-time'}
              className={cn(
                'rounded-md px-5 py-1.5 text-sm font-semibold transition-colors duration-200',
                tab === 'one-time'
                  ? 'bg-sage-500 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('toggleOneTime')}
            </button>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div key={tab} className="animate-fade-in-up">
            {tab === 'subscription' ? (
              <div className="flex flex-col items-center gap-8">
                {/* Monthly / Yearly sub-toggle */}
                <div className="inline-flex items-center gap-2 rounded-full border border-border p-1">
                  <button
                    onClick={() => setSubBilling('monthly')}
                    className={cn(
                      'rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200',
                      subBilling === 'monthly'
                        ? 'bg-brand-green text-white'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t('billingMonthly')}
                  </button>
                  <button
                    onClick={() => setSubBilling('yearly')}
                    className={cn(
                      'rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5',
                      subBilling === 'yearly'
                        ? 'bg-brand-green text-white'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t('billingYearly')}
                    <Badge variant="brand-orange" className="text-[10px] px-1.5 py-0">
                      {t('saveBadge')}
                    </Badge>
                  </button>
                </div>

                {/* Cards grid: Trial + Subscription + Consultation */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 max-w-5xl mx-auto items-start">
                  {/* TRIAL */}
                  <PricingCard
                    variant="free"
                    name={t('trial.name')}
                    price={t('trial.price')}
                    period={t('trial.period')}
                    description={t('trial.desc')}
                    afterPrice={t('trial.afterTrial')}
                    features={[
                      t('trial.feature1'),
                      t('trial.feature2'),
                      t('trial.feature3'),
                      t('trial.feature4'),
                      t('trial.feature5'),
                      t('trial.feature6'),
                    ]}
                    ctaLabel={t('trial.cta')}
                    productType="TRIAL"
                    onCtaClick={() => handleCtaClick('TRIAL')}
                  />

                  {/* OPIEKA MIESIĘCZNA / ROCZNA */}
                  <PricingCard
                    key={subBilling}
                    variant="popular"
                    name={t(`${subKey}.name`)}
                    price={t(`${subKey}.price`)}
                    period={t(`${subKey}.period`)}
                    description={t(`${subKey}.desc`)}
                    afterPrice={isYearly ? t('yearly.billedAs') : undefined}
                    features={[
                      t(`${subKey}.feature1`),
                      t(`${subKey}.feature2`),
                      t(`${subKey}.feature3`),
                      t(`${subKey}.feature4`),
                      t(`${subKey}.feature5`),
                      t(`${subKey}.feature6`),
                      t(`${subKey}.feature7`),
                      t(`${subKey}.feature8`),
                    ]}
                    ctaLabel={t(`${subKey}.cta`)}
                    popularLabel={t('mostPopular')}
                    productType={subProductType}
                    onCtaClick={() => handleCtaClick(subProductType)}
                  />

                  {/* CONSULTATION */}
                  <PricingCard
                    variant="premium"
                    name={t('consultation.name')}
                    price={t('consultation.price')}
                    period={t('consultation.period')}
                    description={t('consultation.desc')}
                    features={[
                      t('consultation.feature1'),
                      t('consultation.feature2'),
                      t('consultation.feature3'),
                      t('consultation.feature4'),
                      t('consultation.feature5'),
                    ]}
                    ctaLabel={t('consultation.cta')}
                    productType="CONSULTATION"
                    onCtaClick={() => handleCtaClick('CONSULTATION')}
                  />
                </div>

                {/* Trial legal note */}
                <div className="max-w-5xl w-full mx-auto rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20 px-5 py-3 text-sm text-muted-foreground text-center">
                  {t('trialLegalNote', { price: '129' })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-3xl w-full mx-auto items-start">
                  <PricingCard
                    variant="one-time"
                    name={t('oneTime2w.name')}
                    price={t('oneTime2w.price')}
                    period={t('oneTime2w.period')}
                    description={t('oneTime2w.desc')}
                    features={[
                      t('oneTime2w.feature1'),
                      t('oneTime2w.feature2'),
                      t('oneTime2w.feature3'),
                      t('oneTime2w.feature4'),
                      t('oneTime2w.feature5'),
                      t('oneTime2w.feature6'),
                      t('oneTime2w.feature7'),
                    ]}
                    ctaLabel={t('oneTime2w.cta')}
                    productType="PLAN_2W"
                    onCtaClick={() => handleCtaClick('PLAN_2W')}
                  />
                  <PricingCard
                    variant="popular"
                    name={t('oneTime4w.name')}
                    price={t('oneTime4w.price')}
                    period={t('oneTime4w.period')}
                    description={t('oneTime4w.desc')}
                    popularLabel={t('oneTime4w.badge')}
                    features={[
                      t('oneTime4w.feature1'),
                      t('oneTime4w.feature2'),
                      t('oneTime4w.feature3'),
                      t('oneTime4w.feature4'),
                      t('oneTime4w.feature5'),
                      t('oneTime4w.feature6'),
                      t('oneTime4w.feature7'),
                    ]}
                    ctaLabel={t('oneTime4w.cta')}
                    productType="PLAN_4W"
                    onCtaClick={() => handleCtaClick('PLAN_4W')}
                  />
                </div>
                <div className="max-w-3xl w-full mx-auto rounded-lg border border-border bg-muted/40 px-5 py-3 text-sm text-muted-foreground text-center">
                  {t('oneTimeSubNote')}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <ForWhomSection title={t('forWhomTitle')} items={forWhomItems} />

      <MealPlanContents title={t('contentsTitle')} items={contentsItems} />

      <ComparisonTable title={t('compareTitle')} headers={tableHeaders} rows={tableRows} />

      <NoRiskSection title={t('noRiskTitle')} text={t('noRiskText')} />

      <OfertaFaq title={t('faqTitle')} items={faqItems} />
    </>
  );
}
