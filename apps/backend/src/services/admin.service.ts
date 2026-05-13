import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';
import { sendEmailVerificationEmail } from '../utils/email';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export type UserRole = 'ADMIN' | 'CLIENT';

export type UserSortBy = 'email' | 'createdAt' | 'lastLoginAt' | 'role';
export type SortOrder = 'asc' | 'desc';

export interface ListUsersOptions {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
  excludeRole?: UserRole;
  hideDeleted?: boolean;
  inactiveMonths?: number;
  sortBy?: UserSortBy;
  sortOrder?: SortOrder;
  createdFrom?: string;
  createdTo?: string;
  subscriptionStatus?: string;
}

export async function listUsers({ page, limit, search, role, excludeRole, hideDeleted, inactiveMonths, sortBy, sortOrder, createdFrom, createdTo, subscriptionStatus }: ListUsersOptions) {
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(excludeRole && !role ? { role: { not: excludeRole } } : {}),
    ...(search ? { email: { contains: search, mode: 'insensitive' } } : {}),
    ...(hideDeleted ? { deletedAt: null } : {}),
    ...(inactiveMonths ? {
      OR: [
        { lastLoginAt: null },
        { lastLoginAt: { lt: new Date(Date.now() - inactiveMonths * 30 * 24 * 60 * 60 * 1000) } },
      ],
    } : {}),
  };

  // Date range filter for createdAt
  if (createdFrom || createdTo) {
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (createdFrom) createdAtFilter.gte = new Date(createdFrom);
    if (createdTo) createdAtFilter.lte = new Date(createdTo);
    where.createdAt = createdAtFilter;
  }

  // Subscription status filter
  if (subscriptionStatus) {
    if (subscriptionStatus === 'NONE') {
      where.subscription = { is: null };
    } else if (subscriptionStatus === 'ONE_TIME') {
      where.company = { orders: { some: { status: { in: ['PAID', 'ACTIVE'] } } } };
    } else {
      where.subscription = { status: subscriptionStatus as Prisma.EnumSubscriptionStatusFilter };
    }
  }

  const orderField = sortBy ?? 'createdAt';
  const orderDir = sortOrder ?? 'desc';

  const [rawUsers, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [orderField]: orderDir },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        lastLoginAt: true,
        grantedAccessUntil: true,
        createdAt: true,
        deletedAt: true,
        subscription: {
          select: { status: true, plan: true, currentPeriodEnd: true },
        },
        company: {
          select: {
            orders: {
              where: { status: { in: ['PAID', 'ACTIVE'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { productType: true, status: true, createdAt: true },
            },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const users = rawUsers.map((u) => {
    const sub = u.subscription;
    const latestOrder = u.company?.orders?.[0];

    let subscriptionStatus: string = 'NONE';
    let subscriptionProductType: string | null = null;
    let subscriptionExpiresAt: Date | null = null;

    if (sub) {
      subscriptionStatus = sub.status;
      subscriptionProductType = sub.plan;
      subscriptionExpiresAt = sub.currentPeriodEnd;
    } else if (latestOrder) {
      subscriptionStatus = 'ONE_TIME';
      subscriptionProductType = latestOrder.productType;
    }

    return {
      id: u.id,
      email: u.email,
      role: u.role,
      emailVerified: u.emailVerified,
      lastLoginAt: u.lastLoginAt,
      grantedAccessUntil: u.grantedAccessUntil,
      createdAt: u.createdAt,
      deletedAt: u.deletedAt,
      subscriptionStatus,
      subscriptionProductType,
      subscriptionExpiresAt,
    };
  });

  return { users, total, page, limit };
}

export async function getStats() {
  const [
    totalUsers,
    activeUsers,
    totalCompanies,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.company.count(),
  ]);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      deleted: totalUsers - activeUsers,
    },
    clients: totalCompanies,
  };
}

export async function getActionItems() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    pendingTestimonials,
    lockedAccounts,
  ] = await Promise.all([
    prisma.testimonial.count({ where: { status: 'PENDING' } }),
    prisma.auditLog.count({
      where: { action: 'ACCOUNT_LOCKED', createdAt: { gte: yesterday } },
    }).catch(() => 0),
  ]);

  return {
    pendingTestimonials,
    lockedAccounts,
  };
}

