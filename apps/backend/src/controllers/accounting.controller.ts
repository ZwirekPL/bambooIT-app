import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as accounting from '../services/accounting.service';

const monthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
});

export async function getRevenue(req: Request, res: Response, next: NextFunction) {
  const parsed = monthSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'month param required (YYYY-MM)'));

  try {
    const report = await accounting.getRevenueReport(parsed.data.month);
    return res.json({ ok: true, report });
  } catch (err) {
    next(err);
  }
}

export async function getTransactionsCsv(req: Request, res: Response, next: NextFunction) {
  const parsed = monthSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'month param required (YYYY-MM)'));

  try {
    const csv = await accounting.getTransactionsCsv(parsed.data.month);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transakcje-${parsed.data.month}.csv"`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
}

export async function getCosts(req: Request, res: Response, next: NextFunction) {
  const parsed = monthSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'month param required (YYYY-MM)'));

  try {
    const report = await accounting.getCostReport(parsed.data.month);
    return res.json({ ok: true, report });
  } catch (err) {
    next(err);
  }
}

export async function getChurn(req: Request, res: Response, next: NextFunction) {
  const parsed = monthSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'month param required (YYYY-MM)'));

  try {
    const report = await accounting.getChurnReport(parsed.data.month);
    return res.json({ ok: true, report });
  } catch (err) {
    next(err);
  }
}

export async function getInvoicesExport(req: Request, res: Response, next: NextFunction) {
  const parsed = monthSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'month param required (YYYY-MM)'));

  try {
    const invoices = await accounting.getInvoicesForMonth(parsed.data.month);
    // Return list of invoice URLs — frontend downloads them individually or we could stream ZIP
    return res.json({ ok: true, invoices, count: invoices.length });
  } catch (err) {
    next(err);
  }
}
