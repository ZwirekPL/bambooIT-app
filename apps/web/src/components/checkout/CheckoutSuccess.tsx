'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CheckCircle2, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

export function CheckoutSuccess() {
  const t = useTranslations('checkout');
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const product = searchParams.get('product');
  const orderId = searchParams.get('order');
  const isMock = searchParams.get('mock') === 'checkout';
  const isConsultation = product === 'CONSULTATION';

  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);

  async function handlePhoneSave() {
    const cleaned = phone.replace(/\s+/g, '');
    if (!/^(\+48)?\d{9}$/.test(cleaned)) {
      setPhoneError(t('consultationPhoneError'));
      return;
    }
    setPhoneError(null);
    setPhoneLoading(true);
    try {
      const token = '';
      if (!token || !orderId) throw new Error('Missing token or orderId');
      await api.orders.setConsultationPhone(orderId, cleaned, token);
      setPhoneSaved(true);
    } catch {
      setPhoneError(t('consultationPhoneSaveError'));
    } finally {
      setPhoneLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-cream-50 to-sage-50/40 py-16 px-4">
      <div className="max-w-lg mx-auto text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-brand-green/10 p-4">
            {isConsultation
              ? <MessageCircle className="h-12 w-12 text-brand-green" />
              : <CheckCircle2 className="h-12 w-12 text-brand-green" />
            }
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {isConsultation ? t('consultationSuccessTitle') : t('successTitle')}
          </h1>
          <p className="text-muted-foreground text-lg">
            {isConsultation ? t('consultationSuccessDescription') : t('successDescription')}
          </p>
        </div>

        {isMock && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-3 text-sm text-amber-800">
              {t('mockWarning')}
            </CardContent>
          </Card>
        )}

        <Card className="border-border">
          <CardContent className="py-6 space-y-3">
            {product && (
              <p className="text-sm text-muted-foreground">
                {t('successProduct')}: <span className="font-semibold text-foreground">{t(`products.${product}` as 'products.FREE_7')}</span>
              </p>
            )}
            {isConsultation ? (
              <div className="text-left space-y-4">
                {!phoneSaved && orderId ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Phone className="h-4 w-4" />
                      {t('consultationPhoneLabel')}
                    </div>
                    <p className="text-sm text-muted-foreground">{t('consultationPhoneDescription')}</p>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t('consultationPhonePlaceholderLabel')}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+48 123 456 789"
                      />
                      {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
                    </div>
                    <Button onClick={handlePhoneSave} disabled={phoneLoading} className="w-full">
                      {phoneLoading ? '...' : t('consultationPhoneSave')}
                    </Button>
                  </div>
                ) : phoneSaved ? (
                  <div className="text-center space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-brand-green mx-auto" />
                    <p className="text-sm font-medium text-brand-green">{t('consultationPhoneSaved')}</p>
                  </div>
                ) : null}

                <p className="text-sm text-muted-foreground">{t('consultationNextSteps')}</p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>{t('consultationStep1')}</li>
                  <li>{t('consultationStep2')}</li>
                  <li>{t('consultationStep3')}</li>
                </ol>
                <p className="text-sm text-muted-foreground font-medium mt-3">{t('consultationEmailSent')}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('successNextSteps')}</p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {isConsultation ? (
            <Button asChild variant="sage" size="lg">
              <Link href="/dashboard">{t('successCtaDashboard')}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="sage" size="lg">
                <Link href="/dashboard/wywiad">{t('successCtaInterview')}</Link>
              </Button>
              <Button asChild variant="sage-outline" size="lg">
                <Link href="/dashboard">{t('successCtaDashboard')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
