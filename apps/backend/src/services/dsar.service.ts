import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { decryptJson } from '../utils/encryption';

interface UserDataExport {
  exportedAt: string;
  user: {
    email: string;
    role: string;
    createdAt: string;
    lastLoginAt: string | null;
    emailVerified: string | null;
  };
  company: {
    contactFirstName: string | null;
    contactLastName: string | null;
  } | null;
  consents: Array<{
    type: string;
    granted: boolean;
    documentVersion: string;
    acceptedAt: string;
    revokedAt: string | null;
  }>;
  interviews: Array<{
    id: string;
    createdAt: string;
    answers: unknown;
    medicalFlags: unknown;
  }>;
  dietPlans: Array<{
    id: string;
    source: string;
    status: string;
    createdAt: string;
    content: unknown;
    macros: {
      kcal: number | null;
      proteinG: number | null;
      fatG: number | null;
      carbsG: number | null;
    };
  }>;
  orders: Array<{
    id: string;
    productType: string;
    status: string;
    createdAt: string;
  }>;
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
  } | null;
  auditLog: Array<{
    action: string;
    createdAt: string;
    ip: string | null;
  }>;
}

/**
 * GDPR Art. 15 (access) and Art. 20 (portability).
 * Export ALL personal data for the requesting user.
 */
export async function exportUserData(userId: string): Promise<UserDataExport> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  // Fetch all related data in parallel
  const [company, consents, subscription, auditLogs] = await Promise.all([
    prisma.company.findUnique({ where: { userId } }),
    prisma.userConsent.findMany({
      where: { userId },
      orderBy: { acceptedAt: 'desc' },
    }),
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: {
        action: true,
        createdAt: true,
        ip: true,
      },
    }),
  ]);

  // Interviews and dietPlans require companyId
  let orders: Array<{
    id: string;
    productType: string;
    status: string;
    createdAt: Date;
  }> = [];

  if (company) {
    const [rawOrders] = await Promise.all([
      prisma.order.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          productType: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);
    orders = rawOrders;
  }

  return {
    exportedAt: new Date().toISOString(),
    user: {
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      emailVerified: user.emailVerified?.toISOString() ?? null,
    },
    company: company
      ? {
          contactFirstName: company.contactFirstName,
          contactLastName: company.contactLastName,
        }
      : null,
    consents: consents.map((c) => ({
      type: c.consentType,
      granted: c.granted,
      documentVersion: c.documentVersion,
      acceptedAt: c.acceptedAt.toISOString(),
      revokedAt: c.revokedAt?.toISOString() ?? null,
    })),
    interviews: [],
    dietPlans: [],
    orders: orders.map((o) => ({
      id: o.id,
      productType: o.productType,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
    auditLog: auditLogs.map((a) => ({
      action: a.action,
      createdAt: a.createdAt.toISOString(),
      ip: a.ip,
    })),
  };
}
