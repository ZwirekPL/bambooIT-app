import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { apiError } from '../utils/errors';
import { redis } from '../utils/redis';
import { logAudit } from '../services/audit.service';

export type UserRole = 'ADMIN' | 'CLIENT';

// TODO(K6a-deploy): JWT claim renamed `patientId` → `companyId` in K6a.
// Tokens issued before K6a contain `patientId` and will pass cryptographic
// jwt.verify() but `req.user.companyId` will be undefined, causing downstream
// 404/500 errors. In dev this is a non-issue (no real users). In prod K6a
// deploy: run `redis-cli FLUSHDB` (or equivalent blacklist:user:* mass set)
// before deploy to force re-login on all clients.
//
// TODO(K7-deploy): Production deployment notes.
//
// The K7 migration (drop_dietitian_role_and_rename_patient_to_client)
// includes a manual SQL edit prepending ALTER TYPE RENAME VALUE
// 'PATIENT' TO 'CLIENT' before Prisma's auto-generated enum recreate
// workaround. This preserves PATIENT data by renaming it in-place
// before the workaround tries to cast values into the new enum.
//
// However, the migration still cannot auto-convert DIETITIAN users —
// those rows must be handled before migration deploys to production:
//
// 1. DELETE FROM "User" WHERE role = 'DIETITIAN'   (if dietitians
//    should lose access)
//    OR
// 1. UPDATE "User" SET role = 'CLIENT' WHERE role = 'DIETITIAN'
//    (if they should retain access as regular clients — manual
//    review per user)
//
// 2. Run npx prisma migrate deploy (auto-handles PATIENT → CLIENT
//    rename + DIETITIAN drop)
//
// 3. Frontend logout-on-401 handling clears stale cookies for any
//    users whose tokens contain old role claims
//
// 4. Notify users about re-login requirement
//
// Currently dev DB has 0 users — zero impact for K7 commit.
// bambooIT not deployed to prod yet — these steps become relevant
// when prod first launches with real users.
export interface AuthPayload {
  sub: string;
  email: string;
  role: UserRole;
  companyId?: string;
  iat?: number;
  exp?: number;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function requireAuth(...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json(apiError('UNAUTHORIZED', 'Missing or invalid Authorization header'));
    }

    const token = header.slice(7);

    let payload: AuthPayload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    } catch {
      return res.status(401).json(apiError('UNAUTHORIZED', 'Invalid or expired token'));
    }

    // Check JWT blacklist + active session in Redis — fail-closed (reject if Redis unavailable)
    try {
      const tokenHash = sha256(token);
      const [blacklisted, userRevoked, activeSessionRaw] = await Promise.all([
        redis.get(`blacklist:jwt:${tokenHash}`),
        redis.get(`blacklist:user:${payload.sub}`),
        redis.get(`session:active:${payload.sub}`),
      ]);
      if (blacklisted) {
        return res.status(401).json(apiError('UNAUTHORIZED', 'Token has been revoked'));
      }
      // Check if all sessions for this user were revoked after this token was issued
      if (userRevoked) {
        const revokedAt = parseInt(userRevoked, 10);
        if (payload.iat && payload.iat < revokedAt) {
          return res.status(401).json(apiError('UNAUTHORIZED', 'All sessions have been revoked'));
        }
      }

      // Single-active-session enforcement
      if (activeSessionRaw) {
        // A session is registered — token MUST match it, otherwise it's a stale
        // token from a device that has been superseded by a newer login.
        try {
          const parsed = JSON.parse(activeSessionRaw) as { tokenHash?: string };
          if (parsed.tokenHash && parsed.tokenHash !== tokenHash) {
            // Audit potential token theft / unexpected device usage
            logAudit({
              userId: payload.sub,
              action: 'SESSION_SUPERSEDED',
              ip: req.ip,
              metadata: {
                userAgent: req.headers['user-agent'],
                tokenIat: payload.iat,
                path: req.originalUrl,
              },
            });
            return res.status(401).json(apiError('SESSION_SUPERSEDED', 'Session was superseded by a newer login on another device'));
          }
        } catch {
          // Malformed session record — treat as missing and backfill below
        }
      } else {
        // No active session record — this is either:
        //  (a) the first request after a deploy that introduced enforcement
        //      (token is still valid via JWT exp), or
        //  (b) the session record expired (Redis TTL) but JWT is still valid.
        // In both cases we backfill the record so subsequent requests work and
        // future logins on other devices can supersede this token.
        const remainingSeconds = payload.exp
          ? Math.max(60, payload.exp - Math.floor(Date.now() / 1000))
          : 7 * 24 * 60 * 60;
        await redis.set(
          `session:active:${payload.sub}`,
          JSON.stringify({ tokenHash, loginAt: new Date().toISOString(), backfilled: true }),
          'EX',
          remainingSeconds,
        );
      }
    } catch (err) {
      console.error('[auth] Redis blacklist check failed (fail-closed):', err);
      return res.status(503).json(apiError('SERVICE_UNAVAILABLE', 'Authentication service temporarily unavailable'));
    }

    req.user = payload;

    if (roles.length > 0 && !roles.includes(payload.role)) {
      return res.status(403).json(apiError('FORBIDDEN', 'Insufficient permissions'));
    }

    next();
  };
}
