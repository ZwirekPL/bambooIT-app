import { Router } from 'express';
import { prisma } from '@db';
import { apiError } from '../utils/errors';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'OK' });
});

healthRouter.get('/db', async (_req, res) => {
  try {
    // Only check connectivity — never expose metrics publicly
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(500).json(apiError('DB_ERROR', 'Database connection failed'));
  }
});
