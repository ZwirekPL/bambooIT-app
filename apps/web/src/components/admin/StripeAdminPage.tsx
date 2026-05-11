'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Wallet, TrendingUp, CreditCard, AlertTriangle, Tag, RefreshCw, Plus, Trash2 } from 'lucide-react';

interface Props {
  token: string;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Dashboard {
  balanceAvailable: number;
  balancePending: number;
  mrr: number;
  todayTransactions: number;
  todayRevenue: number;
  failedPayments7d: number;
  currency: string;
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  customerEmail: string | null;
  description: string | null;
  paymentIntentId: string | null;
  refunded: boolean;
  refundedAmount: number;
}

interface FailedPayment {
  id: string;
  amount: number;
  currency: string;
  created: string;
  customerEmail: string | null;
  failureMessage: string | null;
  daysPastDue: number;
}

interface Coupon {
  id: string;
  name: string | null;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  duration: string;
  durationInMonths: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  redeemBy: string | null;
  valid: boolean;
}

export function StripeAdminPage({ token }: Props) {
  const t = useTranslations('admin.payments');

  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <TabsList>
        <TabsTrigger value="dashboard">{t('tabDashboard')}</TabsTrigger>
        <TabsTrigger value="transactions">{t('tabTransactions')}</TabsTrigger>
        <TabsTrigger value="failed">{t('tabFailed')}</TabsTrigger>
        <TabsTrigger value="coupons">{t('tabCoupons')}</TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard"><DashboardTab token={token} /></TabsContent>
      <TabsContent value="transactions"><TransactionsTab token={token} /></TabsContent>
      <TabsContent value="failed"><FailedTab token={token} /></TabsContent>
      <TabsContent value="coupons"><CouponsTab token={token} /></TabsContent>
    </Tabs>
  );
}

// ── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ token }: { token: string }) {
  const t = useTranslations('admin.payments');
  const [data, setData] = useState<Dashboard | null>(null);
  const [isPending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const res = await api.stripeAdmin.getDashboard(token);
        setData(res.dashboard);
      } catch { /* ignore */ }
    });
  }

  useEffect(() => { load(); }, []);

  if (!data) return <div className="text-center py-8 text-muted-foreground">{isPending ? '...' : t('noData')}</div>;

  const fmt = (v: number) => v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{t('balance')}</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{fmt(data.balanceAvailable)} PLN</div>
          <p className="text-xs text-muted-foreground">{t('pending')}: {fmt(data.balancePending)} PLN</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">MRR</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{fmt(data.mrr)} PLN</div>
          <p className="text-xs text-muted-foreground">{t('mrrDescription')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{t('todayTransactions')}</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.todayTransactions}</div>
          <p className="text-xs text-muted-foreground">{fmt(data.todayRevenue)} PLN</p>
        </CardContent>
      </Card>

      <Card className={data.failedPayments7d > 0 ? 'border-red-200' : ''}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{t('failedPayments')}</CardTitle>
          <AlertTriangle className={`h-4 w-4 ${data.failedPayments7d > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${data.failedPayments7d > 0 ? 'text-red-600' : ''}`}>{data.failedPayments7d}</div>
          <p className="text-xs text-muted-foreground">{t('last7days')}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({ token }: { token: string }) {
  const t = useTranslations('admin.payments');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isPending, startTransition] = useTransition();
  const [refundTarget, setRefundTarget] = useState<Transaction | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);

  function load(startingAfter?: string) {
    startTransition(async () => {
      try {
        const params: Record<string, unknown> = { limit: 20 };
        if (startingAfter) params.startingAfter = startingAfter;
        if (statusFilter !== 'all') params.status = statusFilter;
        const res = await api.stripeAdmin.listTransactions(params as Parameters<typeof api.stripeAdmin.listTransactions>[0], token);
        if (startingAfter) {
          setTransactions((prev) => [...prev, ...res.transactions]);
        } else {
          setTransactions(res.transactions);
        }
        setHasMore(res.hasMore);
      } catch { /* ignore */ }
    });
  }

  useEffect(() => { load(); }, [statusFilter]);

  const statusBadge = (s: string) => {
    switch (s) {
      case 'succeeded': return <Badge className="bg-green-100 text-green-800">{t('statusSucceeded')}</Badge>;
      case 'failed': return <Badge variant="destructive">{t('statusFailed')}</Badge>;
      case 'refunded': return <Badge variant="secondary">{t('statusRefunded')}</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">{t('statusPending')}</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  async function handleRefund() {
    if (!refundTarget?.paymentIntentId) return;
    setRefundLoading(true);
    try {
      const amount = refundAmount ? parseFloat(refundAmount) : undefined;
      await api.stripeAdmin.createRefund({ paymentIntentId: refundTarget.paymentIntentId, amount }, token);
      setRefundTarget(null);
      setRefundAmount('');
      load();
    } catch { /* ignore */ }
    setRefundLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filterAll')}</SelectItem>
            <SelectItem value="succeeded">{t('statusSucceeded')}</SelectItem>
            <SelectItem value="failed">{t('statusFailed')}</SelectItem>
            <SelectItem value="refunded">{t('statusRefunded')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('colDate')}</TableHead>
            <TableHead>{t('colCustomer')}</TableHead>
            <TableHead>{t('colAmount')}</TableHead>
            <TableHead>{t('colStatus')}</TableHead>
            <TableHead>{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="text-sm">{new Date(tx.created).toLocaleString('pl-PL')}</TableCell>
              <TableCell className="text-sm">{tx.customerEmail || '—'}</TableCell>
              <TableCell className="font-medium">{tx.amount.toFixed(2)} PLN</TableCell>
              <TableCell>{statusBadge(tx.status)}</TableCell>
              <TableCell>
                {tx.status === 'succeeded' && !tx.refunded && tx.paymentIntentId && (
                  <Button size="sm" variant="ghost" onClick={() => { setRefundTarget(tx); setRefundAmount(''); }}>
                    <RefreshCw className="h-3 w-3 mr-1" />{t('refund')}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {transactions.length === 0 && !isPending && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t('noTransactions')}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => load(transactions[transactions.length - 1]?.id)} disabled={isPending}>
            {t('loadMore')}
          </Button>
        </div>
      )}

      {/* Refund Dialog */}
      <Dialog open={!!refundTarget} onOpenChange={(open) => !open && setRefundTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('refundTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('refundConfirm', { email: refundTarget?.customerEmail ?? '—', amount: refundTarget?.amount.toFixed(2) ?? '0' })}
            </p>
            <div className="space-y-2">
              <Label>{t('refundAmountLabel')}</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={t('refundAmountPlaceholder', { max: refundTarget?.amount.toFixed(2) ?? '0' })}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('refundAmountHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)}>{t('cancel')}</Button>
            <Button variant="destructive" onClick={handleRefund} disabled={refundLoading}>
              {refundLoading ? '...' : t('refundConfirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Failed Payments Tab ──────────────────────────────────────────────────────

function FailedTab({ token }: { token: string }) {
  const t = useTranslations('admin.payments');
  const [payments, setPayments] = useState<FailedPayment[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await api.stripeAdmin.listFailedPayments(token);
        setPayments(res.payments);
      } catch { /* ignore */ }
    });
  }, []);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('colDate')}</TableHead>
          <TableHead>{t('colCustomer')}</TableHead>
          <TableHead>{t('colAmount')}</TableHead>
          <TableHead>{t('colReason')}</TableHead>
          <TableHead>{t('colDaysPastDue')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="text-sm">{new Date(p.created).toLocaleString('pl-PL')}</TableCell>
            <TableCell className="text-sm">{p.customerEmail || '—'}</TableCell>
            <TableCell className="font-medium">{p.amount.toFixed(2)} PLN</TableCell>
            <TableCell className="text-sm text-muted-foreground">{p.failureMessage || '—'}</TableCell>
            <TableCell>
              <Badge variant={p.daysPastDue > 7 ? 'destructive' : 'secondary'}>{p.daysPastDue}d</Badge>
            </TableCell>
          </TableRow>
        ))}
        {payments.length === 0 && !isPending && (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t('noFailedPayments')}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

// ── Coupons Tab ──────────────────────────────────────────────────────────────

function CouponsTab({ token }: { token: string }) {
  const t = useTranslations('admin.payments');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Create coupon form state
  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [duration, setDuration] = useState<'once' | 'repeating' | 'forever'>('once');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  function load() {
    startTransition(async () => {
      try {
        const res = await api.stripeAdmin.listCoupons(token);
        setCoupons(res.coupons);
      } catch { /* ignore */ }
    });
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setCreateLoading(true);
    try {
      const params: Parameters<typeof api.stripeAdmin.createCoupon>[0] = {
        name,
        duration,
      };
      if (discountType === 'percent') params.percentOff = parseFloat(discountValue);
      else params.amountOff = parseFloat(discountValue);
      if (maxRedemptions) params.maxRedemptions = parseInt(maxRedemptions, 10);

      await api.stripeAdmin.createCoupon(params, token);
      setShowCreate(false);
      setName(''); setDiscountValue(''); setMaxRedemptions('');
      load();
    } catch { /* ignore */ }
    setCreateLoading(false);
  }

  async function handleDelete(id: string) {
    try {
      await api.stripeAdmin.deleteCoupon(id, token);
      load();
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{t('couponsCount', { count: coupons.length })}</span>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />{t('createCoupon')}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('colName')}</TableHead>
            <TableHead>{t('colDiscount')}</TableHead>
            <TableHead>{t('colDuration')}</TableHead>
            <TableHead>{t('colUsage')}</TableHead>
            <TableHead>{t('colValid')}</TableHead>
            <TableHead>{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coupons.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name || c.id}</TableCell>
              <TableCell>
                {c.percentOff ? `${c.percentOff}%` : c.amountOff ? `${c.amountOff.toFixed(2)} PLN` : '—'}
              </TableCell>
              <TableCell className="text-sm">
                {c.duration === 'once' ? t('durationOnce') : c.duration === 'forever' ? t('durationForever') : `${c.durationInMonths}m`}
              </TableCell>
              <TableCell className="text-sm">
                {c.timesRedeemed}{c.maxRedemptions ? `/${c.maxRedemptions}` : ''}
              </TableCell>
              <TableCell>
                <Badge variant={c.valid ? 'default' : 'secondary'}>{c.valid ? t('active') : t('expired')}</Badge>
              </TableCell>
              <TableCell>
                {c.valid && (
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {coupons.length === 0 && !isPending && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t('noCoupons')}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Create Coupon Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createCoupon')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('couponName')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('couponNamePlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('couponType')}</Label>
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percent' | 'amount')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">{t('couponPercent')}</SelectItem>
                    <SelectItem value="amount">{t('couponAmount')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('couponValue')}</Label>
                <Input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === 'percent' ? '20' : '50.00'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('couponDuration')}</Label>
                <Select value={duration} onValueChange={(v) => setDuration(v as 'once' | 'repeating' | 'forever')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">{t('durationOnce')}</SelectItem>
                    <SelectItem value="repeating">{t('durationRepeating')}</SelectItem>
                    <SelectItem value="forever">{t('durationForever')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('couponMaxRedemptions')}</Label>
                <Input type="number" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder={t('unlimited')} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('cancel')}</Button>
            <Button onClick={handleCreate} disabled={createLoading || !name || !discountValue}>
              {createLoading ? '...' : t('createCouponButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
