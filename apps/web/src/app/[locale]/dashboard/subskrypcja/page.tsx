import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type { Order, Subscription, SubscriptionStatus, OrderStatus, ProductType } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CreditCard, Package } from 'lucide-react';
import { PatientSubscriptionActions } from '@/components/dashboard/PatientSubscriptionActions';

const STATUS_BADGE: Record<SubscriptionStatus, string> = {
  TRIALING: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAST_DUE: 'bg-red-100 text-red-800',
  CANCELED: 'bg-muted text-muted-foreground',
  INCOMPLETE: 'bg-amber-100 text-amber-800',
};

const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-800',
  PAID: 'bg-green-100 text-green-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-red-100 text-red-800',
};

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const PRICE_MAP: Record<string, number> = {
  OPIEKA_MIESIECZNA: 129,
  OPIEKA_ROCZNA: 1188,
  PLAN_2W: 129,
  PLAN_4W: 199,
  CONSULTATION: 399,
  FREE_7: 0,
};

export default async function PatientSubscriptionPage() {
  const session = await auth();
  const t = await getTranslations('dashboard.subscription');
  const locale = await getLocale();
  const token = await getBackendToken() ?? '';

  let orders: Order[] = [];
  let subscription: Subscription | null = null;
  let stripeConfigured = false;

  try {
    const result = await api.orders.listMy(token);
    orders = result.orders;
    subscription = result.subscription;
    stripeConfigured = result.stripeConfigured;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // Patient profile not found — no orders
    }
  }

  const isActive =
    subscription?.status === 'ACTIVE' || subscription?.status === 'TRIALING';

  const renewLabel =
    subscription?.cancelAtPeriodEnd ? t('expiresAt') : t('renewsAt');

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {!stripeConfigured && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{t('mockWarning')}</span>
        </div>
      )}

      {/* Active subscription card */}
      {subscription && subscription.plan !== 'FREE' ? (
        <Card className="border-border" data-tour="pt-subscription-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-sage-600" />
              {t('currentPlan')}
              <Badge className={`pointer-events-none text-xs font-medium ${STATUS_BADGE[subscription.status]}`}>
                {t(`subscriptionStatuses.${subscription.status}`)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  {t('currentPlan')}
                </p>
                <p className="font-medium">{t(`plans.${subscription.plan}`)}</p>
              </div>

              {isActive && subscription.currentPeriodEnd && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    {renewLabel}
                  </p>
                  <p className="font-medium">
                    {formatDate(subscription.currentPeriodEnd, locale)}
                  </p>
                </div>
              )}
            </div>

            {subscription.cancelAtPeriodEnd && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {t('cancelAtPeriodEnd')}
              </p>
            )}

            <PatientSubscriptionActions
              cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
              subscriptionStatus={subscription.status}
              token={token}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">{t('noSubscription')}</p>
            <p className="text-xs text-muted-foreground">{t('noSubscriptionDesc')}</p>
            <Link
              href="/oferta"
              className="inline-flex items-center gap-2 text-sm font-medium text-sage-700 hover:underline"
            >
              {t('goToOffer')} →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Order history */}
      <Card className="border-border" data-tour="pt-orders-table">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-3">
            <Package className="h-5 w-5 text-sage-600" />
            {t('ordersTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t('noOrders')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="pb-2 pr-4">{t('orderDate')}</th>
                    <th className="pb-2 pr-4">{t('orderProduct')}</th>
                    <th className="pb-2 pr-4">{t('invoiceAmount')}</th>
                    <th className="pb-2">{t('orderStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {formatDate(order.createdAt, locale)}
                      </td>
                      <td className="py-3 pr-4">
                        {t(`products.${order.productType as ProductType}`)}
                      </td>
                      <td className="py-3 pr-4 font-medium">
                        {(PRICE_MAP[order.productType] ?? 0) > 0
                          ? `${PRICE_MAP[order.productType]} zł`
                          : '—'}
                      </td>
                      <td className="py-3">
                        <Badge
                          className={`pointer-events-none text-xs font-medium ${ORDER_STATUS_BADGE[order.status as OrderStatus]}`}
                        >
                          {t(`orderStatuses.${order.status as OrderStatus}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
