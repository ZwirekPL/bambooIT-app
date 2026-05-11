'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ClipboardList, Users, AlertTriangle } from 'lucide-react';

interface ActionItemsData {
  plansAwaitingReview: number;
  patientsWithoutPlan: number;
  redFlagPlans: number;
}

export function ActionItems() {
  const t = useTranslations('dietitian.actionItems');
  const { data: session } = useSession();
  const token = '';

  const [data, setData] = useState<ActionItemsData | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!token) return;
    startTransition(async () => {
      try {
        const res = await api.dietitian.getActionItems(token);
        setData(res.actionItems);
      } catch { /* ignore */ }
    });
  }, [token]);

  if (!data) return null;

  const items = [
    {
      count: data.plansAwaitingReview,
      label: t('plansAwaitingReview'),
      href: '/dietetyk/pacjenci?planStatus=GENERATED',
      Icon: ClipboardList,
      color: 'text-amber-600',
    },
    {
      count: data.patientsWithoutPlan,
      label: t('patientsWithoutPlan'),
      href: '/dietetyk/pacjenci?planStatus=none',
      Icon: Users,
      color: 'text-blue-600',
    },
    {
      count: data.redFlagPlans,
      label: t('redFlagPlans'),
      href: '/dietetyk/pacjenci?planStatus=MANUAL_REVIEW_REQUIRED',
      Icon: AlertTriangle,
      color: 'text-red-600',
    },
  ].filter((i) => i.count > 0);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            {t('allDone')}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <item.Icon className={`h-4 w-4 ${item.color}`} />
                  <span className="text-sm group-hover:underline">{item.label}</span>
                </div>
                <Badge variant="secondary" className="text-xs">{item.count}</Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
