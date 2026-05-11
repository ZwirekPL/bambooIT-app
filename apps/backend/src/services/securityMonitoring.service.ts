/**
 * 39.7 — Security Monitoring Service.
 *
 * Aggregates suspicious activity signals for the admin dashboard:
 * - Failed login attempts (from AuditLog)
 * - Account lockouts (from Redis)
 * - IP clustering abuse (from Redis)
 * - Device fingerprint sharing (from DeviceFingerprint)
 * - PDF export rate limit hits
 */

import { prisma } from '@db';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SecurityAlert {
  type: 'failed_logins' | 'locked_accounts' | 'ip_cluster' | 'device_sharing' | 'pdf_abuse';
  severity: 'critical' | 'high' | 'moderate' | 'info';
  count: number;
  details: Array<{
    label: string;
    value: string;
    link?: string;
  }>;
}

export interface SecurityStats {
  failedLogins24h: number;
  lockedAccounts: number;
  suspiciousDevices: number;
  recentRegistrations24h: number;
}

// ─── Main functions ─────────────────────────────────────────────────────────

/**
 * Get security statistics for admin dashboard.
 */
export async function getSecurityStats(): Promise<SecurityStats> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [failedLogins, lockedAccounts, suspiciousDevices, recentRegistrations] = await Promise.all([
    // Failed logins in last 24h
    prisma.auditLog.count({
      where: {
        action: 'LOGIN_FAILED',
        createdAt: { gte: yesterday },
      },
    }).catch(() => 0),

    // Users with locked accounts (progressive lockout)
    prisma.auditLog.count({
      where: {
        action: 'ACCOUNT_LOCKED',
        createdAt: { gte: yesterday },
      },
    }).catch(() => 0),

    // Devices shared by 3+ accounts
    prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) as cnt FROM (
        SELECT fingerprint
        FROM "DeviceFingerprint"
        GROUP BY fingerprint
        HAVING COUNT(DISTINCT "userId") >= 3
      ) sub
    `.then((r) => Number(r[0]?.cnt ?? 0)).catch(() => 0),

    // Registrations in last 24h
    prisma.user.count({
      where: {
        createdAt: { gte: yesterday },
      },
    }).catch(() => 0),
  ]);

  return {
    failedLogins24h: failedLogins,
    lockedAccounts,
    suspiciousDevices,
    recentRegistrations24h: recentRegistrations,
  };
}

/**
 * Get detailed security alerts for admin dashboard.
 */
export async function getSecurityAlerts(): Promise<SecurityAlert[]> {
  const alerts: SecurityAlert[] = [];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 1. Failed logins — group by IP/email
  const failedLoginsByEmail = await prisma.auditLog.groupBy({
    by: ['metadata'],
    where: {
      action: 'LOGIN_FAILED',
      createdAt: { gte: yesterday },
    },
    _count: true,
    orderBy: { _count: { metadata: 'desc' } },
    take: 10,
  }).catch(() => []);

  // Count total
  const totalFailed = failedLoginsByEmail.reduce((sum, r) => sum + (r._count ?? 0), 0);
  if (totalFailed > 10) {
    alerts.push({
      type: 'failed_logins',
      severity: totalFailed > 50 ? 'high' : 'moderate',
      count: totalFailed,
      details: [{ label: 'Nieudane logowania (24h)', value: `${totalFailed}` }],
    });
  }

  // 2. Device sharing (3+ accounts per device)
  const sharedDevices = await prisma.$queryRaw<Array<{ fingerprint: string; user_count: bigint }>>`
    SELECT fingerprint, COUNT(DISTINCT "userId") as user_count
    FROM "DeviceFingerprint"
    GROUP BY fingerprint
    HAVING COUNT(DISTINCT "userId") >= 3
    ORDER BY user_count DESC
    LIMIT 10
  `.catch(() => []);

  if (sharedDevices.length > 0) {
    alerts.push({
      type: 'device_sharing',
      severity: 'high',
      count: sharedDevices.length,
      details: sharedDevices.map((d) => ({
        label: `Urządzenie ${d.fingerprint.slice(0, 8)}...`,
        value: `${Number(d.user_count)} kont`,
      })),
    });
  }

  // 3. Recent registrations spike
  const recentRegs = await prisma.user.count({
    where: { createdAt: { gte: yesterday } },
  }).catch(() => 0);

  if (recentRegs > 20) {
    alerts.push({
      type: 'ip_cluster',
      severity: recentRegs > 50 ? 'high' : 'moderate',
      count: recentRegs,
      details: [{ label: 'Rejestracje w 24h', value: `${recentRegs}` }],
    });
  }

  // Sort by severity
  const order: Record<string, number> = { critical: 0, high: 1, moderate: 2, info: 3 };
  alerts.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

  return alerts;
}

/**
 * Get recent suspicious activities (audit log entries).
 */
export async function getRecentSuspiciousActivity(limit = 20) {
  return prisma.auditLog.findMany({
    where: {
      action: {
        in: ['LOGIN_FAILED', 'ACCOUNT_LOCKED', 'PDF_LIMIT_EXCEEDED', 'IP_ABUSE', 'DEVICE_ABUSE', 'DISPOSABLE_EMAIL'],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      action: true,
      userId: true,
      ip: true,
      metadata: true,
      createdAt: true,
    },
  });
}
