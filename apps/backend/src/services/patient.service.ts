import { Prisma } from '@db';
import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { cacheGet, cacheSet } from '../utils/cache';

type DietPlanStatus = 'AI_DRAFT' | 'GENERATED' | 'REVIEWED' | 'SENT' | 'PUBLISHED';

export interface ListPatientsOptions {
  page: number;
  limit: number;
  search?: string;
  planStatus?: string;
  scope?: 'mine' | 'unassigned';
  dietitianUserId?: string;
  role?: string;
  sortBy?: 'firstName' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  /** IW-17: Filter by interview status */
  interviewFilter?: 'none' | 'stale';  // none = no interview, stale = interview > 90 days ago
}

export interface UpdatePatientData {
  firstName?: string;
  lastName?: string;
  sex?: string;
  birthYear?: number;
  birthDate?: Date;
  heightCm?: number;
  weightKg?: number;
}

const userSelect = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export async function listPatients({ page, limit, search, planStatus, scope, dietitianUserId, role, sortBy, sortOrder, interviewFilter }: ListPatientsOptions) {
  const skip = (page - 1) * limit;

  const planStatusFilter: Prisma.PatientWhereInput =
    planStatus === 'NONE'
      ? { dietPlans: { none: {} } }
      : planStatus
        ? { dietPlans: { some: { status: planStatus as DietPlanStatus } } }
        : {};

  // Scope filter for DIETITIAN role:
  // - 'mine': only patients assigned to this dietitian
  // - 'unassigned': only patients without any dietitian
  // - default (no scope): only own patients (backward compatible)
  let dietitianFilter: Prisma.PatientWhereInput = {};
  if (role === 'DIETITIAN' && dietitianUserId) {
    if (scope === 'unassigned') {
      dietitianFilter = { dietitianId: null };
    } else {
      dietitianFilter = { dietitianId: dietitianUserId };
    }
  }

  // IW-17: Interview status filter
  let interviewStatusFilter: Prisma.PatientWhereInput = {};
  if (interviewFilter === 'none') {
    interviewStatusFilter = { interviews: { none: {} } };
  } else if (interviewFilter === 'stale') {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    interviewStatusFilter = {
      interviews: { none: { createdAt: { gte: ninetyDaysAgo } } },
    };
  }

  const where: Prisma.PatientWhereInput = {
    user: { deletedAt: null },
    ...dietitianFilter,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...planStatusFilter,
    ...interviewStatusFilter,
  };

  const [patients, total] = await prisma.$transaction([
    prisma.patient.findMany({
      where,
      skip,
      take: limit,
      orderBy: sortBy === 'firstName'
        ? { firstName: sortOrder ?? 'asc' }
        : { createdAt: sortOrder ?? 'desc' },
      include: {
        user: { select: userSelect },
        dietPlans: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, createdAt: true },
        },
      },
    }),
    prisma.patient.count({ where }),
  ]);

  return { patients, total, page, limit };
}

export async function getPatientStats({ dietitianUserId, role }: { dietitianUserId?: string; role?: string }) {
  const patientWhere: Prisma.PatientWhereInput = {
    user: { deletedAt: null },
    ...(role === 'DIETITIAN' && dietitianUserId ? { dietitianId: dietitianUserId } : {}),
  };
  const planWhere: Prisma.DietPlanWhereInput =
    role === 'DIETITIAN' && dietitianUserId ? { patient: { dietitianId: dietitianUserId } } : {};

  const [totalPatients, aiDraft, awaitingReview, published] = await prisma.$transaction([
    prisma.patient.count({ where: patientWhere }),
    prisma.dietPlan.count({ where: { ...planWhere, status: 'AI_DRAFT' } }),
    prisma.dietPlan.count({ where: { ...planWhere, status: 'GENERATED' } }),
    prisma.dietPlan.count({ where: { ...planWhere, status: 'PUBLISHED' } }),
  ]);

  return { totalPatients, aiDraft, awaitingReview, published };
}

