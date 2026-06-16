import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Banknote, Repeat, Building2, Inbox, UserMinus, MessageSquareQuote, ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getBackendToken } from '@/lib/server-token';
import { api } from '@/lib/api';
import { LeadStatusBadge } from '@/components/admin/leads/LeadStatusBadge';
import type { AdminStats, SubscriptionStats, LeadsStats, Lead } from '@/types/api';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.dashboard');
  return {
    title: `${t('title')} — Admin`,
    robots: { index: false, follow: false },
  };
}

const plNumber = (n: number) => new Intl.NumberFormat('pl-PL').format(n);

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-bamboo-deep" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight text-navy-deep">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const t = await getTranslations('admin.dashboard');
  const token = (await getBackendToken()) ?? '';

  const defaultAdmin: AdminStats = { users: { total: 0, active: 0, deleted: 0 }, clients: 0 };
  const defaultSubs: SubscriptionStats = {
    mrr: 0,
    activeSubscriptions: { total: 0, start: 0, firma: 0, firmaPlus: 0 },
    trials: { active: 0, expired: 0 },
    churnRate: 0,
  };
  const defaultLeads: LeadsStats = {
    total: 0,
    byStatus: { NEW: 0, CONTACTED: 0, QUALIFIED: 0, CONVERTED: 0, REJECTED: 0 },
    byType: { AUDIT: 0, CONTACT: 0 },
    last7Days: 0,
  };

  // Each widget degrades independently — a single failing endpoint must not
  // blank the whole dashboard. allSettled + per-result fallback.
  const [adminRes, subsRes, leadsRes, actionRes, recentRes] = await Promise.allSettled([
    api.admin.getStats(token),
    api.admin.getSubscriptionStats(token),
    api.admin.leads.getStats(token),
    api.admin.getActionItems(token),
    api.admin.leads.list({ page: 1, pageSize: 5 }, token),
  ]);

  const hadError = [adminRes, subsRes, leadsRes, actionRes, recentRes].some(
    (r) => r.status === 'rejected',
  );

  const adminStats = adminRes.status === 'fulfilled' ? adminRes.value.stats : defaultAdmin;
  const subs = subsRes.status === 'fulfilled' ? subsRes.value.stats : defaultSubs;
  const leads = leadsRes.status === 'fulfilled' ? leadsRes.value.stats : defaultLeads;
  const pendingTestimonials =
    actionRes.status === 'fulfilled' ? actionRes.value.pendingTestimonials : 0;
  const lockedAccounts = actionRes.status === 'fulfilled' ? actionRes.value.lockedAccounts : 0;
  const recentLeads: Lead[] = recentRes.status === 'fulfilled' ? recentRes.value.leads : [];

  const hasActionItems = pendingTestimonials > 0 || lockedAccounts > 0;

  const leadName = (lead: Lead) => {
    const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim();
    return name || lead.company || t('anonLead');
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {hadError && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {t('loadError')}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label={t('mrr')}
          value={`${plNumber(subs.mrr)} ${t('mrrUnit')}`}
          icon={Banknote}
        />
        <StatCard
          label={t('activeSubs')}
          value={plNumber(subs.activeSubscriptions.total)}
          hint={t('subsBreakdown', {
            start: subs.activeSubscriptions.start,
            firma: subs.activeSubscriptions.firma,
            plus: subs.activeSubscriptions.firmaPlus,
          })}
          icon={Repeat}
        />
        <StatCard
          label={t('clients')}
          value={plNumber(adminStats.clients)}
          hint={t('clientsHint', { active: adminStats.users.active })}
          icon={Building2}
        />
        <StatCard
          label={t('leads')}
          value={plNumber(leads.total)}
          hint={t('leadsHint', { newCount: leads.byStatus.NEW, last7: leads.last7Days })}
          icon={Inbox}
        />
        <StatCard
          label={t('churn')}
          value={`${subs.churnRate}%`}
          hint={t('churnHint')}
          icon={UserMinus}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent leads */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('recentLeads')}</CardTitle>
            <Link
              href="/admin/leady"
              className="inline-flex items-center gap-1 text-sm font-medium text-bamboo-deep hover:underline"
            >
              {t('viewAllLeads')}
            </Link>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('noLeads')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {recentLeads.map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/admin/leady/${lead.id}`}
                      className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-paper/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-navy-deep">
                          {leadName(lead)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{lead.email}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <LeadStatusBadge status={lead.status} />
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Action items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('actionItems')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!hasActionItems ? (
              <p className="py-2 text-sm text-muted-foreground">{t('allClear')}</p>
            ) : (
              <>
                {pendingTestimonials > 0 && (
                  <Link
                    href="/admin/opinie"
                    className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-bamboo-deep"
                  >
                    <span className="flex items-center gap-2 text-sm text-navy-deep">
                      <MessageSquareQuote className="h-4 w-4 text-bamboo-deep" />
                      {t('pendingTestimonials')}
                    </span>
                    <span className="font-bold text-navy-deep">{pendingTestimonials}</span>
                  </Link>
                )}
                {lockedAccounts > 0 && (
                  <Link
                    href="/admin/bezpieczenstwo"
                    className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-bamboo-deep"
                  >
                    <span className="flex items-center gap-2 text-sm text-navy-deep">
                      <ShieldAlert className="h-4 w-4 text-amber-600" />
                      {t('lockedAccounts')}
                    </span>
                    <span className="font-bold text-navy-deep">{lockedAccounts}</span>
                  </Link>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
