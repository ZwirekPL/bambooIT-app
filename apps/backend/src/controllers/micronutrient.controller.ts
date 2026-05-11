/**
 * 38.11 — Micronutrient Analysis Controller.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@db';
import { apiError, AppError } from '../utils/errors';
import { decryptJson } from '../utils/encryption';
import { analyzePlanMicronutrients } from '../services/micronutrientAnalysis.service';
import { findMedicationInteractions } from '../services/medicationInteractions';

const idSchema = z.object({ id: z.string().cuid() });

/**
 * GET /diet-plans/:id/micronutrients
 * Full analysis for ADMIN/DIETITIAN, simplified for PATIENT.
 */
export async function analyzePlan(req: Request, res: Response, next: NextFunction) {
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));

  try {
    const plan = await prisma.dietPlan.findUnique({
      where: { id: parsed.data.id },
      select: {
        id: true,
        content: true,
        patientId: true,
        patient: {
          select: {
            sex: true,
            birthYear: true,
            birthDate: true,
          },
        },
      },
    });

    if (!plan) throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');

    // Access check
    const role = req.user?.role;
    if (role === 'PATIENT' && plan.patientId !== req.user?.patientId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    // Decrypt content (always — DB stores encrypted JSON object)
    const content = decryptJson(plan.content) as Record<string, unknown>;

    // Determine patient age
    let age: number | null = null;
    if (plan.patient?.birthDate) {
      age = Math.floor((Date.now() - new Date(plan.patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    } else if (plan.patient?.birthYear) {
      age = new Date().getFullYear() - plan.patient.birthYear;
    }

    // Get patient supplements from latest interview
    const interview = await prisma.interview.findFirst({
      where: { patientId: plan.patientId },
      orderBy: { createdAt: 'desc' },
      select: { answers: true },
    });

    let supplements: string[] = [];
    let medications: string[] = [];
    if (interview?.answers) {
      const answers = typeof interview.answers === 'string'
        ? decryptJson(interview.answers as string)
        : interview.answers as Record<string, unknown>;
      const ans = answers as Record<string, unknown>;
      supplements = (ans.supplements as string[]) ?? [];
      medications = (ans.medications as string[]) ?? [];
    }

    const report = await analyzePlanMicronutrients(
      content as { days?: Array<{ day: string; meals: Array<{ name: string; items: Array<{ name: string; grams?: number; ingredients?: Array<{ name: string; grams: number }> }> }> }> },
      plan.patient?.sex ?? null,
      age,
      false, // pregnancy — could be derived from interview
      false, // lactation
      supplements,
    );

    // Add medication interactions
    const medicationInteractions = findMedicationInteractions(medications);

    // For PATIENT role, simplify output (no supplement doses)
    if (role === 'PATIENT') {
      return res.json({
        ok: true,
        report: {
          overallScore: report.overallScore,
          analyzedDays: report.analyzedDays,
          assessments: report.assessments.map((a) => ({
            label: a.label,
            unit: a.unit,
            status: a.status,
            percentOfTarget: a.percentOfTarget,
          })),
          deficiencyCount: report.deficiencies.length,
        },
      });
    }

    return res.json({
      ok: true,
      report,
      medicationInteractions,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /patients/:patientId/micronutrient-trends
 * Compare micronutrient scores between consecutive plans for a patient.
 * Returns an array of plan snapshots with overallScore + key deficiencies.
 */
export async function getTrends(req: Request, res: Response, next: NextFunction) {
  const schema = z.object({ patientId: z.string().cuid() });
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));

  try {
    const plans = await prisma.dietPlan.findMany({
      where: {
        patientId: parsed.data.patientId,
        status: { in: ['PUBLISHED', 'SENT', 'REVIEWED', 'GENERATED'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        content: true,
        patient: {
          select: { sex: true, birthYear: true, birthDate: true },
        },
      },
    });

    if (plans.length === 0) {
      return res.json({ ok: true, trends: [] });
    }

    const patient = plans[0].patient;
    let age: number | null = null;
    if (patient?.birthDate) {
      age = Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    } else if (patient?.birthYear) {
      age = new Date().getFullYear() - patient.birthYear;
    }

    const trends: Array<{
      planId: string;
      createdAt: Date;
      overallScore: number;
      deficiencyCount: number;
      deficiencies: string[];
    }> = [];

    for (const plan of plans) {
      try {
        const content = decryptJson(plan.content) as Record<string, unknown>;

        const report = await analyzePlanMicronutrients(
          content as { days?: Array<{ day: string; meals: Array<{ name: string; items: Array<{ name: string; grams?: number; ingredients?: Array<{ name: string; grams: number }> }> }> }> },
          patient?.sex ?? null,
          age,
        );

        trends.push({
          planId: plan.id,
          createdAt: plan.createdAt,
          overallScore: report.overallScore,
          deficiencyCount: report.deficiencies.length,
          deficiencies: report.deficiencies.map((d) => d.label),
        });
      } catch {
        // skip unparseable plans
      }
    }

    return res.json({ ok: true, trends });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /diet-plans/:id/micronutrients/suggestions
 * "Easy wins" — top products to improve deficient nutrients.
 */
export async function getSuggestions(req: Request, res: Response, next: NextFunction) {
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));

  try {
    const plan = await prisma.dietPlan.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, content: true, patientId: true, patient: { select: { sex: true, birthYear: true, birthDate: true } } },
    });
    if (!plan) throw new AppError(404, 'NOT_FOUND', 'Diet plan not found');

    const content = decryptJson(plan.content) as Record<string, unknown>;

    let age: number | null = null;
    if (plan.patient?.birthDate) {
      age = Math.floor((Date.now() - new Date(plan.patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    } else if (plan.patient?.birthYear) {
      age = new Date().getFullYear() - plan.patient.birthYear;
    }

    const report = await analyzePlanMicronutrients(
      content as { days?: Array<{ day: string; meals: Array<{ name: string; items: Array<{ name: string; grams?: number; ingredients?: Array<{ name: string; grams: number }> }> }> }> },
      plan.patient?.sex ?? null,
      age,
    );

    // For each deficiency, find top 5 products rich in that nutrient
    const suggestions: Array<{ nutrient: string; label: string; products: Array<{ name: string; valuePer100g: number; unit: string }> }> = [];

    for (const def of [...report.deficiencies, ...report.suboptimal].slice(0, 5)) {
      const dbField = def.nutrientKey;
      const products = await prisma.cleanProduct.findMany({
        where: {
          nutrients: { [dbField]: { gt: 0 } },
        },
        select: {
          name: true,
          nutrients: true,
        },
        orderBy: { nutrients: { [dbField]: 'desc' } },
        take: 5,
      });

      suggestions.push({
        nutrient: def.nutrientKey,
        label: def.label,
        products: products.map((p) => ({
          name: p.name,
          valuePer100g: Number((p.nutrients as unknown as Record<string, unknown>)?.[dbField] ?? 0),
          unit: def.unit,
        })),
      });
    }

    return res.json({ ok: true, suggestions });
  } catch (err) {
    next(err);
  }
}
