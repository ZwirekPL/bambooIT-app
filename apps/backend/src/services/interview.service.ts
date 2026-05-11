import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { encryptJson, decryptJson } from '../utils/encryption';
import { sanitizePii } from '../utils/pii';
import { runGenerationPipeline } from './planPipeline.service';
import { matchProtocolsFromInterview, type MatchedProtocol } from './protocolMatcher.service';
import { detectConflicts } from './conflictDetector.service';
import { mergeProtocols } from './protocolMerger.service';
import { logAudit } from './audit.service';
import {
  sendInterviewSubmittedToDietitian,
  sendInterviewConfirmationToPatient,
  sendInterviewUpdateRequestEmail,
} from '../utils/email';

// ─── FrequentInput tracking (PRE.9) ──────────────────────────────────────────

const TRACKED_FIELDS = ['dislikes', 'additionalNotes', 'chronicDiseasesOther', 'medicationsOther'] as const;

async function trackFrequentInputs(answers: Record<string, unknown>): Promise<void> {
  const ops: Promise<unknown>[] = [];
  for (const field of TRACKED_FIELDS) {
    const raw = answers[field];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const value = raw.trim().slice(0, 500); // cap to 500 chars
    ops.push(
      prisma.frequentInput.upsert({
        where: { field_value: { field, value } },
        create: { field, value, count: 1 },
        update: { count: { increment: 1 } },
      }),
    );
  }
  await Promise.all(ops);
}

// ─── email helpers ───────────────────────────────────────────────────────────

async function sendNotificationEmails(patientId: string, _interviewId: string, dashboardUrl: string) {
  const patientRecord = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      user: { select: { email: true } },
      dietitian: { select: { email: true } },
    },
  });

  if (!patientRecord) return;

  const patientEmail = patientRecord.user.email;
  const patientFirstName = patientRecord.firstName ?? 'Pacjent';
  const patientName = [patientRecord.firstName, patientRecord.lastName].filter(Boolean).join(' ') || 'Pacjent';

  // IW-16: Confirm to patient
  await sendInterviewConfirmationToPatient(patientEmail, patientFirstName, dashboardUrl);

  // IW-15: Notify dietitian (if assigned)
  if (patientRecord.dietitian?.email) {
    await sendInterviewSubmittedToDietitian(
      patientRecord.dietitian.email,
      '',
      patientName,
      patientId,
      dashboardUrl,
    );
  }
}

// ─── create ──────────────────────────────────────────────────────────────────

interface CreateInterviewInput {
  userId: string;
  answers: Record<string, unknown>;
  medicalFlags?: Record<string, unknown>;
}

