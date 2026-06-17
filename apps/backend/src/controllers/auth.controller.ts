import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import { passwordSchema } from '../utils/validation';
import { isValidNIP, normalizeNIP } from '../utils/nip';
import * as authService from '../services/auth.service';
import { logAudit } from '../services/audit.service';
import { recordFingerprint, checkFingerprintAbuse } from '../services/deviceFingerprint.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceFingerprint: z.string().optional(),
});

const consentSchema = z.object({
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Terms acceptance is required' }) }),
  privacyPolicy: z.literal(true, { errorMap: () => ({ message: 'Privacy policy acceptance is required' }) }),
  emailNotifications: z.boolean().default(false),
});

const INDUSTRY_VALUES = [
  'accounting',
  'law',
  'medical',
  'production',
  'hospitality',
  'other',
] as const;

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  firstName: z.string().min(1).max(50).transform((v) => v.trim()),
  lastName: z.string().min(1).max(50).transform((v) => v.trim()),
  companyName: z.string().min(1).max(150).transform((v) => v.trim()),
  nip: z
    .string()
    .min(10)
    .max(20)
    .refine((v) => isValidNIP(v), { message: 'Nieprawidłowy NIP' })
    .transform((v) => normalizeNIP(v)),
  industry: z.enum(INDUSTRY_VALUES),
  phone: z.string().min(6).max(30).transform((v) => v.trim()),
  employeesCount: z.number().int().min(1).max(10000).optional(),
  website: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined)),
  consents: consentSchema,
  deviceFingerprint: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export async function login(req: Request, res: Response, next: NextFunction) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const result = await authService.login(parsed.data.email, parsed.data.password);
    logAudit({ userId: result.user.id, action: 'LOGIN', ip: req.ip });

    // 39.2: Record device fingerprint (non-blocking)
    if (parsed.data.deviceFingerprint) {
      recordFingerprint(
        parsed.data.deviceFingerprint,
        result.user.id,
        req.headers['user-agent'],
        req.ip ?? undefined,
      ).catch((err) => { console.warn('[auth] fingerprint recording failed:', err); });
    }

    return res.json({ ok: true, ...result });
  } catch (err) {
    // Audit failed login attempts (invalid creds, lockout, unverified email)
    const code = (err as { code?: string })?.code;
    if (
      code === 'INVALID_CREDENTIALS' ||
      code === 'ACCOUNT_LOCKED' ||
      code === 'TOO_MANY_ATTEMPTS' ||
      code === 'EMAIL_NOT_VERIFIED'
    ) {
      logAudit({
        action: 'LOGIN_FAILED',
        ip: req.ip,
        metadata: { email: parsed.data.email, reason: code },
      });
    }
    next(err);
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    // 39.2: Check device fingerprint abuse before registration
    if (parsed.data.deviceFingerprint) {
      const abuse = await checkFingerprintAbuse(parsed.data.deviceFingerprint);
      if (abuse.isAbusive) {
        return res.status(429).json(apiError('DEVICE_ABUSE', 'Too many accounts from this device'));
      }
    }

    const result = await authService.register(
      parsed.data.email,
      parsed.data.password,
      {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        companyName: parsed.data.companyName,
        nip: parsed.data.nip,
        industry: parsed.data.industry,
        phone: parsed.data.phone,
        employeesCount: parsed.data.employeesCount,
        website: parsed.data.website,
      },
      parsed.data.consents,
      req.ip ?? undefined,
    );

    // 39.2: Record device fingerprint (non-blocking)
    if (parsed.data.deviceFingerprint) {
      recordFingerprint(
        parsed.data.deviceFingerprint,
        result.user.id,
        req.headers['user-agent'],
        req.ip ?? undefined,
      ).catch((err) => { console.warn('[auth] fingerprint recording failed:', err); });
    }

    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    await authService.forgotPassword(parsed.data.email);
    return res.json({ ok: true, message: 'If email exists, reset link was sent' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body'));
  }

  try {
    await authService.resetPassword(parsed.data.token, parsed.data.password);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    await authService.verifyEmail(parsed.data.token);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export async function resendVerification(req: Request, res: Response, next: NextFunction) {
  const parsed = resendVerificationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    await authService.resendVerification(parsed.data.email);
    return res.json({ ok: true, message: 'If account exists and is not verified, a new link was sent' });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization!.slice(7);
    await authService.logout(token, req.user!.sub);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
