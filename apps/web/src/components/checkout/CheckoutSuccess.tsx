'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const PRODUCT_LABELS: Record<string, string> = {
  START: 'Pakiet Start',
  FIRMA: 'Pakiet Firma',
  FIRMA_PLUS: 'Pakiet Firma Plus',
};

export function CheckoutSuccess() {
  const t = useTranslations('checkout');
  const searchParams = useSearchParams();
  const product = searchParams.get('product');
  const isMock = searchParams.get('mock') === 'checkout';
  const productLabel = product ? PRODUCT_LABELS[product] ?? product : null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-cream-50 to-sage-50/40 py-16 px-4">
      <div className="max-w-lg mx-auto text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-brand-green/10 p-4">
            <CheckCircle2 className="h-12 w-12 text-brand-green" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {t('successTitle')}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t('successDescription')}
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
            {productLabel && (
              <p className="text-sm text-muted-foreground">
                {t('successProduct')}: <span className="font-semibold text-foreground">{productLabel}</span>
              </p>
            )}
            <p className="text-sm text-muted-foreground">{t('successNextSteps')}</p>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="sage" size="lg">
            <Link href="/panel">Przejdź do panelu</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
