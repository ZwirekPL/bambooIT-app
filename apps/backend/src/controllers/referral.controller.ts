import { Request, Response, NextFunction } from 'express';
import * as referralService from '../services/referral.service';

export async function getMyReferral(req: Request, res: Response, next: NextFunction) {
  try {
    let referral = await referralService.getMyReferral(req.user!.sub);

    // Auto-create if user doesn't have one yet
    if (!referral) {
      await referralService.getOrCreateCode(req.user!.sub);
      referral = await referralService.getMyReferral(req.user!.sub);
    }

    res.json({ ok: true, referral });
  } catch (err) {
    next(err);
  }
}

export async function getAdminStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await referralService.getAdminStats();
    res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
}
