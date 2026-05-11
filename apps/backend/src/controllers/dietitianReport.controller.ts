import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as reportService from '../services/dietitianReport.service';
import { generateReportPdf } from '../services/dietitianReportPdf.service';

const monthSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Format: YYYY-MM'),
});

export async function getReport(req: Request, res: Response, next: NextFunction) {
  const parsed = monthSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid month format. Use YYYY-MM'));
  }

  try {
    const report = await reportService.getMonthlyReport(req.user!.sub, parsed.data.month);
    return res.json({ ok: true, report });
  } catch (err) {
    next(err);
  }
}

export async function exportPdf(req: Request, res: Response, next: NextFunction) {
  const parsed = monthSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid month format. Use YYYY-MM'));
  }

  try {
    const report = await reportService.getMonthlyReport(req.user!.sub, parsed.data.month);
    const pdfBuffer = await generateReportPdf(report);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="raport-${parsed.data.month}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}
