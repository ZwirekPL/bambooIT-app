import { Request, Response, NextFunction } from 'express';
import { apiError } from '../utils/errors';
import { checkAccess } from '../services/paywall.service';

/** GET /access/status — returns paywall status for the authenticated user. */
export async function getStatus(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  }

  try {
    const status = await checkAccess(userId);
    return res.json({ ok: true, ...status });
  } catch (err) {
    next(err);
  }
}
