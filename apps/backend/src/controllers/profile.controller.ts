import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import { passwordSchema } from '../utils/validation';
// TODO(2c-cleanup): patient.service dropped — getMyProfile/updateMyProfile handlers commented below. Rebuild as company profile in fazie 4.
// import * as patientService from '../services/patient.service';
import * as profileService from '../services/profile.service';
import { logAudit } from '../services/audit.service';
import { cacheGet, cacheSet, cacheDel } from '../utils/cache';

const PROFILE_TTL = 60;

// TODO(2c-cleanup): patient.service dropped — handlers below commented. Rebuild as company profile in fazie 4.
// const updateSchema = z
//   .object({
//     firstName: z.string().min(1).max(100),
//     lastName: z.string().min(1).max(100),
//     sex: z.string().min(1).max(20),
//     birthYear: z.number().int().min(1900).max(new Date().getFullYear()),
//     heightCm: z.number().int().min(50).max(300),
//     weightKg: z.number().min(10).max(500),
//     dietitianCode: z.string().min(1).max(20),
//     unlinkDietitian: z.literal(true),
//   })
//   .partial();
//
// export async function getMyProfile(req: Request, res: Response, next: NextFunction) { ... patientService.getPatientByUserId ... }
// export async function updateMyProfile(req: Request, res: Response, next: NextFunction) { ... patientService.linkDietitianByCode / unlinkDietitian / updatePatient ... }

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