export async function createInterview({ userId, answers, medicalFlags }: CreateInterviewInput) {
  const patient = await prisma.patient.findUnique({
    where: { userId },
    select: {
      id: true,
      sex: true,
      birthYear: true,
      birthDate: true,
      heightCm: true,
      weightKg: true,
    },
  });

  if (!patient) {
    throw new AppError(404, 'NOT_FOUND', 'Patient profile not found');
  }

  // If patient provided current weight in the interview, update their profile
  const currentWeightKg = typeof answers.currentWeightKg === 'number' ? answers.currentWeightKg : null;
  if (currentWeightKg && currentWeightKg > 0) {
    await prisma.patient.update({
      where: { id: patient.id },
      data: { weightKg: currentWeightKg },
    });
    patient.weightKg = currentWeightKg as unknown as typeof patient.weightKg;
  }

  const profileSnapshot = {
    sex: patient.sex,
    birthYear: patient.birthYear,
    birthDate: patient.birthDate,
    heightCm: patient.heightCm,
    weightKg: patient.weightKg ? Number(patient.weightKg) : null,
  };

  // Server-side PII sanitization (defense in depth — 65.1.3)
  const piiFields = ['activityTypesOther', 'chronicDiseasesOther', 'medicationsOther', 'dislikedFoodsOther', 'preferredFoodsOther', 'supplementsOther', 'additionalNotes'] as const;
  const sanitizedAnswers: Record<string, unknown> = { ...answers };
  for (const field of piiFields) {
    if (typeof sanitizedAnswers[field] === 'string') {
      sanitizedAnswers[field] = sanitizePii(sanitizedAnswers[field] as string);
    }
  }

  const interview = await prisma.interview.create({
    data: {
      patientId: patient.id,
      answers: encryptJson(sanitizedAnswers),
      medicalFlags: medicalFlags ? encryptJson(medicalFlags) : undefined,
      profileSnapshot,
    },
  });

  // PRE.9: Track free-text field values for future checkbox promotion (fire-and-forget)
  trackFrequentInputs(answers).catch(() => {});

  // ── 30.3.2: Auto-match protocols + detect conflicts ────────────────────────
  let matchedProtocols: MatchedProtocol[] = [];
  let hasBlockingConflict = false;

  try {
    const [matchResult, conflictResult] = await Promise.all([
      matchProtocolsFromInterview(answers),
      detectConflicts(answers),
    ]);

    matchedProtocols = matchResult.matchedProtocols;
    hasBlockingConflict = conflictResult.hasBlockingConflict;

    if (matchedProtocols.length > 0) {
      logAudit({
        action: 'PROTOCOL_AUTO_MATCHED',
        resourceType: 'INTERVIEW',
        resourceId: interview.id,
        metadata: {
          matchedCount: matchedProtocols.length,
          protocols: matchedProtocols.map((m) => ({
            name: m.protocolName,
            field: m.interviewField,
            value: m.interviewValue,
            priority: m.priority,
          })),
        },
      });
    }

    if (conflictResult.conflicts.length > 0) {
      logAudit({
        action: 'PROTOCOL_CONFLICT_DETECTED',
        resourceType: 'INTERVIEW',
        resourceId: interview.id,
        metadata: {
          conflicts: conflictResult.conflicts.map((c) => ({
            severity: c.severity,
            a: `${c.triggerAField}=${c.triggerAValue}`,
            b: `${c.triggerBField}=${c.triggerBValue}`,
          })),
          hasBlocking: hasBlockingConflict,
        },
      });
    }

    // Double safety: if BLOCK conflict slipped past pre-check, don't trigger pipeline
    if (hasBlockingConflict) {
      console.warn(`[interview] Blocking conflict detected for interview ${interview.id}. Pipeline skipped.`);
      return {
        patientId: patient.id,
        interviewId: interview.id,
        blocked: true,
        reason: 'BLOCKING_CONFLICT',
      };
    }
  } catch (err) {
    console.error('[interview] Protocol matching failed, continuing with default pipeline:', err instanceof Error ? err.message : err);
  }

  // Fire-and-forget: run full generation pipeline (nutrition → segment → plan)
  const activityLevel = (answers.activityLevel as string) || 'sedentary';
  const mainGoal = (answers.mainGoal as string) || 'maintain_weight';
  const activityTypes = Array.isArray(answers.activityTypes) ? (answers.activityTypes as string[]) : [];
  const workoutsPerWeek = typeof answers.workoutsPerWeek === 'number' ? answers.workoutsPerWeek : 0;
  const workoutDurationMin = typeof answers.workoutDurationMin === 'number' ? answers.workoutDurationMin : 0;
  runGenerationPipeline(
    patient.id, activityLevel, mainGoal, activityTypes, workoutsPerWeek, workoutDurationMin,
    matchedProtocols.length > 0 ? matchedProtocols : undefined,
  ).catch(() => {});

  // IW-15 & IW-16: Fire-and-forget notification emails
  const dashboardUrl = process.env.CORS_ORIGIN ?? 'https://e-dietetyk.com';
  sendNotificationEmails(patient.id, interview.id, dashboardUrl).catch(() => {});

  return { patientId: patient.id, interviewId: interview.id };
}

// ─── update ──────────────────────────────────────────────────────────────────

interface UpdateInterviewInput {
  interviewId: string;
  requesterId: string;
  requesterRole: string;
  answers: Record<string, unknown>;
  medicalFlags?: Record<string, unknown>;
}