export interface CreateUserInput {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

export async function createUser({ email, password, firstName, lastName }: CreateUserInput) {
  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered');
  }

  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
  const user = await prisma.user.create({
    data: { email, passwordHash, role: 'CLIENT', emailVerified: new Date() },
  });

  await prisma.company.create({
    data: { userId: user.id, contactFirstName: firstName, contactLastName: lastName },
  });

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    firstName: firstName ?? null,
    lastName: lastName ?? null,
  };
}

export async function changeUserRole(id: string, role: UserRole) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, email: true, role: true },
  });

  return updated;
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
      lastLoginAt: true,
      grantedAccessUntil: true,
      createdAt: true,
      deletedAt: true,
      company: {
        select: {
          contactFirstName: true,
          contactLastName: true,
        },
      },
    },
  });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }
  return user;
}

export async function softDeleteUser(id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found or already deleted');
  }

  return prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: { id: true, email: true, deletedAt: true },
  });
}

export async function restoreUser(id: string) {
  const user = await prisma.user.findFirst({ where: { id } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }
  if (!user.deletedAt) {
    throw new AppError(409, 'NOT_DELETED', 'User is not deleted');
  }

  return prisma.user.update({
    where: { id },
    data: { deletedAt: null },
    select: { id: true, email: true, deletedAt: true },
  });
}

export interface ListAuditLogsOptions {
  page: number;
  limit: number;
  search?: string;
  action?: string;
  resourceType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function listAuditLogs({
  page,
  limit,
  search,
  action,
  resourceType,
  dateFrom,
  dateTo,
}: ListAuditLogsOptions) {
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {
    ...(search ? { user: { email: { contains: search, mode: 'insensitive' } } } : {}),
    ...(action ? { action } : {}),
    ...(resourceType ? { resourceType } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  };

  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, limit };
}

export async function getAuditLogStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

  const [totalToday, totalThisWeek, totalAll, topActions, topUsers] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.auditLog.count(),
    prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: weekStart } },
      _count: true,
      orderBy: { _count: { action: 'desc' } },
      take: 5,
    }),
    prisma.auditLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: weekStart }, userId: { not: null } },
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      take: 5,
    }),
  ]);

  // Resolve user emails for top users
  const userIds = topUsers.map((u) => u.userId).filter(Boolean) as string[];
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.email]));

  return {
    totalToday,
    totalThisWeek,
    totalAll,
    topActions: topActions.map((a) => ({ action: a.action, count: a._count })),
    topUsers: topUsers.map((u) => ({ userId: u.userId, email: userMap.get(u.userId!) ?? '—', count: u._count })),
  };
}

export async function exportAuditLogsCsv(
  filters: Omit<ListAuditLogsOptions, 'page' | 'limit'>
) {
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.search ? { user: { email: { contains: filters.search, mode: 'insensitive' } } } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.resourceType ? { resourceType: filters.resourceType } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
          },
        }
      : {}),
  };

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10_000,
    include: { user: { select: { email: true } } },
  });

  const header = 'id,timestamp,user_email,action,resource_type,resource_id,ip';
  const rows = logs.map((l) => {
    const cols = [
      l.id,
      l.createdAt.toISOString(),
      l.user?.email ?? '',
      l.action,
      l.resourceType ?? '',
      l.resourceId ?? '',
      l.ip ?? '',
    ];
    return cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
  });

  return [header, ...rows].join('\n');
}

export async function verifyUserEmail(userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }
  if (user.emailVerified) {
    throw new AppError(409, 'ALREADY_VERIFIED', 'Email is already verified');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
    select: { id: true, email: true, emailVerified: true },
  });

  // Invalidate any pending verification tokens
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  return updated;
}

export async function resendVerificationEmail(userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }
  if (user.emailVerified) {
    throw new AppError(409, 'ALREADY_VERIFIED', 'Email is already verified');
  }

  // Invalidate all previous tokens
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  const verifyUrl = `${process.env.APP_URL}/pl/zweryfikuj-email?token=${rawToken}`;
  await sendEmailVerificationEmail(user.email, verifyUrl);

  return { id: user.id, email: user.email };
}
