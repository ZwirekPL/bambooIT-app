/**
 * Body Measurement Service (79.3)
 *
 * CRUD for body measurements + trend analysis + WHR calculation.
 */

import { prisma, Prisma } from '@db';
import { AppError } from '../utils/errors';

export interface CreateMeasurementInput {
  patientId: string;
  date?: Date;
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  thighCm?: number;
  armCm?: number;
  bodyFatPct?: number;
  notes?: string;
}

export async function createMeasurement(input: CreateMeasurementInput) {
  return prisma.bodyMeasurement.create({
    data: {
      patientId: input.patientId,
      date: input.date ?? new Date(),
      waistCm: input.waistCm,
      hipCm: input.hipCm,
      chestCm: input.chestCm,
      thighCm: input.thighCm,
      armCm: input.armCm,
      bodyFatPct: input.bodyFatPct,
      notes: input.notes,
    },
  });
}

export async function listMeasurements(patientId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [items, total] = await prisma.$transaction([
    prisma.bodyMeasurement.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.bodyMeasurement.count({ where: { patientId } }),
  ]);
  return { items, total, page, limit };
}

export async function deleteMeasurement(id: string, patientId: string) {
  const m = await prisma.bodyMeasurement.findUnique({ where: { id } });
  if (!m) throw new AppError(404, 'NOT_FOUND', 'Measurement not found');
  if (m.patientId !== patientId) throw new AppError(403, 'FORBIDDEN', 'Not your measurement');
  await prisma.bodyMeasurement.delete({ where: { id } });
  return { ok: true };
}

// ─── WHR + Trends ────────────────────────────────────────────────────────────

interface TrendPoint {
  date: string;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  thighCm: number | null;
  armCm: number | null;
  bodyFatPct: number | null;
  whr: number | null;
}

interface TrendSummary {
  field: string;
  first: number | null;
  last: number | null;
  change: number | null;
  changePct: number | null;
  direction: 'up' | 'down' | 'stable' | 'insufficient';
}

function toNum(d: Prisma.Decimal | null | undefined): number | null {
  return d != null ? Number(d) : null;
}

export async function getMeasurementTrends(patientId: string) {
  const measurements = await prisma.bodyMeasurement.findMany({
    where: { patientId },
    orderBy: { date: 'asc' },
    take: 100,
  });

  if (measurements.length === 0) {
    return { points: [], summaries: [], whrInterpretation: null };
  }

  // Build chart points
  const points: TrendPoint[] = measurements.map((m) => {
    const waist = toNum(m.waistCm);
    const hip = toNum(m.hipCm);
    return {
      date: m.date.toISOString().slice(0, 10),
      waistCm: waist,
      hipCm: hip,
      chestCm: toNum(m.chestCm),
      thighCm: toNum(m.thighCm),
      armCm: toNum(m.armCm),
      bodyFatPct: toNum(m.bodyFatPct),
      whr: waist != null && hip != null && hip > 0
        ? Math.round((waist / hip) * 100) / 100
        : null,
    };
  });

  // Build summaries per field
  const fields = ['waistCm', 'hipCm', 'chestCm', 'thighCm', 'armCm', 'bodyFatPct'] as const;
  const summaries: TrendSummary[] = fields.map((field) => {
    const values = points
      .map((p) => p[field])
      .filter((v): v is number => v != null);
    if (values.length < 2) {
      return { field, first: values[0] ?? null, last: values[0] ?? null, change: null, changePct: null, direction: 'insufficient' as const };
    }
    const first = values[0];
    const last = values[values.length - 1];
    const change = Math.round((last - first) * 10) / 10;
    const changePct = first > 0 ? Math.round((change / first) * 1000) / 10 : null;
    const direction = Math.abs(change) < 0.5 ? 'stable' : change > 0 ? 'up' : 'down';
    return { field, first, last, change, changePct, direction };
  });

  // WHR interpretation (latest)
  const lastWhr = points.filter((p) => p.whr != null).pop()?.whr ?? null;
  let whrInterpretation: { whr: number; level: string; label: string } | null = null;
  if (lastWhr != null) {
    // Use patient sex for interpretation
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { sex: true },
    });
    const isMale = patient?.sex === 'male' || patient?.sex === 'M';
    const level = isMale
      ? (lastWhr < 0.90 ? 'healthy' : lastWhr <= 1.0 ? 'moderate' : 'high')
      : (lastWhr < 0.80 ? 'healthy' : lastWhr <= 0.85 ? 'moderate' : 'high');
    const labels: Record<string, string> = {
      healthy: 'Zdrowy zakres',
      moderate: 'Umiarkowane ryzyko',
      high: 'Wysokie ryzyko',
    };
    whrInterpretation = { whr: lastWhr, level, label: labels[level] };
  }

  return { points, summaries, whrInterpretation };
}
