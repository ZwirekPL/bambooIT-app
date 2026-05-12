import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';
import { sendEmailVerificationEmail } from '../utils/email';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export type UserRole = 'ADMIN' | 'DIETITIAN' | 'PATIENT';

function generateDietitianCode(): string {
  // 8-char uppercase alphanumeric (no ambiguous I, O, 0, 1)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
}

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
      where.patient = { orders: { some: { status: { in: ['PAID', 'ACTIVE'] } } } };
    } else {
      where.subscription = { status: subscriptionStatus as Prisma.EnumSubscriptionStatusFilter, plan: { not: 'FREE' } };
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
        patient: {
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
    const latestOrder = u.patient?.orders?.[0];

    let subscriptionStatus: string = 'NONE';
    let subscriptionProductType: string | null = null;
    let subscriptionExpiresAt: Date | null = null;

    if (sub && sub.plan !== 'FREE') {
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

// TODO(5c-cleanup): Tenant model dropped per D-025 (bambooIT is B2B, not SaaS multi-tenant).
// All 5 service functions commented:
// - listTenants({ page, limit, search }): paginated list with owner + patients count
// - getTenantById(id): findUnique with owner + patients count
// - softDeleteTenant(id): set deletedAt
// - restoreTenant(id): clear deletedAt
// - updateTenantById(id, { name?, slug? }): update with slug uniqueness check
//
// export interface ListTenantsOptions {
//   page: number;
//   limit: number;
//   search?: string;
// }

export async function getStats() {
  const [
    totalUsers,
    activeUsers,
    totalDietitians,
    totalPatients,
    // TODO(5a-cleanup): totalRecipes, recipesNeedingWork dropped (prisma.recipe gone)
    // TODO(5b-cleanup): totalInterviews, totalDietPlans, plansGenerated/Reviewed/Sent dropped
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { role: 'DIETITIAN', deletedAt: null } }),
    prisma.patient.count(),
    // TODO(5b-cleanup): Interview + DietPlan dropped in K5b
    // prisma.interview.count(),
    // prisma.dietPlan.count(),
    // prisma.dietPlan.count({ where: { status: 'GENERATED' } }),
    // prisma.dietPlan.count({ where: { status: 'REVIEWED' } }),
    // prisma.dietPlan.count({ where: { status: 'SENT' } }),
    // TODO(5a-cleanup): prisma.recipe dropped in K5a
    // prisma.recipe.count(),
    // prisma.recipe.count({ where: { qualityScore: { lt: 40 } } }),
  ]);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      deleted: totalUsers - activeUsers,
    },
    dietitians: totalDietitians,
    patients: totalPatients,
    // TODO(5b-cleanup): Interview + DietPlan dropped in K5b
    // interviews: totalInterviews,
    // dietPlans: { total: totalDietPlans, byStatus: { GENERATED, REVIEWED, SENT } },
    // TODO(5a-cleanup): prisma.recipe dropped in K5a
    // recipes: { total: totalRecipes, needingWork: recipesNeedingWork },
  };
}

export async function getActionItems() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    pendingTestimonials,
    pendingConsultations,
    // TODO(5a-cleanup): prisma.recipe dropped in K5a
    // recipesNeedingWork,
    lockedAccounts,
  ] = await Promise.all([
    prisma.testimonial.count({ where: { status: 'PENDING' } }),
    prisma.order.count({
      where: { productType: 'CONSULTATION', status: 'PAID' },
    }),
    // TODO(5a-cleanup): prisma.recipe dropped in K5a
    // prisma.recipe.count({ where: { qualityScore: { lt: 40 } } }),
    prisma.auditLog.count({
      where: { action: 'ACCOUNT_LOCKED', createdAt: { gte: yesterday } },
    }).catch(() => 0),
  ]);

  return {
    pendingTestimonials,
    pendingConsultations,
    // TODO(5a-cleanup): prisma.recipe dropped in K5a
    // recipesNeedingWork,
    lockedAccounts,
  };
}

export interface CreateDietitianInput {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

export async function createDietitian({ email, password, firstName, lastName }: CreateDietitianInput) {
  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered');
  }

  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
  const user = await prisma.user.create({
    data: { email, passwordHash, role: 'DIETITIAN', emailVerified: new Date() },
  });

  // Auto-generate unique code (retry up to 5 times on collision)
  let code = '';
  for (let i = 0; i < 5; i++) {
    code = generateDietitianCode();
    const exists = await prisma.dietitianProfile.findUnique({ where: { code } });
    if (!exists) break;
    code = '';
  }
  if (!code) {
    throw new AppError(500, 'CODE_GENERATION_FAILED', 'Could not generate unique dietitian code');
  }

  const profile = await prisma.dietitianProfile.create({
    data: { userId: user.id, code, firstName: firstName ?? null, lastName: lastName ?? null },
  });

  return {
    dietitianUserId: user.id,
    email: user.email,
    code: profile.code,
    firstName: profile.firstName,
    lastName: profile.lastName,
  };
}

export interface CreateUserInput {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  dietitianCode?: string;
}

