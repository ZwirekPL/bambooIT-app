'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, TrendingDown, Download, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Props {
  token: string;
}

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthOptions(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

const fmt = (v: number) => v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function AccountingPage({ token }: Props) {
  const t = useTranslations('admin.accounting');
  const [month, setMonth] = useState(getCurrentMonth());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {getMonthOptions().map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">{t('tabRevenue')}</TabsTrigger>
          <TabsTrigger value="costs">{t('tabCosts')}</TabsTrigger>
          <TabsTrigger value="churn">{t('tabChurn')}</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue"><RevenueTab token={token} month={month} /></TabsContent>
        <TabsContent value="costs"><CostsTab token={token} month={month} /></TabsContent>
        <TabsContent value="churn"><ChurnTab token={token} month={month} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Revenue Tab ──────────────────────────────────────────────────────────────

interface RevenueReport {
  month: string;
  vatEnabled: boolean;
  vatRate: number;
  rows: Array<{ productType: string; count: number; brutto: number; netto: number | null; vat: number | null }>;
  totalBrutto: number;
  totalNetto: number | null;
  totalVat: number | null;
  previousMonthBrutto: number;
  changePercent: number | null;
}

function RevenueTab({ token, month }: { token: string; month: string }) {
  const t = useTranslations('admin.accounting');
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [isPending, startTransition] = useTransition();
  const [csvLoading, setCsvLoading] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await api.accounting.getRevenue(month, token);
        setReport(res.report);
      } catch { /* ignore */ }
    });
  }, [month]);

  async function downloadCsv() {
    setCsvLoading(true);
    try {
      const res = await fetch(`/api/proxy/admin/accounting/transactions-csv?month=${month}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transakcje-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setCsvLoading(false);
  }

  if (!report) return <div className="text-center py-8 text-muted-foreground">{isPending ? '...' : t('noData')}</div>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('totalRevenue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(report.totalBrutto)} PLN</div>
            {report.changePercent !== null && (
              <p className={`text-xs flex items-center gap-1 ${report.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {report.changePercent >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {report.changePercent > 0 ? '+' : ''}{report.changePercent}% {t('vsPreviousMonth')}
              </p>
            )}
          </CardContent>
        </Card>

        {report.vatEnabled && (
          <>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('netRevenue')}</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{fmt(report.totalNetto ?? 0)} PLN</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">VAT ({report.vatRate}%)</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{fmt(report.totalVat ?? 0)} PLN</div></CardContent>
            </Card>
          </>
        )}
      </div>

      {/* CSV export */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={downloadCsv} disabled={csvLoading}>
          <Download className="h-4 w-4 mr-1" />{t('exportCsv')}
        </Button>
      </div>

      {/* Breakdown table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('colProduct')}</TableHead>
            <TableHead>{t('colCount')}</TableHead>
            <TableHead>{t('colBrutto')}</TableHead>
            {report.vatEnabled && <TableHead>{t('colNetto')}</TableHead>}
            {report.vatEnabled && <TableHead>VAT</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.rows.map((r) => (
            <TableRow key={r.productType}>
              <TableCell className="font-medium">{r.productType}</TableCell>
              <TableCell>{r.count}</TableCell>
              <TableCell>{fmt(r.brutto)} PLN</TableCell>
              {report.vatEnabled && <TableCell>{fmt(r.netto ?? 0)} PLN</TableCell>}
              {report.vatEnabled && <TableCell>{fmt(r.vat ?? 0)} PLN</TableCell>}
            </TableRow>
          ))}
          {report.rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={report.vatEnabled ? 5 : 3} className="text-center text-muted-foreground py-8">{t('noData')}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Costs Tab ────────────────────────────────────────────────────────────────

interface CostReport {
  month: string;
  revenue: number;
  aiCosts: number;
  stripeFees: number;
  netProfit: number;
  aiCostsPercent: number;
  stripeFeesPercent: number;
  marginPercent: number;
}

function CostsTab({ token, month }: { token: string; month: string }) {
  const t = useTranslations('admin.accounting');
  const [report, setReport] = useState<CostReport | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await api.accounting.getCosts(month, token);
        setReport(res.report);
      } catch { /* ignore */ }
    });
  }, [month]);

  if (!report) return <div className="text-center py-8 text-muted-foreground">{isPending ? '...' : t('noData')}</div>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('revenue')}</CardTitle></CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{fmt(report.revenue)} PLN</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('aiCosts')}</CardTitle></CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{fmt(report.aiCosts)} PLN</div>
          <p className="text-xs text-muted-foreground">{report.aiCostsPercent}% {t('ofRevenue')}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('stripeFees')}</CardTitle></CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{fmt(report.stripeFees)} PLN</div>
          <p className="text-xs text-muted-foreground">{report.stripeFeesPercent}% {t('ofRevenue')}</p>
        </CardContent>
      </Card>
      <Card className={report.netProfit >= 0 ? 'border-green-200' : 'border-red-200'}>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('netProfit')}</CardTitle></CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${report.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(report.netProfit)} PLN</div>
          <p className="text-xs text-muted-foreground">{t('margin')}: {report.marginPercent}%</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Churn Tab ────────────────────────────────────────────────────────────────

interface ChurnReport {
  month: string;
  activeStart: number;
  newSubscriptions: number;
  cancelled: number;
  activeEnd: number;
  churnRate: number;
  retentionRate: number;
  netChange: number;
}

function ChurnTab({ token, month }: { token: string; month: string }) {
  const t = useTranslations('admin.accounting');
  const [report, setReport] = useState<ChurnReport | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await api.accounting.getChurn(month, token);
        setReport(res.report);
      } catch { /* ignore */ }
    });
  }, [month]);

  if (!report) return <div className="text-center py-8 text-muted-foreground">{isPending ? '...' : t('noData')}</div>;

  const churnColor = report.churnRate < 5 ? 'text-green-600' : report.churnRate < 10 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{t('activeSubscriptions')}</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{report.activeEnd}</div>
          <p className="text-xs text-muted-foreground">{t('startOfMonth')}: {report.activeStart}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('newSubscriptions')}</CardTitle></CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600 flex items-center gap-1">
            <TrendingUp className="h-5 w-5" />{report.newSubscriptions}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('cancelled')}</CardTitle></CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600 flex items-center gap-1">
            <TrendingDown className="h-5 w-5" />{report.cancelled}
          </div>
          <p className="text-xs text-muted-foreground">{t('netChange')}: {report.netChange >= 0 ? '+' : ''}{report.netChange}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('churnRate')}</CardTitle></CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${churnColor}`}>{report.churnRate}%</div>
          <p className="text-xs text-muted-foreground">{t('retention')}: {report.retentionRate}%</p>
        </CardContent>
      </Card>
    </div>
  );
}
