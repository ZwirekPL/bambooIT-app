import { Request, Response, NextFunction } from 'express';
import { apiError } from '../utils/errors';
import { checkAccess } from '../services/paywall.service';

/**
 * Middleware that blocks access if the patient has no active paid order.
 * Only applies when PAYWALL_ENABLED=true.
 * Non-PATIENT roles (ADMIN, DIETITIAN) are always allowed through.
 */
export function requireActiveOrder() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
    }

    // Admins and dietitians are never blocked by paywall
    if (user.role === 'ADMIN' || user.role === 'DIETITIAN') {
      return next();
    }

    const { hasAccess } = await checkAccess(user.sub);
    if (!hasAccess) {
      return res.status(403).json(
        apiError('PAYWALL_BLOCKED', 'Active order required to access this resource')
      );
    }

    next();
  };
}
