import { Request, Response, NextFunction } from 'express';
import { getDietitianAlerts } from '../services/dietitianAlerts.service';

export async function alerts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getDietitianAlerts({
      dietitianUserId: req.user!.sub,
      role: req.user!.role,
    });
    return res.json({ ok: true, alerts: result });
  } catch (err) {
    next(err);
  }
}
