import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/errors';
import {
  validatePlan,
  autoAdjustContent,
  buildShoppingList,
  buildCategorizedShoppingList,
  type PlanContent,
} from '../services/planValidation.service';
import { decryptJson, encryptJson } from '../utils/encryption';
import { prisma } from '@db';
import { apiError } from '../utils/errors';

const idSchema = z.string().cuid();

// POST /diet-plans/:id/validate
export async function runValidation(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params['id']);
    const result = await validatePlan(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// POST /diet-plans/:id/auto-adjust
export async function runAutoAdjust(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params['id']);

    const plan = await prisma.dietPlan.findUnique({ where: { id } });
    if (!plan) throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');

    if (['SENT', 'PUBLISHED'].includes(plan.status)) {
      throw new AppError(422, 'INVALID_STATE', `Cannot adjust a plan in status ${plan.status}`);
    }

    const targets = await prisma.nutritionTargets.findUnique({ where: { patientId: plan.patientId } });
    if (!targets) throw new AppError(422, 'NO_TARGETS', 'NutritionTargets not found for this patient');

    const content = decryptJson(plan.content) as PlanContent;
    const adjusted = autoAdjustContent(content, targets.targetKcal);

    const updated = await prisma.dietPlan.update({
      where: { id },
      data: { content: encryptJson(adjusted) },
    });

    // Re-validate after adjustment
    const validation = await validatePlan(id);

    res.json({
      dietPlanId: updated.id,
      validation,
    });
  } catch (err) {
    next(err);
  }
}

// GET /diet-plans/:id/shopping-list?format=flat|categorized (default: categorized)
export async function getShoppingList(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params['id']);
    const format = req.query['format'] === 'flat' ? 'flat' : 'categorized';
    // 63.2: optional days filter (comma-separated day indices, 0-based)
    const daysParam = typeof req.query['days'] === 'string' ? req.query['days'] : undefined;
    const dayIndices = daysParam ? daysParam.split(',').map(Number).filter((n) => !isNaN(n)) : undefined;

    const plan = await prisma.dietPlan.findUnique({ where: { id } });
    if (!plan) throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');

    const content = decryptJson(plan.content) as PlanContent;

    if (format === 'flat') {
      res.json({ shoppingList: buildShoppingList(content, dayIndices) });
    } else {
      res.json({ categories: buildCategorizedShoppingList(content, dayIndices) });
    }
  } catch (err) {
    next(err);
  }
}

/** GET /diet-plans/:id/shopping-list/pdf — download shopping list as PDF (63.1) */
export async function getShoppingListPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params['id']);
    const daysParam = typeof req.query['days'] === 'string' ? req.query['days'] : undefined;
    const dayIndices = daysParam ? daysParam.split(',').map(Number).filter((n) => !isNaN(n)) : undefined;

    const plan = await prisma.dietPlan.findUnique({ where: { id } });
    if (!plan) throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');

    const content = decryptJson(plan.content) as PlanContent;
    const categories = buildCategorizedShoppingList(content, dayIndices);

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="lista-zakupow-${id.slice(-6)}.pdf"`);
    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('Lista zakupów', { align: 'center' });
    doc.moveDown(0.5);
    const dateLabel = daysParam ? `Dni: ${daysParam}` : 'Cały tydzień';
    doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text(`${dateLabel} • Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`, { align: 'center' });
    doc.moveDown(1);

    for (const cat of categories) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a1a1a').text(cat.category);
      doc.moveDown(0.3);
      for (const item of cat.items) {
        const label = typeof item === 'string' ? item : `${(item as { name: string; totalGrams: number }).name} — ${(item as { totalGrams: number }).totalGrams}g`;
        doc.fontSize(10).font('Helvetica').fillColor('#374151').text(`□  ${label}`, { indent: 10 });
      }
      doc.moveDown(0.5);
    }

    doc.end();
  } catch (err) {
    next(err);
  }
}

// ── 63.3 Shopping list checks (server-side persistence) ─────────────────────

const checksSchema = z.object({
  items: z.array(z.object({
    name: z.string().min(1).max(300),
    checked: z.boolean(),
  })),
});

/** GET /diet-plans/:id/shopping-list/checks */
export async function getShoppingListChecks(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params['id']);
    const patientId = req.user?.patientId;
    if (!patientId) return res.status(400).json(apiError('NO_PATIENT', 'No patient profile'));

    const checks = await prisma.shoppingListCheck.findMany({
      where: { patientId, dietPlanId: id },
      select: { itemName: true, checked: true },
    });

    const map: Record<string, boolean> = {};
    for (const c of checks) map[c.itemName] = c.checked;
    return res.json({ ok: true, checks: map });
  } catch (err) {
    next(err);
  }
}

/** PUT /diet-plans/:id/shopping-list/checks */
export async function putShoppingListChecks(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params['id']);
    const patientId = req.user?.patientId;
    if (!patientId) return res.status(400).json(apiError('NO_PATIENT', 'No patient profile'));

    const parsed = checksSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid data'));

    // Batch upsert
    await Promise.all(
      parsed.data.items.map((item) =>
        prisma.shoppingListCheck.upsert({
          where: { patientId_dietPlanId_itemName: { patientId, dietPlanId: id, itemName: item.name } },
          create: { patientId, dietPlanId: id, itemName: item.name, checked: item.checked },
          update: { checked: item.checked },
        })
      )
    );

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
