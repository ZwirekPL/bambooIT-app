import { Request, Response, NextFunction } from 'express';
import { AppError, apiError } from '../utils/errors';
import { captureException } from '../utils/sentry';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    // Only report 5xx AppErrors to Sentry (81.1)
    if (err.statusCode >= 500) {
      captureException(err, { code: err.code, path: _req.path });
    }
    res.status(err.statusCode).json(apiError(err.code, err.message));
    return;
  }

  // Unhandled errors → always report to Sentry
  console.error('[errorHandler] Unhandled error:', err);
  captureException(err, { path: _req.path, method: _req.method });

  const message =
    process.env.NODE_ENV === 'production' ? 'Internal server error' : String(err);

  res.status(500).json(apiError('INTERNAL_ERROR', message));
}
