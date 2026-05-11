'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PaywallGateProps {
  hasAccess: boolean;
  children: React.ReactNode;
}

/**
 * Wraps content that requires an active order.
 * When hasAccess=false, shows a paywall message with CTA to /oferta.
 */
export function PaywallGate({ hasAccess, children }: PaywallGateProps) {
  const t = useTranslations('paywall');

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <Card className="border-border">
      <CardContent className="py-12 flex flex-col items-center text-center gap-4">
        <div className="rounded-full bg-amber-50 p-4">
          <ShieldAlert className="h-8 w-8 text-amber-500" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {t('description')}
          </p>
        </div>
        <Button asChild variant="sage" size="sm" className="gap-2">
          <Link href="/oferta">
            {t('cta')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
