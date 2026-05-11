'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Star, Loader2, CheckCircle, XCircle, Clock, Search, Pin, Reply } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { TestimonialWithUser, TestimonialStatus } from '@/types/api';

const STATUS_FILTERS: (TestimonialStatus | 'ALL')[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  avgRating: number;
}

export function AdminTestimonials() {
  const t = useTranslations('admin.testimonials');
  const { data: session } = useSession();
  const token = '';

  const [testimonials, setTestimonials] = useState<TestimonialWithUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TestimonialStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const fetchData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError('Brak tokenu — zaloguj się ponownie');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search) params.search = search;
      if (sortBy !== 'createdAt') params.sortBy = sortBy;
      if (sortOrder !== 'desc') params.sortOrder = sortOrder;
      const res = await api.testimonials.adminList(params as Parameters<typeof api.testimonials.adminList>[0], token);
      setTestimonials(res.testimonials);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać opinii');
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, search, sortBy, sortOrder]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.testimonials.adminGetStats(token);
      setStats(res.stats);
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function handleStatusChange(id: string, status: 'APPROVED' | 'REJECTED') {
    if (!token) return;
    setActionLoading(id);
    try {
      await api.testimonials.adminUpdateStatus(id, status, token);
      await fetchData();
      await fetchStats();
    } catch {
      // error
    } finally {
      setActionLoading(null);
    }
  }

  const handleBulk = (status: 'APPROVED' | 'REJECTED') => {
    if (!token || selectedIds.size === 0) return;
    startBulkTransition(async () => {
      try {
        await api.testimonials.adminBulkStatus(Array.from(selectedIds), status, token);
        setSelectedIds(new Set());
        await fetchData();
        await fetchStats();
      } catch {
        // silent
      }
    });
  };

  const handlePin = async (id: string) => {
    if (!token) return;
    try {
      await api.testimonials.adminTogglePin(id, token);
      await fetchData();
    } catch {
      // silent
    }
  };

  const handleReply = async (id: string) => {
    if (!token || !replyText.trim()) return;
    try {
      await api.testimonials.adminReply(id, replyText.trim(), token);
      setReplyingId(null);
      setReplyText('');
      await fetchData();
    } catch {
      // silent
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === testimonials.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(testimonials.map((t) => t.id)));
    }
  };

  function getUserName(item: TestimonialWithUser): string {
    const first = item.user?.patient?.firstName;
    const last = item.user?.patient?.lastName;
    if (first && last) return `${first} ${last}`;
    if (first) return first;
    return item.user?.email ?? '—';
  }

  function getStatusBadge(status: TestimonialStatus) {
    switch (status) {
      case 'APPROVED':
        return (
          <Badge variant="outline" className="text-green-600 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('approved')}
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="outline" className="text-red-600 border-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            {t('rejected')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            {t('pending')}
          </Badge>
        );
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </div>

      {/* Stats (49.3) */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl">
          <Card className="border-border">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t('statsTotal')}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">{t('statsPending')}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-green-600">{stats.approved}</p>
              <p className="text-xs text-muted-foreground">{t('statsApproved')}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="py-3 text-center">
              <p className="text-xl font-bold">{stats.avgRating} ⭐</p>
              <p className="text-xs text-muted-foreground">{t('statsAvgRating')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters (49.1) */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Select value={`${sortBy}-${sortOrder}`} onValueChange={(v) => { const [sb, so] = v.split('-'); setSortBy(sb); setSortOrder(so); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt-desc">{t('sortNewest')}</SelectItem>
            <SelectItem value="createdAt-asc">{t('sortOldest')}</SelectItem>
            <SelectItem value="rating-desc">{t('sortRatingDesc')}</SelectItem>
            <SelectItem value="rating-asc">{t('sortRatingAsc')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'sage' : 'outline'}
            size="sm"
            onClick={() => { setStatusFilter(s); setPage(1); }}
          >
            {s === 'ALL' ? t('filterAll') : t(s.toLowerCase() as 'pending' | 'approved' | 'rejected')}
          </Button>
        ))}
      </div>

      {/* Bulk bar (49.2) */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{t('bulkSelected', { count: selectedIds.size })}</span>
          <Button size="sm" variant="outline" onClick={() => handleBulk('APPROVED')} disabled={isBulkPending} className="text-xs text-green-600">
            {t('bulkApprove')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulk('REJECTED')} disabled={isBulkPending} className="text-xs text-red-600">
            {t('bulkReject')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-xs ml-auto">
            {t('bulkClear')}
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : testimonials.length === 0 && !error ? (
        <p className="text-muted-foreground text-center py-8">{t('noTestimonials')}</p>
      ) : (
        <div className="space-y-4">
          {/* Select all (49.2) */}
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === testimonials.length} onChange={toggleSelectAll} className="rounded" />
            <span className="text-xs text-muted-foreground">{t('selectAll')}</span>
          </div>

          {testimonials.map((item) => (
            <Card key={item.id} className={selectedIds.has(item.id) ? 'ring-2 ring-primary' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="rounded" />
                    <CardTitle className="text-base">{getUserName(item)}</CardTitle>
                    {getStatusBadge(item.status)}
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">
                      {new Date(item.createdAt).toLocaleDateString('pl-PL')}
                    </span>
                    {item.reviewedAt && (
                      <span className="text-xs text-muted-foreground/60 block">
                        {t('reviewedAt')}: {new Date(item.reviewedAt).toLocaleDateString('pl-PL')}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-0.5 mb-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i <= item.rating ? 'fill-brand-orange text-brand-orange' : 'text-muted-foreground'}`}
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">
                  &ldquo;{item.content}&rdquo;
                </p>
                {item.user?.email && (
                  <p className="text-xs text-muted-foreground mb-3">{item.user.email}</p>
                )}

                {/* Admin reply display */}
                {item.adminReply && (
                  <div className="bg-muted/50 rounded-md p-3 mb-3 border-l-2 border-primary">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Reply className="h-3 w-3" />
                      {t('adminReplyLabel')}
                    </div>
                    <p className="text-sm">{item.adminReply}</p>
                  </div>
                )}

                {/* Reply form */}
                {replyingId === item.id && (
                  <div className="mb-3 space-y-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={t('replyPlaceholder')}
                      maxLength={500}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleReply(item.id)} disabled={!replyText.trim()}>
                        {t('replySave')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setReplyingId(null); setReplyText(''); }}>
                        {t('replyCancel')}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {item.status !== 'APPROVED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-300 hover:bg-green-50"
                      disabled={actionLoading === item.id}
                      onClick={() => handleStatusChange(item.id, 'APPROVED')}
                    >
                      {actionLoading === item.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      )}
                      {t('approve')}
                    </Button>
                  )}
                  {item.status !== 'REJECTED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      disabled={actionLoading === item.id}
                      onClick={() => handleStatusChange(item.id, 'REJECTED')}
                    >
                      {actionLoading === item.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {t('reject')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePin(item.id)}
                    className={item.isPinned ? 'text-primary border-primary' : ''}
                  >
                    <Pin className="h-3 w-3 mr-1" />
                    {item.isPinned ? t('unpin') : t('pin')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setReplyingId(item.id); setReplyText(item.adminReply ?? ''); }}
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    {t('reply')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('prev')}
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                {t('next')}
              </Button>
            </div>
          )}

          {/* Count (49.9) */}
          <div className="text-xs text-muted-foreground text-center py-1">
            {t('totalCount', { count: total })}
          </div>
        </div>
      )}
    </div>
  );
}