export async function updateInterview({
  interviewId,
  requesterId,
  requesterRole,
  answers,
  medicalFlags,
}: UpdateInterviewInput) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: { patient: { select: { id: true, userId: true, dietitianId: true } } },
  });

  if (!interview) {
    throw new AppError(404, 'NOT_FOUND', 'Interview not found');
  }

  // Access control
  if (requesterRole === 'PATIENT') {
    if (interview.patient.userId !== requesterId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }
  } else if (requesterRole === 'DIETITIAN') {
    const { dietitianId } = interview.patient;
    if (dietitianId !== null && dietitianId !== requesterId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }
  }

  // Server-side PII sanitization
  const piiFields = ['activityTypesOther', 'chronicDiseasesOther', 'medicationsOther', 'dislikedFoodsOther', 'preferredFoodsOther', 'supplementsOther', 'additionalNotes'] as const;
  const sanitizedAnswers: Record<string, unknown> = { ...answers };
  for (const field of piiFields) {
    if (typeof sanitizedAnswers[field] === 'string') {
      sanitizedAnswers[field] = sanitizePii(sanitizedAnswers[field] as string);
    }
  }

  await prisma.interview.update({
    where: { id: interviewId },
    data: {
      answers: encryptJson(sanitizedAnswers),
      medicalFlags: medicalFlags ? encryptJson(medicalFlags) : undefined,
    },
  });

  // Fire-and-forget: re-run FrequentInput tracking
  trackFrequentInputs(answers).catch(() => {});

  logAudit({
    userId: requesterId,
    action: 'UPDATE_INTERVIEW',
    resourceType: 'INTERVIEW',
    resourceId: interviewId,
  });

  return { ok: true, interviewId };
}

// ─── list by patient ──────────────────────────────────────────────────────────

export async function listInterviewsByPatient(patientId: string, requesterId: string, requesterRole: string) {
  if (requesterRole === 'DIETITIAN') {
    // DIETITIAN can access own patients and unassigned patients
    const patient = await prisma.patient.findFirst({ where: { id: patientId } });
    if (!patient || (patient.dietitianId !== null && patient.dietitianId !== requesterId)) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }
  }

  return prisma.interview.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, patientId: true },
  });
}

// ─── get latest ───────────────────────────────────────────────────────────────

export async function getLatestInterview(patientId: string, requesterId: string, requesterRole: string) {
  // PATIENT can only see their own interview
  if (requesterRole === 'PATIENT') {
    const ownPatient = await prisma.patient.findUnique({ where: { userId: requesterId } });
    if (!ownPatient || ownPatient.id !== patientId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }
  }

  // DIETITIAN can access own patients and unassigned patients
  if (requesterRole === 'DIETITIAN') {
    const patient = await prisma.patient.findFirst({ where: { id: patientId } });
    if (!patient || (patient.dietitianId !== null && patient.dietitianId !== requesterId)) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }
  }

  const interview = await prisma.interview.findFirst({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
  });

  if (!interview) {
    throw new AppError(404, 'NOT_FOUND', 'Interview not found');
  }

  return {
    ...interview,
    answers: decryptJson(interview.answers) as Record<string, unknown>,
    medicalFlags: interview.medicalFlags
      ? (decryptJson(interview.medicalFlags) as Record<string, unknown>)
      : null,
  };
}

// ─── diff two interviews ──────────────────────────────────────────────────────

export interface InterviewDiffField {
  field: string;
  old: unknown;
  new: unknown;
}

