import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, MonitorSmartphone, UserX, FileWarning } from 'lucide-react';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

interface SecurityStats {
  failedLogins24h: number;
  lockedAccounts: number;
  suspiciousDevices: number;
  recentRegistrations24h: number;
}

interface SecurityAlert {
  type: string;
  severity: 'critical' | 'high' | 'moderate' | 'info';
  count: number;
  details: Array<{ label: string; value: string }>;
}

interface SuspiciousActivity {
  id: string;
  action: string;
  userId: string | null;
  ip: string | null;
  metadata: unknown;
  createdAt: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-red-300 bg-red-50',
  high: 'border-orange-300 bg-orange-50',
  moderate: 'border-amber-200 bg-amber-50',
  info: 'border-blue-200 bg-blue-50',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  moderate: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-800',
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN_FAILED: 'Nieudane logowanie',
  ACCOUNT_LOCKED: 'Zablokowane konto',
  PDF_LIMIT_EXCEEDED: 'Limit PDF',
  IP_ABUSE: 'Nadużycie IP',
  DEVICE_ABUSE: 'Nadużycie urządzenia',
  DISPOSABLE_EMAIL: 'Jednorazowy email',
};

async function fetchJson<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function SecurityMonitoringPage() {
  const session = await auth();
  const t = await getTranslations('admin');
  const token = await getBackendToken() ?? '';

  const [statsRes, alertsRes, activityRes] = await Promise.all([
    fetchJson<{ ok: boolean } & SecurityStats>('/admin/security/stats', token),
    fetchJson<{ ok: boolean; alerts: SecurityAlert[] }>('/admin/security/alerts', token),
    fetchJson<{ ok: boolean; activities: SuspiciousActivity[] }>('/admin/security/recent', token),
  ]);

  const stats: SecurityStats = {
    failedLogins24h: statsRes?.failedLogins24h ?? 0,
    lockedAccounts: statsRes?.lockedAccounts ?? 0,
    suspiciousDevices: statsRes?.suspiciousDevices ?? 0,
    recentRegistrations24h: statsRes?.recentRegistrations24h ?? 0,
  };
  const alerts = alertsRes?.alerts ?? [];
  const activities = activityRes?.activities ?? [];

  const statCards = [
    { label: 'Nieudane logowania (24h)', value: stats.failedLogins24h, icon: UserX, color: 'text-red-600 bg-red-50' },
    { label: 'Zablokowane konta', value: stats.lockedAccounts, icon: Shield, color: 'text-orange-600 bg-orange-50' },
    { label: 'Podejrzane urządzenia', value: stats.suspiciousDevices, icon: MonitorSmartphone, color: 'text-amber-600 bg-amber-50' },
    { label: 'Rejestracje (24h)', value: stats.recentRegistrations24h, icon: FileWarning, color: 'text-blue-600 bg-blue-50' },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-sage-600" />
          {t('security.title')}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('security.subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border">
            <CardContent className="flex items-center gap-4 py-5">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            {t('security.alerts')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {alerts.map((alert, i) => (
              <Card key={i} className={`border ${SEVERITY_STYLES[alert.severity] ?? ''}`}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{alert.type.replace(/_/g, ' ')}</span>
                    <Badge className={`text-xs pointer-events-none ${SEVERITY_BADGE[alert.severity] ?? ''}`}>
                      {alert.count}
                    </Badge>
                  </div>
                  {alert.details.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {alert.details.slice(0, 5).map((d, j) => (
                        <li key={j}>{d.label}: <span className="font-medium">{d.value}</span></li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity log */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t('security.recentActivity')}</h2>
        {activities.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {t('security.noActivity')}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Akcja</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">IP</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="text-xs">
                          {ACTION_LABELS[a.action] ?? a.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground font-mono">
                        {a.ip ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString('pl-PL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
