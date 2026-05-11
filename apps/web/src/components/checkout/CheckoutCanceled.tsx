'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CheckoutCanceled() {
  const t = useTranslations('checkout');
  const searchParams = useSearchParams();
  const product = searchParams.get('product');

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-cream-50 to-sage-50/40 py-16 px-4">
      <div className="max-w-lg mx-auto text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-4">
            <XCircle className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">{t('canceledTitle')}</h1>
          <p className="text-muted-foreground text-lg">{t('canceledDescription')}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="sage" size="lg">
            <Link href={product ? `/oferta` : '/oferta'}>{t('canceledCtaRetry')}</Link>
          </Button>
          <Button asChild variant="sage-outline" size="lg">
            <Link href="/">{t('canceledCtaHome')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
