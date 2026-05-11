'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { CheckoutProductType } from '@/types/api';

interface TrialStepProps {
  token: string;
  onComplete: () => void;
}

export function TrialStep({ token, onComplete }: TrialStepProps) {
  const t = useTranslations('onboarding.trial');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralStatus, setReferralStatus] = useState<'idle' | 'applied' | 'invalid'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!consent) {
      setConsentError(true);
      return;
    }
    setConsentError(false);
    setLoading(true);
    setError(null);

    try {
      // Map plan selection to checkout product type
      const productType: CheckoutProductType = selectedPlan === 'yearly' ? 'TRIAL_YEARLY' : 'TRIAL';

      const result = await api.checkout.createSession(
        { productType, referralCode: referralCode.trim() || undefined },
        token,
      );

      if (result.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.url;
      } else {
        // No Stripe configured (mock mode) — treat as complete
        onComplete();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unknown error');
      }
      setLoading(false);
    }
  }

  function handleReferralBlur() {
    if (!referralCode.trim()) {
      setReferralStatus('idle');
      return;
    }
    // Basic format check: DIET-XXXXX (5 alphanumeric chars)
    const isValidFormat = /^DIET-[A-Z0-9]{4,8}$/.test(referralCode.trim());
    setReferralStatus(isValidFormat ? 'applied' : 'invalid');
  }

  const features = ['diet', 'swap', 'checkin', 'support', 'measurements', 'medications'] as const;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{t('title')}</h2>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>

      {/* Plan selection cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Monthly */}
        <Card
          className={`cursor-pointer transition-all ${
            selectedPlan === 'monthly'
              ? 'border-primary ring-2 ring-primary/20'
              : 'hover:border-primary/50'
          }`}
          onClick={() => setSelectedPlan('monthly')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{t('monthly')}</CardTitle>
              <Badge variant="secondary">{t('trialBadge')}</Badge>
            </div>
            <CardDescription>{t('monthlyAfterTrial')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">129 <span className="text-base font-normal text-muted-foreground">zł/mies.</span></p>
            <ul className="mt-3 space-y-1">
              {features.map((f) => (
                <li key={f} className="text-sm flex items-center gap-2">
                  <span className="text-green-500">&#10003;</span>
                  {t(`features.${f}`)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Yearly */}
        <Card
          className={`cursor-pointer transition-all ${
            selectedPlan === 'yearly'
              ? 'border-primary ring-2 ring-primary/20'
              : 'hover:border-primary/50'
          }`}
          onClick={() => setSelectedPlan('yearly')}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{t('yearly')}</CardTitle>
              <Badge className="bg-green-100 text-green-700">{t('yearlySave')}</Badge>
            </div>
            <CardDescription>{t('yearlyAfterTrial')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">99 <span className="text-base font-normal text-muted-foreground">zł/mies.</span></p>
            <ul className="mt-3 space-y-1">
              {features.map((f) => (
                <li key={f} className="text-sm flex items-center gap-2">
                  <span className="text-green-500">&#10003;</span>
                  {t(`features.${f}`)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Referral code */}
      <div className="space-y-2">
        <Label htmlFor="referralCode">{t('referralCode')}</Label>
        <div className="flex gap-2">
          <Input
            id="referralCode"
            placeholder={t('referralPlaceholder')}
            value={referralCode}
            onChange={(e) => {
              setReferralCode(e.target.value.toUpperCase());
              setReferralStatus('idle');
            }}
            onBlur={handleReferralBlur}
            className="max-w-xs"
          />
        </div>
        {referralStatus === 'applied' && (
          <p className="text-sm text-green-600">{t('referralApplied')}</p>
        )}
        {referralStatus === 'invalid' && (
          <p className="text-sm text-red-500">{t('referralInvalid')}</p>
        )}
      </div>

      {/* Consent */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="consent"
            checked={consent}
            onCheckedChange={(checked) => {
              setConsent(checked === true);
              if (checked) setConsentError(false);
            }}
          />
          <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
            {t('consent')}
          </Label>
        </div>
        {consentError && (
          <p className="text-xs text-red-500 ml-7">{t('consentRequired')}</p>
        )}
      </div>

      {/* Legal notice */}
      <p className="text-xs text-muted-foreground">{t('legal')}</p>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</p>
      )}

      <Button onClick={handleSubmit} className="w-full" size="lg" disabled={loading}>
        {loading ? '...' : t('submit')}
      </Button>
    </div>
  );
}
