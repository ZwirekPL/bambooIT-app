import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import { passwordSchema } from '../utils/validation';
import * as patientService from '../services/patient.service';
import * as profileService from '../services/profile.service';
import { logAudit } from '../services/audit.service';
import { cacheGet, cacheSet, cacheDel } from '../utils/cache';

const PROFILE_TTL = 60;

const updateSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    sex: z.string().min(1).max(20),
    birthYear: z.number().int().min(1900).max(new Date().getFullYear()),
    heightCm: z.number().int().min(50).max(300),
    weightKg: z.number().min(10).max(500),
    dietitianCode: z.string().min(1).max(20),
    unlinkDietitian: z.literal(true),
  })
  .partial();

export async function getMyProfile(req: Request, res: Response, next: NextFunction) {
  const userId = req.user!.sub;
  const cacheKey = `cache:profile:${userId}`;

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ ok: true, patient: cached });
    }

    const patient = await patientService.getPatientByUserId(userId);
    await cacheSet(cacheKey, patient, PROFILE_TTL);
    logAudit({
      userId,
      action: 'VIEW_PATIENT',
      resourceType: 'PATIENT',
      resourceId: patient.id,
      ip: req.ip,
    });
    return res.json({ ok: true, patient });
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfile(req: Request, res: Response, next: NextFunction) {
  const bodyParsed = updateSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  if (Object.keys(bodyParsed.data).length === 0) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'No fields to update'));
  }

  // Prevent setting both dietitianCode and unlinkDietitian
  if (bodyParsed.data.dietitianCode && bodyParsed.data.unlinkDietitian) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Cannot link and unlink dietitian at the same time'));
  }

  const userId = req.user!.sub;

  try {
    const existing = await patientService.getPatientByUserId(userId);

    // Handle dietitian code linking / unlinking
    const { dietitianCode, unlinkDietitian, ...profileData } = bodyParsed.data;

    let patient;
    if (unlinkDietitian) {
      patient = await patientService.unlinkDietitian(existing.id);
    } else if (dietitianCode) {
      patient = await patientService.linkDietitianByCode(existing.id, dietitianCode);
    }

    // Update profile fields if any
    if (Object.keys(profileData).length > 0) {
      patient = await patientService.updatePatient(existing.id, profileData, undefined, req.user!.role);
    }

    if (!patient) {
      // Only dietitianCode/unlinkDietitian was sent, re-fetch
      patient = await patientService.getPatientByUserId(userId);
    }

    await cacheDel(`cache:profile:${userId}`);
    await cacheDel(`cache:patient:${existing.id}`);
    logAudit({
      userId,
      action: 'UPDATE_PATIENT',
      resourceType: 'PATIENT',
      resourceId: existing.id,
      ip: req.ip,
    });
    return res.json({ ok: true, patient });
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

const updateDietitianSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
}).refine(data => data.firstName !== undefined || data.lastName !== undefined, {
  message: 'At least one field must be provided',
});

export async function getDietitianProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await profileService.getDietitianProfile(req.user!.sub);
    return res.json({ ok: true, profile });
  } catch (err) {
    next(err);
  }
}

export async function updateDietitianProfile(req: Request, res: Response, next: NextFunction) {
  const parsed = updateDietitianSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const profile = await profileService.updateDietitianProfile(
      req.user!.sub,
      parsed.data,
      req.ip,
    );
    return res.json({ ok: true, profile });
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
