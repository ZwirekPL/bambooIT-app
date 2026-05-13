'use client';

import { useState, useCallback } from 'react';
import { Repeat, TrendingUp, Clock, BarChart3, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SubscriptionStats, SubscriptionItem } from '@/types/api';

type DialogFilter = 'ACTIVE' | 'TRIALING';

interface SubscriptionStatsCardsProps {
  stats: SubscriptionStats;
  token: string;
}

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  iconClass,
  onClick,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ElementType;
  iconClass: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`border-border ${onClick ? 'cursor-pointer hover:border-primary/40 hover:shadow-md transition-all' : ''}`}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {sublabel && <p className="text-xs text-muted-foreground/70">{sublabel}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function productLabel(productType: string) {
  const map: Record<string, string> = {
    START: 'Pakiet Start',
    FIRMA: 'Pakiet Firma',
    FIRMA_PLUS: 'Pakiet Firma Plus',
  };
  return map[productType] ?? productType;
}

const DIALOG_TITLE_KEY: Record<DialogFilter, string> = {
  ACTIVE: 'dialogSubscriptionsTitle',
  TRIALING: 'dialogTrialsTitle',
};

export default function SubscriptionStatsCards({ stats, token }: SubscriptionStatsCardsProps) {
  const t = useTranslations('admin.subscriptions');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogFilter, setDialogFilter] = useState<DialogFilter>('ACTIVE');
  const [dialogItems, setDialogItems] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const openDialog = useCallback(async (filter: DialogFilter) => {
    setDialogFilter(filter);
    setDialogOpen(true);
    setLoading(true);
    setDialogItems([]);

    try {
      const query = new URLSearchParams({ page: '1', limit: '100', status: filter });
      const res = await fetch(`/api/proxy/admin/subscriptions?${query}`);
      if (res.ok) {
        const data = await res.json();
        setDialogItems(data.items ?? []);
      }
    } catch {
      // silent — show empty
    } finally {
      setLoading(false);
    }
  }, [token]);

  return (
    <>
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('mrr')}
          value={`${stats.mrr} zł`}
          sublabel={t('mrrUnit')}
          icon={TrendingUp}
          iconClass="bg-green-50 text-green-600"
        />
        <StatCard
          label={t('activeSubscriptions')}
          value={stats.activeSubscriptions.total}
          sublabel={`Start: ${stats.activeSubscriptions.start} / Firma: ${stats.activeSubscriptions.firma} / Firma+: ${stats.activeSubscriptions.firmaPlus}`}
          icon={Repeat}
          iconClass="bg-blue-50 text-blue-600"
          onClick={() => openDialog('ACTIVE')}
        />
        <StatCard
          label={t('activeTrials')}
          value={stats.trials.active}
          sublabel={`${t('trialsExpired')}: ${stats.trials.expired}`}
          icon={Clock}
          iconClass="bg-amber-50 text-amber-600"
          onClick={() => openDialog('TRIALING')}
        />
        <StatCard
          label={t('churnRate')}
          value={`${stats.churnRate}%`}
          icon={BarChart3}
          iconClass="bg-red-50 text-red-500"
        />
      </div>

      {/* Detail dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {t(DIALOG_TITLE_KEY[dialogFilter])}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('dialogLoading')}</p>
            ) : dialogItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('dialogEmpty')}</p>
            ) : (
              <div className="space-y-2">
                {dialogItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.userEmail}</p>
                      {item.userName && (
                        <p className="text-xs text-muted-foreground">{item.userName}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <Badge variant="secondary" className="text-xs">
                        {productLabel(item.productType)}
                      </Badge>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {t('dialogSince')}: {new Date(item.createdAt).toLocaleDateString('pl-PL')}
                      </p>
                      {item.currentPeriodEnd && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {t('dialogEnds')}: {new Date(item.currentPeriodEnd).toLocaleDateString('pl-PL')}
                        </p>
                      )}
                    </div>
                    {item.stripeSubscriptionId && (
                      <a
                        href={`https://dashboard.stripe.com/subscriptions/${item.stripeSubscriptionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-primary hover:text-primary/80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
