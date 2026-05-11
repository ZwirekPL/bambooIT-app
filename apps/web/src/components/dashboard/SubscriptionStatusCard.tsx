'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import type { Subscription } from '@/types/api';

export function SubscriptionStatusCard() {
  const t = useTranslations('dashboard.subscription');
  const { data: session } = useSession();
  const token = '';

  const [sub, setSub] = useState<Subscription | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.orders.listMy(token)
      .then((res) => { setSub(res.subscription); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [token]);

  if (!loaded) return null;

  const status = sub?.status?.toLowerCase();
  const endDate = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('pl-PL') : null;
  const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;

  let Icon = CreditCard;
  let badgeClass = 'bg-muted text-muted-foreground';
  let label = t('none');
  let description = t('noneDesc');
  let linkHref = '/oferta';
  let linkLabel = t('seeOffer');

  if (status === 'trialing') {
    const daysLeft = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86400000)) : 0;
    Icon = Clock;
    badgeClass = 'bg-yellow-100 text-yellow-800';
    label = t('trialing', { days: daysLeft });
    description = t('trialingDesc');
    linkHref = '/dashboard/subskrypcja';
    linkLabel = t('manage');
  } else if (status === 'active') {
    Icon = CheckCircle2;
    badgeClass = 'bg-green-100 text-green-800';
    label = t('active', { date: endDate ?? '' });
    description = t('activeDesc');
    linkHref = '/dashboard/subskrypcja';
    linkLabel = t('manage');
  } else if (status === 'past_due') {
    Icon = AlertTriangle;
    badgeClass = 'bg-red-100 text-red-800';
    label = t('pastDue');
    description = t('pastDueDesc');
    linkHref = '/dashboard/subskrypcja';
    linkLabel = t('updatePayment');
  } else if (status === 'canceled') {
    Icon = XCircle;
    badgeClass = 'bg-gray-100 text-gray-600';
    label = t('canceled', { date: endDate ?? '' });
    description = t('canceledDesc');
    linkHref = '/oferta';
    linkLabel = t('renew');
  }

  return (
    <Card className="border-border">
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage-50">
            <Icon className="h-4 w-4 text-sage-600" />
          </div>
          <div>
            <Badge className={`${badgeClass} text-xs`}>{label}</Badge>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Link href={linkHref} className="text-sm font-medium text-sage-700 hover:underline shrink-0">
          {linkLabel} →
        </Link>
      </CardContent>
    </Card>
  );
}
