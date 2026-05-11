import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { AuditLogTable } from '@/components/admin/AuditLogTable';
import type { AuditLog } from '@/types/api';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.auditLog');
  return { title: t('title') };
}

const LIMIT = 25;

interface PageProps {
  searchParams: Promise<{
    search?: string;
    action?: string;
    resourceType?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}

export default async function AdminAuditLogPage({ searchParams }: PageProps) {
  const session = await auth();
  const t = await getTranslations('admin.auditLog');
  const params = await searchParams;

  const token = await getBackendToken() ?? '';

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const search = params.search ?? '';
  const action = params.action ?? '';
  const resourceType = params.resourceType ?? '';
  const dateFrom = params.dateFrom ? new Date(params.dateFrom).toISOString() : '';
  const dateTo = params.dateTo
    ? (() => {
        const d = new Date(params.dateTo!);
        d.setHours(23, 59, 59, 999);
        return d.toISOString();
      })()
    : '';

  let logs: AuditLog[] = [];
  let total = 0;
  let auditStats = { totalToday: 0, totalThisWeek: 0, totalAll: 0, topActions: [] as Array<{ action: string; count: number }>, topUsers: [] as Array<{ userId: string; email: string; count: number }> };

  try {
    const [logsRes, statsRes] = await Promise.all([
      api.admin.listAuditLogs(
        {
          page,
          limit: LIMIT,
          ...(search ? { search } : {}),
          ...(action ? { action } : {}),
          ...(resourceType ? { resourceType } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
        },
        token
      ),
      api.admin.getAuditLogStats(token).catch(() => null),
    ]);
    logs = logsRes.logs;
    total = logsRes.total;
    if (statsRes) auditStats = statsRes.stats;
  } catch {
    // show empty state on error
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Stats (51.5) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
        <Card className="border-border">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{auditStats.totalToday}</p>
            <p className="text-xs text-muted-foreground">{t('statsToday')}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{auditStats.totalThisWeek}</p>
            <p className="text-xs text-muted-foreground">{t('statsWeek')}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{auditStats.totalAll}</p>
            <p className="text-xs text-muted-foreground">{t('statsAll')}</p>
          </CardContent>
        </Card>
      </div>

      <AuditLogTable
        initialLogs={logs}
        initialTotal={total}
        initialPage={page}
        limit={LIMIT}
      />
    </div>
  );
}
