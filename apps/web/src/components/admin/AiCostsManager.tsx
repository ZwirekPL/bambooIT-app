'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { AiCostLog, AiCostSummary } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DollarSign, Cpu, Zap, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';

interface AiCostsManagerProps {
  token: string;
}

type PeriodPreset = '7d' | '30d' | '90d' | 'all';

function getDateRange(preset: PeriodPreset): { dateFrom?: string; dateTo?: string } {
  if (preset === 'all') return {};
  const now = new Date();
  const from = new Date(now);
  if (preset === '7d') from.setDate(from.getDate() - 7);
  else if (preset === '30d') from.setDate(from.getDate() - 30);
  else if (preset === '90d') from.setDate(from.getDate() - 90);
  return { dateFrom: from.toISOString(), dateTo: now.toISOString() };
}

function formatJobType(jobType: string, t: ReturnType<typeof useTranslations>): string {
  const map: Record<string, string> = {
    generate: t('jobGenerate'),
    repair: t('jobRepair'),
    partial: t('jobPartial'),
  };
  return map[jobType] ?? jobType;
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AiCostsManager({ token }: AiCostsManagerProps) {
  const t = useTranslations('admin.aiCosts');

  const [logs, setLogs] = useState<AiCostLog[]>([]);
  const [summary, setSummary] = useState<AiCostSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<PeriodPreset>('30d');
  const [modelFilter, setModelFilter] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { dateFrom, dateTo } = getDateRange(period);
      const res = await api.adminAiCosts.list(
        {
          page,
          limit: 25,
          dateFrom,
          dateTo,
          model: modelFilter || undefined,
        },
        token,
      );
      setLogs(res.logs);
      setSummary(res.summary);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error('Failed to fetch AI costs:', err);
    } finally {
      setLoading(false);
    }
  }, [token, page, period, modelFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePeriodChange = (value: string) => {
    setPeriod(value as PeriodPreset);
    setPage(1);
  };

  const handleModelChange = (value: string) => {
    setModelFilter(value === '__all__' ? '' : value);
    setPage(1);
  };

  const availableModels = summary?.byModel?.map((m) => m.model) ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('description')}</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalCost')}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCost(summary.totalCostUsd)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalPlans')}</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalPlans}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('avgCostPerPlan')}</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCost(summary.avgCostPerPlan)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalTokens')}</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTokens(summary.totalTokens)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Model breakdown */}
      {summary && summary.byModel.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('byModel')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('model')}</TableHead>
                  <TableHead className="text-right">{t('count')}</TableHead>
                  <TableHead className="text-right">{t('tokens')}</TableHead>
                  <TableHead className="text-right">{t('cost')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.byModel.map((m) => (
                  <TableRow key={m.model}>
                    <TableCell className="font-mono text-sm">{m.model}</TableCell>
                    <TableCell className="text-right">{m.count}</TableCell>
                    <TableCell className="text-right">{formatTokens(m.totalTokens)}</TableCell>
                    <TableCell className="text-right">{formatCost(m.totalCostUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('period')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">{t('last7days')}</SelectItem>
            <SelectItem value="30d">{t('last30days')}</SelectItem>
            <SelectItem value="90d">{t('last90days')}</SelectItem>
            <SelectItem value="all">{t('allTime')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={modelFilter || '__all__'} onValueChange={handleModelChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('filterModel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('allModels')}</SelectItem>
            {availableModels.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Logs table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('logs')} ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-sage-600 border-t-transparent" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('noData')}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('date')}</TableHead>
                      <TableHead>{t('model')}</TableHead>
                      <TableHead>{t('jobType')}</TableHead>
                      <TableHead className="text-right">{t('promptTokens')}</TableHead>
                      <TableHead className="text-right">{t('completionTokens')}</TableHead>
                      <TableHead className="text-right">{t('costUsd')}</TableHead>
                      <TableHead>{t('planStatus')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{log.model}</TableCell>
                        <TableCell>{formatJobType(log.jobType, t)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {log.promptTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {log.completionTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCost(log.estimatedCostUsd)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={log.planStatus} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    GENERATED: 'bg-green-100 text-green-800',
    REVIEWED: 'bg-blue-100 text-blue-800',
    PUBLISHED: 'bg-indigo-100 text-indigo-800',
    SENT: 'bg-purple-100 text-purple-800',
    AI_DRAFT: 'bg-yellow-100 text-yellow-800',
    GENERATION_FAILED: 'bg-red-100 text-red-800',
    MANUAL_REVIEW_REQUIRED: 'bg-orange-100 text-orange-800',
  };
  const color = colors[status] ?? 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}
