import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import { passwordSchema } from '../utils/validation';
import * as profileService from '../services/profile.service';
import { logAudit } from '../services/audit.service';
import { cacheGet, cacheSet, cacheDel } from '../utils/cache';

const PROFILE_TTL = 60;

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
