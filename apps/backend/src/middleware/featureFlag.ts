import { Request, Response, NextFunction } from 'express';
import { isFeatureEnabled } from '../services/featureFlag.service';
import { apiError } from '../utils/errors';

/**
 * Express middleware that gates a route behind a feature flag.
 *
 * Usage:
 *   router.post('/some-endpoint', requireFeature('my_feature'), controller.handler);
 *
 * Returns 403 if the flag is disabled for the current user.
 */
export function requireFeature(flagKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ctx = {
      userId: req.user?.sub,
      role: req.user?.role,
    };

    const enabled = await isFeatureEnabled(flagKey, ctx);
    if (!enabled) {
      return res.status(403).json(apiError('FEATURE_DISABLED', `Feature "${flagKey}" is not enabled`));
    }

    next();
  };
}