export async function createUser({ email, password, firstName, lastName, dietitianCode }: CreateUserInput) {
  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered');
  }

  let dietitianId: string | null = null;
  if (dietitianCode) {
    const profile = await prisma.dietitianProfile.findFirst({
      where: { code: { equals: dietitianCode, mode: 'insensitive' } },
    });
    if (!profile) {
      throw new AppError(400, 'INVALID_DIETITIAN_CODE', 'Invalid dietitian code');
    }
    dietitianId = profile.userId;
  }

  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
  const user = await prisma.user.create({
    data: { email, passwordHash, role: 'PATIENT', emailVerified: new Date() },
  });

  await prisma.patient.create({
    data: { userId: user.id, dietitianId, firstName, lastName },
  });

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    firstName: firstName ?? null,
    lastName: lastName ?? null,
  };
}

export interface ListDietitiansOptions {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  hideDeleted?: boolean;
}

export async function listDietitians({ page, limit, search, sortBy, sortOrder, hideDeleted }: ListDietitiansOptions) {
  const skip = (page - 1) * limit;

  const where: Prisma.DietitianProfileWhereInput = {
    ...(search ? {
      OR: [
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
    ...(hideDeleted ? { user: { deletedAt: null } } : {}),
  };

  // Map sort fields to Prisma orderBy
  let orderBy: Prisma.DietitianProfileOrderByWithRelationInput = { createdAt: 'desc' };
  const dir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
  if (sortBy === 'email') orderBy = { user: { email: dir } };
  else if (sortBy === 'lastLoginAt') orderBy = { user: { lastLoginAt: dir } };
  else if (sortBy === 'createdAt') orderBy = { createdAt: dir };
  else if (sortBy === 'patientsCount') orderBy = { user: { patientsAsDietitian: { _count: dir } } };

  const [profiles, total] = await prisma.$transaction([
    prisma.dietitianProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            lastLoginAt: true,
            createdAt: true,
            deletedAt: true,
            _count: { select: { patientsAsDietitian: true } },
          },
        },
      },
    }),
    prisma.dietitianProfile.count({ where }),
  ]);

  const dietitians = profiles.map((p) => ({
    userId: p.userId,
    code: p.code,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.user.email,
    role: p.user.role,
    lastLoginAt: p.user.lastLoginAt,
    createdAt: p.user.createdAt,
    deletedAt: p.user.deletedAt,
    patientsCount: p.user._count.patientsAsDietitian,
  }));

  return { dietitians, total, page, limit };
}

export async function getDietitianPatients(userId: string) {
  const profile = await prisma.dietitianProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new AppError(404, 'NOT_FOUND', 'Dietitian profile not found');
  }

  const patients = await prisma.patient.findMany({
    where: { dietitianId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      sex: true,
      birthYear: true,
      heightCm: true,
      weightKg: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
          lastLoginAt: true,
          deletedAt: true,
        },
      },
    },
  });

  return { patients, total: patients.length };
}

export interface UpdateDietitianInput {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export async function updateDietitian(userId: string, data: UpdateDietitianInput) {
  const profile = await prisma.dietitianProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new AppError(404, 'NOT_FOUND', 'Dietitian profile not found');
  }

  // Update email on User if provided
  if (data.email) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }
    if (data.email !== user.email) {
      const emailExists = await prisma.user.findFirst({
        where: { email: data.email, deletedAt: null, id: { not: userId } },
      });
      if (emailExists) {
        throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered');
      }
      await prisma.user.update({ where: { id: userId }, data: { email: data.email } });
    }
  }

  const updated = await prisma.dietitianProfile.update({
    where: { userId },
    data: {
      ...(data.firstName !== undefined ? { firstName: data.firstName || null } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName || null } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          deletedAt: true,
          _count: { select: { patientsAsDietitian: true } },
        },
      },
    },
  });

  return {
    userId: updated.userId,
    code: updated.code,
    firstName: updated.firstName,
    lastName: updated.lastName,
    email: updated.user.email,
    role: updated.user.role,
    createdAt: updated.user.createdAt,
    deletedAt: updated.user.deletedAt,
    patientsCount: updated.user._count.patientsAsDietitian,
  };
}

export async function rotateDietitianCode(userId: string) {
  const profile = await prisma.dietitianProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new AppError(404, 'NOT_FOUND', 'Dietitian profile not found');
  }

  let newCode = '';
  for (let i = 0; i < 5; i++) {
    newCode = generateDietitianCode();
    const exists = await prisma.dietitianProfile.findUnique({ where: { code: newCode } });
    if (!exists) break;
    newCode = '';
  }
  if (!newCode) {
    throw new AppError(500, 'CODE_GENERATION_FAILED', 'Could not generate unique dietitian code');
  }

  const updated = await prisma.dietitianProfile.update({
    where: { userId },
    data: { code: newCode },
  });

  return { userId, oldCode: profile.code, newCode: updated.code };
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

  // When promoting to DIETITIAN, ensure DietitianProfile exists
  if (role === 'DIETITIAN') {
    const existing = await prisma.dietitianProfile.findUnique({ where: { userId: id } });
    if (!existing) {
      let code = '';
      for (let i = 0; i < 5; i++) {
        code = generateDietitianCode();
        const taken = await prisma.dietitianProfile.findUnique({ where: { code } });
        if (!taken) break;
        code = '';
      }
      if (!code) {
        throw new AppError(500, 'CODE_GENERATION_FAILED', 'Could not generate unique dietitian code');
      }
      await prisma.dietitianProfile.create({ data: { userId: id, code } });
    }
  }

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
      patient: {
        select: {
          firstName: true,
          lastName: true,
          sex: true,
          birthYear: true,
          heightCm: true,
          weightKg: true,
        },
      },
      dietitianProfile: {
        select: { code: true },
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