export async function diffInterviews(
  id1: string,
  id2: string,
  requesterId: string,
  requesterRole: string,
): Promise<{ fields: InterviewDiffField[]; interviewOldId: string; interviewNewId: string }> {
  const [a, b] = await Promise.all([
    prisma.interview.findUnique({
      where: { id: id1 },
      include: { patient: { select: { id: true, userId: true, dietitianId: true } } },
    }),
    prisma.interview.findUnique({
      where: { id: id2 },
      include: { patient: { select: { id: true, userId: true, dietitianId: true } } },
    }),
  ]);

  if (!a || !b) throw new AppError(404, 'NOT_FOUND', 'One or both interviews not found');
  if (a.patientId !== b.patientId) throw new AppError(400, 'INVALID_REQUEST', 'Interviews belong to different patients');

  // Access control
  if (requesterRole === 'PATIENT') {
    if (a.patient.userId !== requesterId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
  } else if (requesterRole === 'DIETITIAN') {
    const { dietitianId } = a.patient;
    if (dietitianId !== null && dietitianId !== requesterId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  // Ensure chronological order: older first
  const [older, newer] = a.createdAt <= b.createdAt ? [a, b] : [b, a];

  const answersOld = decryptJson(older.answers) as Record<string, unknown>;
  const answersNew = decryptJson(newer.answers) as Record<string, unknown>;

  const allKeys = new Set([...Object.keys(answersOld), ...Object.keys(answersNew)]);
  const fields: InterviewDiffField[] = [];

  for (const key of allKeys) {
    const oldVal = answersOld[key];
    const newVal = answersNew[key];
    const oldStr = JSON.stringify(oldVal ?? null);
    const newStr = JSON.stringify(newVal ?? null);
    if (oldStr !== newStr) {
      fields.push({ field: key, old: oldVal ?? null, new: newVal ?? null });
    }
  }

  return { fields, interviewOldId: older.id, interviewNewId: newer.id };
}

// ─── matched protocols for patient (30.7) ────────────────────────────────────

export async function getMatchedProtocolsForPatient(
  patientId: string,
  requesterId: string,
  requesterRole: string,
) {
  // Access control: DIETITIAN can access own patients and unassigned
  if (requesterRole === 'DIETITIAN') {
    const patient = await prisma.patient.findFirst({ where: { id: patientId } });
    if (!patient || (patient.dietitianId !== null && patient.dietitianId !== requesterId)) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }
  }

  // Get latest interview
  const interview = await prisma.interview.findFirst({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
  });

  if (!interview) {
    return { matchedProtocols: [], conflicts: [], mergedProtocol: null, interviewId: null };
  }

  const answers = decryptJson(interview.answers) as Record<string, unknown>;

  // Run matcher + conflict detector + merger
  const { matchedProtocols } = await matchProtocolsFromInterview(answers);
  const { conflicts, hasBlockingConflict } = await detectConflicts(answers);
  const mainGoal = typeof answers.mainGoal === 'string' ? answers.mainGoal : null;
  const mergedProtocol = matchedProtocols.length > 0
    ? await mergeProtocols(matchedProtocols, null, mainGoal)
    : null;

  return {
    matchedProtocols,
    conflicts,
    hasBlockingConflict,
    mergedProtocol: mergedProtocol ? {
      name: mergedProtocol.name,
      macroRatios: mergedProtocol.macroRatios,
      caloricAdjustments: mergedProtocol.caloricAdjustments,
      minProteinPerKg: mergedProtocol.minProteinPerKg,
      maxProteinPerKg: mergedProtocol.maxProteinPerKg,
      defaultMealCount: mergedProtocol.defaultMealCount,
      foodRestrictions: mergedProtocol.foodRestrictions,
      avoidFoodCategories: mergedProtocol.avoidFoodCategories,
      preferredCuisines: mergedProtocol.preferredCuisines,
      sourceProtocols: mergedProtocol.sourceProtocols,
      mergeExplanation: mergedProtocol.mergeExplanation,
    } : null,
    interviewId: interview.id,
  };
}

// ─── IW-19: request interview update ─────────────────────────────────────────

export async function requestInterviewUpdate(
  patientId: string,
  requesterId: string,
  requesterRole: string,
): Promise<void> {
  // Only DIETITIAN or ADMIN can send this request
  if (requesterRole !== 'DIETITIAN' && requesterRole !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'Only a dietitian can request an interview update');
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      user: { select: { email: true } },
    },
  });

  if (!patient) {
    throw new AppError(404, 'NOT_FOUND', 'Patient not found');
  }

  // DIETITIAN can only request for own patients
  if (requesterRole === 'DIETITIAN' && patient.dietitianId !== requesterId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  const patientEmail = patient.user.email;
  const patientFirstName = patient.firstName ?? '';
  const dietitianName = 'Twój dietetyk';
  const dashboardUrl = process.env.CORS_ORIGIN ?? 'https://e-dietetyk.com';
  const interviewUrl = `${dashboardUrl}/dashboard/wywiad`;

  await sendInterviewUpdateRequestEmail(patientEmail, patientFirstName, dietitianName, interviewUrl);

  logAudit({
    userId: requesterId,
    action: 'REQUEST_INTERVIEW_UPDATE',
    resourceType: 'INTERVIEW',
    metadata: { patientId },
  });
}
