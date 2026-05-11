import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { encryptString, decryptString } from '../utils/encryption';

export interface CreateNoteData {
  patientId: string;
  dietitianId: string;
  dietPlanId?: string;
  content: string;
}

const noteInclude = {
  dietitian: {
    select: {
      id: true,
      email: true,
      dietitianProfile: { select: { code: true } },
    },
  },
} as const;

type NoteWithEncryptedContent<T extends { content: string }> = T;

function decryptNote<T extends { content: string }>(note: T): T {
  return { ...note, content: decryptString(note.content) };
}

export async function createNote(data: CreateNoteData, dietitianUserId: string, role: string) {
  if (role === 'DIETITIAN') {
    const patient = await prisma.patient.findFirst({
      where: { id: data.patientId, dietitianId: dietitianUserId, user: { deletedAt: null } },
    });
    if (!patient) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot add notes to patients not assigned to you');
    }
  }

  if (data.dietPlanId) {
    const plan = await prisma.dietPlan.findFirst({
      where: { id: data.dietPlanId, patientId: data.patientId },
    });
    if (!plan) {
      throw new AppError(400, 'INVALID_DIET_PLAN', 'Diet plan does not belong to this patient');
    }
  }

  const created = await prisma.dietitianNote.create({
    data: {
      patientId: data.patientId,
      dietitianId: data.dietitianId,
      dietPlanId: data.dietPlanId ?? null,
      content: encryptString(data.content),
    },
    include: noteInclude,
  });

  return decryptNote(created);
}

export async function listNotes(patientId: string, dietitianUserId: string, role: string) {
  if (role === 'DIETITIAN') {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, dietitianId: dietitianUserId, user: { deletedAt: null } },
    });
    if (!patient) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }
  }

  const notes = await prisma.dietitianNote.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    include: noteInclude,
  });

  return notes.map(decryptNote);
}

export async function listNotesForPatient(patientUserId: string) {
  const patient = await prisma.patient.findFirst({
    where: { userId: patientUserId, user: { deletedAt: null } },
  });

  if (!patient) {
    throw new AppError(404, 'NOT_FOUND', 'Patient not found');
  }

  const notes = await prisma.dietitianNote.findMany({
    where: { patientId: patient.id },
    orderBy: { createdAt: 'desc' },
    include: {
      dietitian: {
        select: {
          id: true,
          dietitianProfile: {
            select: { code: true },
          },
        },
      },
    },
  });

  return notes.map(decryptNote);
}