export async function getPatient(id: string, dietitianUserId?: string, role?: string) {
  const patient = await prisma.patient.findFirst({
    where: { id, user: { deletedAt: null } },
    include: {
      user: {
        select: {
          ...userSelect,
          testimonial: { select: { id: true, content: true, rating: true, status: true, createdAt: true } },
        },
      },
    },
  });

  if (!patient) {
    throw new AppError(404, 'NOT_FOUND', 'Patient not found');
  }

  // DIETITIAN can view:
  // - own patients (dietitianId matches)
  // - unassigned patients (dietitianId is null) — read-only access
  if (role === 'DIETITIAN' && dietitianUserId) {
    const isOwn = patient.dietitianId === dietitianUserId;
    const isUnassigned = patient.dietitianId === null;
    if (!isOwn && !isUnassigned) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }
  }

  return patient;
}

// 39.1 — Immutable profile fields (locked after first set, unless admin unlocked via Redis)
const IMMUTABLE_FIELDS: (keyof UpdatePatientData)[] = ['sex', 'birthYear', 'birthDate', 'heightCm'];

export async function updatePatient(id: string, data: UpdatePatientData, dietitianUserId?: string, role?: string) {
  const patient = await getPatient(id, dietitianUserId, role);

  // DIETITIAN can only edit own patients (not unassigned)
  if (role === 'DIETITIAN' && dietitianUserId && patient.dietitianId !== dietitianUserId) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot edit patients not assigned to you');
  }

  // 39.1: Block editing immutable fields if already set (unless ADMIN, PATIENT editing own profile, or unlock token)
  if (role !== 'ADMIN' && role !== 'PATIENT') {
    const lockedFields: string[] = [];
    for (const field of IMMUTABLE_FIELDS) {
      if (data[field] !== undefined && (patient as Record<string, unknown>)[field] != null) {
        const unlocked = await cacheGet(`profile-unlock:${id}`);
        if (!unlocked) {
          lockedFields.push(field);
        }
      }
    }
    if (lockedFields.length > 0) {
      throw new AppError(403, 'PROFILE_FIELD_LOCKED', `Cannot edit locked fields: ${lockedFields.join(', ')}. Contact your dietitian to unlock.`);
    }
  }

  return prisma.patient.update({
    where: { id },
    data,
    include: { user: { select: userSelect } },
  });
}

/** 39.1.2: Admin unlock profile for editing (Redis token, TTL 1h) */
export async function unlockProfile(patientId: string): Promise<void> {
  await cacheSet(`profile-unlock:${patientId}`, 'unlocked', 3600);
}

export async function getPatientByUserId(userId: string) {
  const patient = await prisma.patient.findFirst({
    where: { userId, user: { deletedAt: null } },
    include: {
      user: { select: userSelect },
      dietitian: {
        select: {
          id: true,
          email: true,
          dietitianProfile: { select: { code: true } },
        },
      },
    },
  });

  if (!patient) {
    throw new AppError(404, 'NOT_FOUND', 'Patient profile not found');
  }

  return patient;
}

export async function linkDietitianByCode(patientId: string, dietitianCode: string) {
  const profile = await prisma.dietitianProfile.findFirst({
    where: { code: { equals: dietitianCode, mode: 'insensitive' } },
  });
  if (!profile) {
    throw new AppError(400, 'INVALID_DIETITIAN_CODE', 'Invalid dietitian code');
  }

  return prisma.patient.update({
    where: { id: patientId },
    data: { dietitianId: profile.userId },
    include: {
      user: { select: userSelect },
      dietitian: {
        select: {
          id: true,
          email: true,
          dietitianProfile: { select: { code: true } },
        },
      },
    },
  });
}

export async function unlinkDietitian(patientId: string) {
  return prisma.patient.update({
    where: { id: patientId },
    data: { dietitianId: null },
    include: {
      user: { select: userSelect },
      dietitian: {
        select: {
          id: true,
          email: true,
          dietitianProfile: { select: { code: true } },
        },
      },
    },
  });
}

export async function deletePatient(id: string, dietitianUserId?: string, role?: string) {
  const patient = await getPatient(id, dietitianUserId, role);

  await prisma.user.update({
    where: { id: patient.userId },
    data: { deletedAt: new Date() },
  });
}
