import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import { exportUserData } from '../services/dsar.service';
import * as consentService from '../services/consent.service';
import { logAudit } from '../services/audit.service';

const consentTypeSchema = z.enum([
  'EMAIL_NOTIFICATIONS',
  'TERMS_ACCEPTANCE',
  'PRIVACY_POLICY',
  'COOKIE_FUNCTIONAL',
  'COOKIE_ANALYTICS',
  'COOKIE_MARKETING',
]);

const cookieConsentBodySchema = z.object({
  functional: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean(),
  documentVersion: z.string().max(20).optional(),
});

const COOKIE_CONSENT_TYPES: Record<
  'functional' | 'analytics' | 'marketing',
  'COOKIE_FUNCTIONAL' | 'COOKIE_ANALYTICS' | 'COOKIE_MARKETING'
> = {
  functional: 'COOKIE_FUNCTIONAL',
  analytics: 'COOKIE_ANALYTICS',
  marketing: 'COOKIE_MARKETING',
};

/**
 * GET /profile/data-export
 * GDPR Art. 15 / Art. 20 — export all user data as JSON.
 */
export async function exportData(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;

    const data = await exportUserData(userId);

    logAudit({
      userId,
      action: 'DATA_EXPORT_REQUESTED',
      resourceType: 'DATA_EXPORT',
      ip: req.ip,
    });

    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /profile/consents
 * Returns all active (non-revoked) consents for the authenticated user.
 */
export async function getConsents(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const consents = await consentService.getActiveConsents(userId);
    return res.json({ ok: true, consents });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /profile/consents/history
 * Returns full consent history (for DSAR).
 */
export async function getConsentHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const consents = await consentService.getConsentHistory(userId);
    return res.json({ ok: true, consents });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /profile/consents/cookies
 * Bulk-persist cookie banner choices (RODO Phase 1.1 follow-up).
 *
 * For each category (functional/analytics/marketing): grant if true,
 * revoke if false. Necessary cookies are implicit and never stored.
 *
 * Returns the current active cookie consents after the update.
 */
export async function syncCookieConsents(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const parsed = cookieConsentBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid cookie consent payload'));
    }

    const documentVersion = parsed.data.documentVersion ?? '1.0';

    for (const category of ['functional', 'analytics', 'marketing'] as const) {
      const consentType = COOKIE_CONSENT_TYPES[category];
      const granted = parsed.data[category];

      if (granted) {
        await consentService.grantConsent(userId, consentType, documentVersion, req.ip);
      } else {
        // Best-effort revoke — ignore "not found" (user may never have granted it).
        try {
          await consentService.revokeConsent(userId, consentType, req.ip);
        } catch (err) {
          if ((err as { code?: string }).code !== 'CONSENT_NOT_FOUND') throw err;
        }
      }
    }

    const consents = await consentService.getActiveConsents(userId);
    return res.json({ ok: true, consents });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /profile/consents/:type/revoke
 * Revoke a specific consent type.
 */
export async function revokeConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;

    const parsed = consentTypeSchema.safeParse(req.params.type);
    if (!parsed.success) {
      return res.status(400).json(apiError('INVALID_CONSENT_TYPE', 'Invalid consent type'));
    }

    const consent = await consentService.revokeConsent(userId, parsed.data, req.ip);
    return res.json({ ok: true, consent });
  } catch (err) {
    next(err);
  }
}
