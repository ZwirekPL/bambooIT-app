import { prisma } from '@db';
import { AppError } from '../utils/errors';

export interface CreateCheckInData {
  patientId: string;
  weightKg?: number;
  compliance?: number;
  hunger?: number;
  energy?: number;
  sleep?: number;
  activity?: number;
  notes?: string;
  // 79.2: GI/digestion fields
  digestion?: number;    // 1-10
  bloating?: boolean;
  stoolBristol?: number; // 1-7
}

export async function createCheckIn(data: CreateCheckInData) {
  const patient = await prisma.patient.findFirst({
    where: { id: data.patientId, user: { deletedAt: null } },
  });

  if (!patient) {
    throw new AppError(404, 'NOT_FOUND', 'Patient not found');
  }

  return prisma.checkIn.create({
    data: {
      patientId: data.patientId,
      weightKg: data.weightKg,
      compliance: data.compliance,
      hunger: data.hunger,
      energy: data.energy,
      sleep: data.sleep,
      activity: data.activity,
      notes: data.notes,
      // 79.2: GI fields
      digestion: data.digestion,
      bloating: data.bloating,
      stoolBristol: data.stoolBristol,
    },
  });
}

export async function listCheckIns(patientId: string, limit = 20, page = 1) {
  const skip = (page - 1) * limit;

  const [checkIns, total] = await prisma.$transaction([
    prisma.checkIn.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.checkIn.count({ where: { patientId } }),
  ]);

  return { checkIns, total, page, limit };
}

export async function getLatestCheckIn(patientId: string) {
  return prisma.checkIn.findFirst({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
  });
}
