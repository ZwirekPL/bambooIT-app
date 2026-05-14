'use client';

import { useState, useCallback, useEffect } from 'react';
import { ExternalLink, CalendarDays, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SubscriptionItem } from '@/types/api';

interface SubscriptionTableProps {
  initialItems: SubscriptionItem[];
  initialTotal: number;
  token: string;
}

function statusBadge(status: string) {
  const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    ACTIVE: { variant: 'default', label: 'Active' },
    TRIALING: { variant: 'secondary', label: 'Trial' },
    PAST_DUE: { variant: 'destructive', label: 'Past due' },
    CANCELED: { variant: 'outline', label: 'Cancelled' },
    INCOMPLETE: { variant: 'outline', label: 'Incomplete' },
    PAID: { variant: 'default', label: 'Paid' },
    COMPLETED: { variant: 'secondary', label: 'Completed' },
    CANCELLED: { variant: 'outline', label: 'Cancelled' },
    PENDING_PAYMENT: { variant: 'outline', label: 'Pending' },
  };
  const s = map[status] ?? { variant: 'outline' as const, label: status };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function productLabel(productType: string) {
  const map: Record<string, string> = {
    START: 'Pakiet Start',
    FIRMA: 'Pakiet Firma',
    FIRMA_PLUS: 'Pakiet Firma Plus',
  };
  return map[productType] ?? productType;
}

export default function SubscriptionTable({ initialItems, initialTotal, token }: SubscriptionTableProps) {
  const t = useTranslations('admin.subscriptions');
  const [items, setItems] = useState<SubscriptionItem[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const hasFilters = statusFilter || typeFilter || dateFrom || dateTo;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: '1', limit: '100' });
      if (statusFilter) query.set('status', statusFilter);
      if (typeFilter) query.set('productType', typeFilter);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const res = await fetch(`/api/proxy/admin/subscriptions?${query}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // keep current data
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, typeFilter, dateFrom, dateTo]);

  // Re-fetch when filters change
  useEffect(() => {
    if (hasFilters) {
      fetchData();
    } else {
      // Reset to initial data when no filters
      setItems(initialItems);
      setTotal(initialTotal);
    }
  }, [statusFilter, typeFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilters = () => {
    setStatusFilter('');
    setTypeFilter('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {t('title')} ({total})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-8 w-full sm:w-[150px] text-xs">
              <SelectValue placeholder={t('filterStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('filterAll')}</SelectItem>
              <SelectItem value="ACTIVE">{t('statusActive')}</SelectItem>
              <SelectItem value="TRIALING">{t('statusTrialing')}</SelectItem>
              <SelectItem value="CANCELED">{t('statusCanceled')}</SelectItem>
              <SelectItem value="PAID">{t('statusPaid')}</SelectItem>
              <SelectItem value="COMPLETED">{t('statusCompleted')}</SelectItem>
              <SelectItem value="PAST_DUE">{t('statusPastDue')}</SelectItem>
              <SelectItem value="PENDING_PAYMENT">{t('statusPending')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter || '__all__'} onValueChange={(v) => setTypeFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-8 w-full sm:w-[160px] text-xs">
              <SelectValue placeholder={t('filterType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('filterAll')}</SelectItem>
              <SelectItem value="START">Pakiet Start</SelectItem>
              <SelectItem value="FIRMA">Pakiet Firma</SelectItem>
              <SelectItem value="FIRMA_PLUS">Pakiet Firma Plus</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-xs text-navy-soft hidden sm:inline">|</span>

          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-navy-soft" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-full sm:w-[140px] text-xs px-2"
              placeholder={t('filterDateFrom')}
            />
            <span className="text-xs text-navy-soft">–</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-full sm:w-[140px] text-xs px-2"
              placeholder={t('filterDateTo')}
            />
          </div>

          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearFilters}
              className="text-xs h-8 px-2 gap-1"
            >
              <X className="h-3 w-3" />
              {t('filterClear')}
            </Button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-sm text-navy-soft py-8 text-center">{t('dialogLoading')}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-navy-soft py-8 text-center">{t('noResults')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-medium text-navy-soft">{t('colUser')}</th>
                  <th className="py-2 pr-4 font-medium text-navy-soft">{t('colType')}</th>
                  <th className="py-2 pr-4 font-medium text-navy-soft">{t('colStatus')}</th>
                  <th className="py-2 pr-4 font-medium text-navy-soft">{t('colAmount')}</th>
                  <th className="py-2 pr-4 font-medium text-navy-soft">{t('colDate')}</th>
                  <th className="py-2 pr-4 font-medium text-navy-soft">{t('colRenewal')}</th>
                  <th className="py-2 font-medium text-navy-soft">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4">
                      <div className="font-medium truncate max-w-[200px]">{item.userEmail}</div>
                      {item.userName && (
                        <div className="text-xs text-navy-soft">{item.userName}</div>
                      )}
                    </td>
                    <td className="py-3 pr-4">{productLabel(item.productType)}</td>
                    <td className="py-3 pr-4">{statusBadge(item.status)}</td>
                    <td className="py-3 pr-4 tabular-nums">{item.amount} zł</td>
                    <td className="py-3 pr-4 tabular-nums text-navy-soft">
                      {new Date(item.createdAt).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-navy-soft">
                      {item.currentPeriodEnd
                        ? new Date(item.currentPeriodEnd).toLocaleDateString('pl-PL')
                        : '—'}
                      {item.cancelAtPeriodEnd && (
                        <span className="ml-1 text-xs text-destructive">(anulowana)</span>
                      )}
                    </td>
                    <td className="py-3">
                      {item.stripeSubscriptionId && (
                        <a
                          href={`https://dashboard.stripe.com/subscriptions/${item.stripeSubscriptionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {t('stripeLink')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
