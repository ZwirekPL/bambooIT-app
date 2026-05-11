'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { ExternalLink, Zap } from 'lucide-react';
import type { SubscriptionPlan } from '@/types/api';

interface SubscriptionActionsProps {
  plan: SubscriptionPlan;
  hasStripeCustomer: boolean;
  token: string;
}

export function SubscriptionActions({ plan, hasStripeCustomer, token }: SubscriptionActionsProps) {
  const t = useTranslations('dietitian.subscription');
  const [loadingUpgrade, setLoadingUpgrade] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setError(null);
    setLoadingUpgrade(true);
    try {
      const result = await api.subscription.createCheckout('PRO_MONTHLY', token);
      window.location.href = result.url;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(t('upgradeError'));
      } else {
        setError(t('upgradeError'));
      }
      setLoadingUpgrade(false);
    }
  }

  async function handlePortal() {
    setError(null);
    setLoadingPortal(true);
    try {
      const result = await api.subscription.getPortal(token);
      window.location.href = result.url;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(t('manageError'));
      } else {
        setError(t('manageError'));
      }
      setLoadingPortal(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <div className="flex flex-wrap gap-3">
        {plan === 'FREE' && (
          <Button onClick={handleUpgrade} disabled={loadingUpgrade} className="gap-2">
            <Zap className="h-4 w-4" />
            {loadingUpgrade ? '...' : t('upgrade')}
          </Button>
        )}
        {hasStripeCustomer && (
          <Button variant="outline" onClick={handlePortal} disabled={loadingPortal} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            {loadingPortal ? '...' : t('manage')}
          </Button>
        )}
      </div>
    </div>
  );
}
