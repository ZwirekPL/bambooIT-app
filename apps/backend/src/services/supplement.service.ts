/**
 * Supplement Prescription Service (79.6)
 *
 * Manages supplement prescriptions assigned by dietitians and tracks
 * patient compliance via check-in supplementsTaken field.
 */

import { prisma } from '@db';
import { AppError } from '../utils/errors';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateSupplementData {
  patientId: string;
  dietitianId?: string;
  nutrientKey: string;
  label: string;
  dose: string;
  unit: string;
  frequency: string;
  startDate?: Date;
  endDate?: Date;
  notes?: string;
}

export interface SupplementComplianceResult {
  supplementId: string;
  label: string;
  nutrientKey: string;
  totalCheckIns: number;
  takenCount: number;
  compliancePct: number;
  streak: number;        // consecutive days taken
  lastTaken: string | null;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createSupplement(data: CreateSupplementData) {
  return prisma.supplementPrescription.create({
    data: {
      patientId: data.patientId,
      dietitianId: data.dietitianId ?? null,
      nutrientKey: data.nutrientKey,
      label: data.label,
      dose: data.dose,
      unit: data.unit,
      frequency: data.frequency,
      startDate: data.startDate ?? new Date(),
      endDate: data.endDate ?? null,
      notes: data.notes ?? null,
    },
  });
}

export async function listSupplements(patientId: string, activeOnly = false) {
  return prisma.supplementPrescription.findMany({
    where: {
      patientId,
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function updateSupplement(
  id: string,
  patientId: string,
  data: Partial<Pick<CreateSupplementData, 'label' | 'dose' | 'unit' | 'frequency' | 'endDate' | 'notes'>> & { active?: boolean },
) {
  const existing = await prisma.supplementPrescription.findFirst({ where: { id, patientId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Supplement not found');

  return prisma.supplementPrescription.update({
    where: { id },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.dose !== undefined && { dose: data.dose }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.frequency !== undefined && { frequency: data.frequency }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });
}

export async function deleteSupplement(id: string, patientId: string) {
  const existing = await prisma.supplementPrescription.findFirst({ where: { id, patientId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Supplement not found');
  await prisma.supplementPrescription.delete({ where: { id } });
}

// ─── Compliance ───────────────────────────────────────────────────────────────

export async function getSupplementCompliance(patientId: string): Promise<SupplementComplianceResult[]> {
  const supplements = await prisma.supplementPrescription.findMany({
    where: { patientId, active: true },
    orderBy: { createdAt: 'desc' },
  });

  if (supplements.length === 0) return [];

  // Load check-ins with supplementsTaken in the last 90 days
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const checkIns = await prisma.checkIn.findMany({
    where: { patientId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, supplementsTaken: true },
  });

  return supplements.map((supp) => {
    // Filter check-ins after supplement start date
    const relevantCheckIns = checkIns.filter(
      (ci) => ci.createdAt >= supp.startDate,
    );

    let takenCount = 0;
    let streak = 0;
    let lastTaken: string | null = null;
    let streakBroken = false;

    for (const ci of relevantCheckIns) {
      const taken = extractTaken(ci.supplementsTaken, supp.id);
      if (taken) {
        takenCount++;
        if (!lastTaken) lastTaken = ci.createdAt.toISOString();
        if (!streakBroken) streak++;
      } else {
        if (!streakBroken && lastTaken === null) {
          // Streak only counts from most recent check-ins backward
          streakBroken = true;
        }
      }
    }

    const totalCheckIns = relevantCheckIns.length;
    const compliancePct = totalCheckIns > 0 ? Math.round((takenCount / totalCheckIns) * 100) : 0;

    return {
      supplementId: supp.id,
      label: supp.label,
      nutrientKey: supp.nutrientKey,
      totalCheckIns,
      takenCount,
      compliancePct,
      streak,
      lastTaken,
    };
  });
}

function extractTaken(supplementsTaken: unknown, supplementId: string): boolean {
  if (!Array.isArray(supplementsTaken)) return false;
  const entry = (supplementsTaken as Array<{ supplementId: string; taken: boolean }>)
    .find((e) => e.supplementId === supplementId);
  return entry?.taken ?? false;
}
