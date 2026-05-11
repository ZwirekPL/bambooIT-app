import { Request, Response, NextFunction } from 'express';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF protection via Origin/Referer header validation.
 * Blocks state-changing requests (POST, PUT, PATCH, DELETE) whose Origin
 * does not match any allowed origin. GET/HEAD/OPTIONS pass through.
 *
 * Must be mounted AFTER CORS middleware and AFTER the Stripe webhook route
 * (webhook requests have no Origin header and are verified via Stripe signature).
 */
export function csrfProtection(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!STATE_CHANGING_METHODS.has(req.method)) {
      return next();
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;

    // Server-to-server requests (no browser) have no Origin or Referer — allow
    if (!origin && !referer) {
      return next();
    }

    // Check Origin header first (most reliable)
    if (origin) {
      if (allowedOrigins.includes(origin) || isAllowedDevOrigin(origin)) {
        return next();
      }
      return res.status(403).json({
        error: { code: 'CSRF_REJECTED', message: 'Cross-origin request blocked' },
      });
    }

    // Fallback: check Referer
    if (referer) {
      try {
        const refOrigin = new URL(referer).origin;
        if (allowedOrigins.includes(refOrigin) || isAllowedDevOrigin(refOrigin)) {
          return next();
        }
      } catch {
        // Invalid Referer URL — reject
      }
      return res.status(403).json({
        error: { code: 'CSRF_REJECTED', message: 'Cross-origin request blocked' },
      });
    }

    next();
  };
}

function isAllowedDevOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const host = new URL(origin).hostname;
    return (
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)
    );
  } catch {
    return false;
  }
}
