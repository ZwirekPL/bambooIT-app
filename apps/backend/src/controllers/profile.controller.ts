import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError, AppError } from '../utils/errors';
import { passwordSchema } from '../utils/validation';
import { isValidNIP, normalizeNIP } from '../utils/nip';
import { prisma, Prisma } from '@db';
import * as profileService from '../services/profile.service';
import { logAudit } from '../services/audit.service';
import { cacheGet, cacheSet, cacheDel } from '../utils/cache';

const PROFILE_TTL = 60;

const INDUSTRY_VALUES = [
  'accounting',
  'law',
  'medical',
  'production',
  'hospitality',
  'other',
] as const;

const updateCompanySchema = z.object({
  contactFirstName: z.string().min(1).max(50).optional(),
  contactLastName: z.string().min(1).max(50).optional(),
  companyName: z.string().min(1).max(150).optional(),
  nip: z
    .string()
    .min(10)
    .max(20)
    .refine((v) => isValidNIP(v), { message: 'Nieprawidłowy NIP' })
    .transform((v) => normalizeNIP(v))
    .optional(),
  industry: z.enum(INDUSTRY_VALUES).optional(),
  employeesCount: z.number().int().min(1).max(10000).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  postalCode: z
    .string()
    .max(20)
    .regex(/^\d{2}-\d{3}$/, 'Kod pocztowy w formacie XX-XXX')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  phone: z.string().min(6).max(30).optional(),
  website: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
});

export async function getMyCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const company = await prisma.company.findUnique({ where: { userId: req.user!.sub } });
    if (!company) {
      throw new AppError(404, 'COMPANY_NOT_FOUND', 'Brak profilu firmy dla tego konta');
    }
    return res.json({ ok: true, company });
  } catch (err) {
    next(err);
  }
}

export async function updateMyCompany(req: Request, res: Response, next: NextFunction) {
  const parsed = updateCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Sprawdź wypełnione pola'));
  }

  try {
    const existing = await prisma.company.findUnique({ where: { userId: req.user!.sub } });
    if (!existing) {
      return res.status(404).json(apiError('COMPANY_NOT_FOUND', 'Brak profilu firmy'));
    }

    // Block NIP collisions early with a clean error rather than a P2002 burst
    if (parsed.data.nip && parsed.data.nip !== existing.nip) {
      const taken = await prisma.company.findUnique({ where: { nip: parsed.data.nip } });
      if (taken) {
        return res.status(409).json(apiError('NIP_TAKEN', 'NIP jest już używany przez inną firmę'));
      }
    }

    const data: Prisma.CompanyUpdateInput = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        (data as Record<string, unknown>)[key] = value;
      }
    }

    const company = await prisma.company.update({
      where: { userId: req.user!.sub },
      data,
    });

    logAudit({
      userId: req.user!.sub,
      action: 'UPDATE_PROFILE',
      resourceType: 'USER',
      resourceId: req.user!.sub,
      ip: req.ip,
      metadata: { changedFields: Object.keys(data) },
    });

    return res.json({ ok: true, company });
  } catch (err) {
    next(err);
  }
}

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    await profileService.changePassword(
      req.user!.sub,
      parsed.data.oldPassword,
      parsed.data.newPassword,
      req.ip,
    );
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

const changeEmailSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
  password: z.string().min(1),
});

export async function changeEmail(req: Request, res: Response, next: NextFunction) {
  const parsed = changeEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    await profileService.changeEmail(
      req.user!.sub,
      parsed.data.newEmail,
      parsed.data.password,
      req.ip,
    );
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** DELETE /profile/account — RODO art. 17 account deletion (66.2). */
const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

export async function deleteAccount(req: Request, res: Response, next: NextFunction) {
  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Password required'));
  }

  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  }

  try {
    await profileService.deleteAccount(userId, parsed.data.password);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
