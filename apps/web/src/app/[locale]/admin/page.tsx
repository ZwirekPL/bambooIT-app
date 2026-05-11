import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import {
  Users,
  UserRound,
  UserCog,
  ClipboardList,
  Leaf,
  UserX,
  CheckCircle2,
  Sparkles,
  Database,
  Gift,
  ChefHat,
  AlertTriangle,
  MessageSquare,
  Phone,
  ShieldAlert,
  CircleCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { AdminStats, DietCacheStats } from '@/types/api';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('title') };
}

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: number;
  sublabel?: string;
  icon: React.ElementType;
  iconClass: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          {sublabel && <p className="text-xs text-muted-foreground/70">{sublabel}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function PlanStatusRow({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${colorClass}`} />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export default async function AdminPage() {
  const session = await auth();
  const t = await getTranslations('admin');
  const ts = await getTranslations('admin.stats');

  const token = await getBackendToken() ?? '';
  const displayName = session?.user?.name ?? session?.user?.email ?? '';

  const defaultStats: AdminStats = {
    users: { total: 0, active: 0, deleted: 0 },
    dietitians: 0,
    patients: 0,
    interviews: 0,
    dietPlans: { total: 0, byStatus: { GENERATED: 0, REVIEWED: 0, SENT: 0 } },
  };

  let stats = defaultStats;
  let cacheStats: DietCacheStats | null = null;
  let referralStats: {
    totalCodes: number;
    totalUsages: number;
    totalRedeemed: number;
    conversionRate: number;
    topReferrers: Array<{ userId: string; email: string; code: string; usageCount: number }>;
  } | null = null;
  let actionItems = { pendingTestimonials: 0, pendingConsultations: 0, recipesNeedingWork: 0, lockedAccounts: 0 };
  let securityStats = { failedLogins24h: 0, lockedAccounts: 0, suspiciousDevices: 0 };
  try {
    const [statsRes, cacheRes, referralRes, actionItemsRes, securityRes] = await Promise.all([
      api.admin.getStats(token),
      api.admin.getDietCacheStats(token).catch(() => null),
      api.referrals.getAdminStats(token).catch(() => null),
      api.admin.getActionItems(token).catch(() => null),
      api.admin.getSecurityStats(token).catch(() => null),
    ]);
    stats = statsRes.stats;
    cacheStats = cacheRes;
    referralStats = referralRes?.stats ?? null;
    if (actionItemsRes) {
      actionItems = {
        pendingTestimonials: actionItemsRes.pendingTestimonials,
        pendingConsultations: actionItemsRes.pendingConsultations,
        recipesNeedingWork: actionItemsRes.recipesNeedingWork,
        lockedAccounts: actionItemsRes.lockedAccounts,
      };
    }
    if (securityRes) {
      securityStats = {
        failedLogins24h: securityRes.failedLogins24h,
        lockedAccounts: securityRes.lockedAccounts,
        suspiciousDevices: securityRes.suspiciousDevices,
      };
    }
  } catch {
    // show zeroed stats on error
  }

  const mainCards: Array<{
    label: string;
    value: number;
    sublabel?: string;
    icon: React.ElementType;
    iconClass: string;
  }> = [
    {
      label: ts('usersActive'),
      sublabel: `${ts('usersTotal')}: ${stats.users.total}`,
      value: stats.users.active,
      icon: Users,
      iconClass: 'bg-sage-50 text-sage-600',
    },
    {
      label: ts('patients'),
      value: stats.patients,
      icon: UserRound,
      iconClass: 'bg-teal-50 text-teal-600',
    },
    {
      label: ts('interviews'),
      value: stats.interviews,
      icon: ClipboardList,
      iconClass: 'bg-amber-50 text-amber-600',
    },
    {
      label: ts('dietPlansTotal'),
      value: stats.dietPlans.total,
      icon: Leaf,
      iconClass: 'bg-violet-50 text-violet-600',
    },
    {
      label: ts('dietitians'),
      value: stats.dietitians,
      icon: UserCog,
      iconClass: 'bg-blue-50 text-blue-600',
    },
    {
      label: ts('usersDeleted'),
      value: stats.users.deleted,
      icon: UserX,
      iconClass: 'bg-red-50 text-red-500',
    },
  ];

  const planStatusRows = [
    { label: ts('statusGenerated'), value: stats.dietPlans.byStatus.GENERATED, colorClass: 'bg-amber-400' },
    { label: ts('statusReviewed'),  value: stats.dietPlans.byStatus.REVIEWED,  colorClass: 'bg-blue-400'  },
    { label: ts('statusSent'),      value: stats.dietPlans.byStatus.SENT,       colorClass: 'bg-teal-400'  },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('greeting', { name: displayName })}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('greetingSubtitle')}</p>
      </div>

      {/* Main stats */}
      <div>
        <h2 className="text-base font-semibold mb-4">{ts('title')}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {mainCards.map(({ label, value, sublabel, icon, iconClass }) => (
            <StatCard
              key={label}
              label={label}
              value={value}
              sublabel={sublabel}
              icon={icon}
              iconClass={iconClass}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        {/* Plan status breakdown */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              {ts('plansByStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {planStatusRows.map(({ label, value, colorClass }) => (
              <PlanStatusRow key={label} label={label} value={value} colorClass={colorClass} />
            ))}
            <div className="flex items-center justify-between pt-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-sage-500" />
                <span className="text-sm font-medium">{ts('dietPlansTotal')}</span>
              </div>
              <span className="text-sm font-bold tabular-nums">{stats.dietPlans.total}</span>
            </div>
          </CardContent>
        </Card>

        {/* Diet cache stats (17.2) */}
        {cacheStats && (
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-500" />
                {ts('cacheTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <PlanStatusRow
                label={ts('cacheTemplates')}
                value={cacheStats.activeTemplates}
                colorClass="bg-emerald-400"
              />
              <PlanStatusRow
                label={ts('cacheExactHits')}
                value={cacheStats.exactHits}
                colorClass="bg-green-400"
              />
              <PlanStatusRow
                label={ts('cacheSimilarHits')}
                value={cacheStats.similarHits}
                colorClass="bg-yellow-400"
              />
              <PlanStatusRow
                label={ts('cacheMisses')}
                value={cacheStats.misses}
                colorClass="bg-red-400"
              />
              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium">{ts('cacheHitRate')}</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{cacheStats.hitRate}%</span>
              </div>
              {cacheStats.estimatedSavingsUsd > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">{ts('cacheSavings')}</span>
                  <span className="text-xs font-semibold tabular-nums text-emerald-600">
                    ~${cacheStats.estimatedSavingsUsd.toFixed(2)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recipe quality widget (37.2.6) */}
        {stats.recipes && stats.recipes.total > 0 && (
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-orange-500" />
                {ts('recipesTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <PlanStatusRow
                label={ts('recipesTotal')}
                value={stats.recipes.total}
                colorClass="bg-orange-400"
              />
              <PlanStatusRow
                label={ts('recipesNeedingWork')}
                value={stats.recipes.needingWork}
                colorClass={stats.recipes.needingWork > 0 ? 'bg-red-400' : 'bg-green-400'}
              />
              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-2">
                  {stats.recipes.needingWork > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  <span className="text-sm font-medium">
                    {Math.round(((stats.recipes.total - stats.recipes.needingWork) / stats.recipes.total) * 100)}% {ts('recipesComplete')}
                  </span>
                </div>
              </div>
              {stats.recipes.needingWork > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <Link
                    href="/admin/przepisy"
                    className="text-xs text-primary hover:underline"
                  >
                    {ts('recipesViewNeedingWork')} →
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Security widget (54.1) */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className={`h-4 w-4 ${securityStats.failedLogins24h + securityStats.lockedAccounts + securityStats.suspiciousDevices > 0 ? securityStats.failedLogins24h + securityStats.lockedAccounts > 10 ? 'text-red-500' : 'text-amber-500' : 'text-green-500'}`} />
              {ts('securityTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <PlanStatusRow
              label={ts('securityFailedLogins')}
              value={securityStats.failedLogins24h}
              colorClass={securityStats.failedLogins24h > 10 ? 'bg-red-400' : securityStats.failedLogins24h > 0 ? 'bg-amber-400' : 'bg-green-400'}
            />
            <PlanStatusRow
              label={ts('securityLockedAccounts')}
              value={securityStats.lockedAccounts}
              colorClass={securityStats.lockedAccounts > 0 ? 'bg-red-400' : 'bg-green-400'}
            />
            <PlanStatusRow
              label={ts('securitySuspiciousDevices')}
              value={securityStats.suspiciousDevices}
              colorClass={securityStats.suspiciousDevices > 0 ? 'bg-amber-400' : 'bg-green-400'}
            />
            <div className="mt-2 pt-2 border-t border-border">
              <Link href="/admin/bezpieczenstwo" className="text-xs text-primary hover:underline">
                {ts('securityDetailsCta')} →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Testimonials widget (54.3) */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-amber-500" />
              {ts('testimonialsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm">{ts('testimonialsPending')}</span>
              <span className={`text-sm font-bold tabular-nums px-2 py-0.5 rounded-full ${actionItems.pendingTestimonials > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {actionItems.pendingTestimonials}
              </span>
            </div>
            {actionItems.pendingTestimonials > 0 && (
              <div className="mt-2 pt-2 border-t border-border">
                <Link href="/admin/opinie" className="text-xs text-primary hover:underline">
                  {ts('testimonialsModerateCta')} →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Consultations widget (54.2) */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-blue-500" />
              {ts('consultationsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm">{ts('consultationsPending')}</span>
              <span className={`text-sm font-bold tabular-nums px-2 py-0.5 rounded-full ${actionItems.pendingConsultations > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {actionItems.pendingConsultations}
              </span>
            </div>
            {actionItems.pendingConsultations > 0 && (
              <div className="mt-2 pt-2 border-t border-border">
                <Link href="/admin/konsultacje" className="text-xs text-primary hover:underline">
                  {ts('consultationsHandleCta')} →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Referral stats (21.1.6) */}
        {referralStats && (
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="h-4 w-4 text-pink-500" />
                {ts('referralTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <PlanStatusRow
                label={ts('referralCodes')}
                value={referralStats.totalCodes}
                colorClass="bg-pink-400"
              />
              <PlanStatusRow
                label={ts('referralUsages')}
                value={referralStats.totalUsages}
                colorClass="bg-purple-400"
              />
              <PlanStatusRow
                label={ts('referralRedeemed')}
                value={referralStats.totalRedeemed}
                colorClass="bg-green-400"
              />
              <div className="flex items-center justify-between pt-3">
                <span className="text-sm font-medium">{ts('referralConversion')}</span>
                <span className="text-sm font-bold tabular-nums">{referralStats.conversionRate}%</span>
              </div>
              {referralStats.topReferrers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{ts('referralTopReferrers')}</p>
                  {referralStats.topReferrers.slice(0, 5).map((r) => (
                    <div key={r.userId} className="flex items-center justify-between py-1">
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]">{r.email}</span>
                      <span className="text-xs font-semibold tabular-nums">{r.usageCount}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action items (54.5) */}
      {(() => {
        const items = [
          { label: ts('actionItemsPendingTestimonials'), count: actionItems.pendingTestimonials, href: '/admin/opinie', icon: MessageSquare, colorClass: 'text-amber-500' },
          { label: ts('actionItemsPendingConsultations'), count: actionItems.pendingConsultations, href: '/admin/konsultacje', icon: Phone, colorClass: 'text-blue-500' },
          { label: ts('actionItemsRecipesNeedingWork'), count: actionItems.recipesNeedingWork, href: '/admin/przepisy', icon: ChefHat, colorClass: 'text-orange-500' },
          { label: ts('actionItemsLockedAccounts'), count: actionItems.lockedAccounts, href: '/admin/bezpieczenstwo', icon: ShieldAlert, colorClass: 'text-red-500' },
        ].filter((item) => item.count > 0);

        return (
          <div>
            <h2 className="text-base font-semibold mb-4">{ts('actionItemsTitle')}</h2>
            {items.length === 0 ? (
              <Card className="border-border">
                <CardContent className="flex items-center gap-3 py-5">
                  <CircleCheck className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">{ts('actionItemsAllDone')}</span>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {items.map(({ label, count, href, icon: ItemIcon, colorClass }) => (
                  <Link key={href} href={href}>
                    <Card className="border-border hover:bg-muted/50 transition-colors cursor-pointer">
                      <CardContent className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <ItemIcon className={`h-4 w-4 ${colorClass}`} />
                          <span className="text-sm">{label}</span>
                        </div>
                        <span className="text-sm font-bold tabular-nums bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                          {count}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
