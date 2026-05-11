import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as userService from '../services/user.service';
import { logAudit } from '../services/audit.service';

const userIdSchema = z.object({ id: z.string().cuid() });

export async function remove(req: Request, res: Response, next: NextFunction) {
  const parsed = userIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid user id'));
  }

  try {
    await userService.softDeleteUser(parsed.data.id);
    logAudit({ userId: req.user?.sub, action: 'DELETE_USER', resourceType: 'USER', resourceId: parsed.data.id, ip: req.ip });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
