'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { ShoppingCart, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { api, ApiError } from '@/lib/api';
import type { CheckoutProductType } from '@/types/api';

const VALID_PRODUCTS: Record<string, 1> = {
  FREE_7: 1,
  TRIAL: 1,
  OPIEKA_MIESIECZNA: 1,
  OPIEKA_ROCZNA: 1,
  PLAN_2W: 1,
  PLAN_4W: 1,
  CONSULTATION: 1,
};

/** Products that require auto-renewal consent checkbox. */
const SUBSCRIPTION_PRODUCTS = new Set<string>([
  'TRIAL',
  'OPIEKA_MIESIECZNA',
  'OPIEKA_ROCZNA',
]);

interface ProductInfo {
  price: string;
  period: string;
  isTrial: boolean;
  isSubscription: boolean;
  afterTrialPrice: string | null;
}

function getProductInfo(product: string): ProductInfo {
  switch (product) {
    case 'TRIAL':
      return { price: '0', period: '7d', isTrial: true, isSubscription: true, afterTrialPrice: '129' };
    case 'OPIEKA_MIESIECZNA':
      return { price: '129', period: 'month', isTrial: false, isSubscription: true, afterTrialPrice: null };
    case 'OPIEKA_ROCZNA':
      return { price: '99', period: 'month', isTrial: false, isSubscription: true, afterTrialPrice: null };
    case 'PLAN_2W':
      return { price: '129', period: 'once', isTrial: false, isSubscription: false, afterTrialPrice: null };
    case 'PLAN_4W':
      return { price: '199', period: 'once', isTrial: false, isSubscription: false, afterTrialPrice: null };
    case 'CONSULTATION':
      return { price: '399', period: 'once', isTrial: false, isSubscription: false, afterTrialPrice: null };
    default:
      return { price: '0', period: 'once', isTrial: false, isSubscription: false, afterTrialPrice: null };
  }
}

function isConsultation(product: string) {
  return product === 'CONSULTATION';
}

export function OrderCheckout() {
  const t = useTranslations('order');
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawProduct = searchParams.get('product') as CheckoutProductType | null;
  const product: CheckoutProductType = rawProduct && rawProduct in VALID_PRODUCTS ? rawProduct : 'FREE_7';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRenewalConsent, setAutoRenewalConsent] = useState(false);
  const [immediateServiceConsent, setImmediateServiceConsent] = useState(false);

  const info = useMemo(() => getProductInfo(product), [product]);
  const needsConsent = SUBSCRIPTION_PRODUCTS.has(product);
  const canSubmit = (!needsConsent || autoRenewalConsent) && immediateServiceConsent;

  async function handleOrder() {
    const token = '';
    if (!token || !canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.checkout.createSession(
        { productType: product },
        token,
      );

      if (result.url) {
        // Stripe checkout URL or mock redirect
        window.location.href = result.url;
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(t('errorGeneral'));
      } else {
        setError(t('errorGeneral'));
      }
      setLoading(false);
    }
  }

  const productLabel = t(`products.${product}`);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-cream-50 to-sage-50/40 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
        </div>

        {/* Selected product + price details */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              {t('product')}
              <Badge variant="sage-outline">{productLabel}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-extrabold">{info.price} zł</span>
              <span className="text-sm text-muted-foreground">
                {t(`period.${info.period}`)}
              </span>
            </div>

            {/* Trial: what happens after */}
            {info.isTrial && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{t('trialAfterInfo', { price: info.afterTrialPrice ?? '129' })}</span>
              </div>
            )}

            {/* Yearly: billing breakdown */}
            {product === 'OPIEKA_ROCZNA' && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('yearlyBilledAs')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Auto-renewal consent (legally required for subscriptions) */}
        {needsConsent && (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-4 space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="auto-renewal-consent"
                checked={autoRenewalConsent}
                onCheckedChange={(checked) => setAutoRenewalConsent(checked === true)}
                className="mt-0.5"
              />
              <label
                htmlFor="auto-renewal-consent"
                className="text-sm leading-snug cursor-pointer select-none"
              >
                {info.isTrial
                  ? t('consentTrial', { price: info.afterTrialPrice ?? '129' })
                  : t('consentSubscription')}
              </label>
            </div>
            <p className="text-xs text-muted-foreground pl-7">
              {t('consentCancelInfo')}
            </p>
          </div>
        )}

        {/* Immediate service consent (art. 38 pkt 1 ustawy o prawach konsumenta) */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="immediate-service-consent"
              checked={immediateServiceConsent}
              onCheckedChange={(checked) => setImmediateServiceConsent(checked === true)}
              className="mt-0.5"
            />
            <label
              htmlFor="immediate-service-consent"
              className="text-sm leading-snug cursor-pointer select-none"
            >
              {t('consentImmediateService')}
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* CTA */}
        {status === 'loading' ? (
          <Button disabled size="lg" className="w-full">
            <Loader2 className="h-4 w-4 animate-spin" />
          </Button>
        ) : !session ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">{t('loginRequired')}</p>
            <Button asChild variant="sage" size="lg" className="w-full">
              <Link href="/zaloguj">{t('loginCta')}</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              variant="sage"
              size="lg"
              className="w-full gap-2"
              disabled={loading || !canSubmit}
              onClick={handleOrder}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('ctaLoading')}
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  {needsConsent
                    ? t('ctaButtonSubscription', { price: info.isTrial ? (info.afterTrialPrice ?? '129') : info.price })
                    : t('ctaButton')}
                </>
              )}
            </Button>
            {/* Withdrawal right info */}
            <p className="text-center text-xs text-muted-foreground">
              {t('withdrawalNote')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
