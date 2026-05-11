import { Request, Response, NextFunction } from 'express';
import { getOnboardingStatus, getDietitianOnboardingStatus } from '../services/onboarding.service';

export async function getStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await getOnboardingStatus(req.user!.sub);
    return res.json({ ok: true, ...status });
  } catch (err) {
    next(err);
  }
}

export async function getDietitianStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await getDietitianOnboardingStatus(req.user!.sub);
    return res.json({ ok: true, ...status });
  } catch (err) {
    next(err);
  }
}
