import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import { prisma } from '@db';
import * as interviewService from '../services/interview.service';
import { matchProtocolsFromInterview } from '../services/protocolMatcher.service';
import { detectConflicts } from '../services/conflictDetector.service';
import { logAudit } from '../services/audit.service';

const createSchema = z.object({
  answers: z.record(z.unknown()),
  medicalFlags: z.record(z.unknown()).optional(),
});

const patientIdSchema = z.object({ patientId: z.string().cuid() });
const interviewIdSchema = z.object({ id: z.string().cuid() });

const updateSchema = z.object({
  answers: z.record(z.unknown()),
  medicalFlags: z.record(z.unknown()).optional(),
});

export async function create(req: Request, res: Response, next: NextFunction) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const result = await interviewService.createInterview({
      userId: req.user!.sub,
      answers: parsed.data.answers,
      medicalFlags: parsed.data.medicalFlags,
    });
    logAudit({ userId: req.user?.sub, action: 'CREATE_INTERVIEW', resourceType: 'INTERVIEW', resourceId: result.interviewId, ip: req.ip });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  const parsedId = interviewIdSchema.safeParse(req.params);
  if (!parsedId.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid interview id'));
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const result = await interviewService.updateInterview({
      interviewId: parsedId.data.id,
      requesterId: req.user!.sub,
      requesterRole: req.user!.role,
      answers: parsed.data.answers,
      medicalFlags: parsed.data.medicalFlags,
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listByPatient(req: Request, res: Response, next: NextFunction) {
  const parsed = patientIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    const interviews = await interviewService.listInterviewsByPatient(
      parsed.data.patientId,
      req.user!.sub,
      req.user!.role
    );
    return res.json({ ok: true, interviews });
  } catch (err) {
    next(err);
  }
}

// ─── pre-check (30.3.1) ──────────────────────────────────────────────────────

const preCheckSchema = z.object({
  answers: z.record(z.unknown()),
});

export async function preCheck(req: Request, res: Response, next: NextFunction) {
  const parsed = preCheckSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }

  try {
    const { answers } = parsed.data;
    const [matchResult, conflictResult] = await Promise.all([
      matchProtocolsFromInterview(answers),
      detectConflicts(answers),
    ]);

    return res.json({
      ok: true,
      matchedProtocols: matchResult.matchedProtocols.map((m) => ({
        protocolId: m.protocolId,
        protocolName: m.protocolName,
        interviewField: m.interviewField,
        interviewValue: m.interviewValue,
        priority: m.priority,
      })),
      conflicts: conflictResult.conflicts.map((c) => ({
        conflictId: c.conflictId,
        description: `${c.triggerAField}=${c.triggerAValue} vs ${c.triggerBField}=${c.triggerBValue}`,
        severity: c.severity,
        messageKey: c.messageKey,
        winnerSide: c.winnerSide,
        triggerA: { field: c.triggerAField, value: c.triggerAValue },
        triggerB: { field: c.triggerBField, value: c.triggerBValue },
        safeOption: { label: 'Kontynuuj bezpiecznie', action: 'REMOVE_PREFERENCE' },
        consultOption: { label: 'Konsultacja z dietetykiem — 399 zł', price: 399, action: 'CONSULTATION' },
        cancelOption: { label: 'Anuluj i napisz do nas', action: 'CANCEL', email: 'kontakt@e-dietetyk.com' },
      })),
      hasBlockingConflict: conflictResult.hasBlockingConflict,
    });
  } catch (err) {
    next(err);
  }
}

export async function getLatest(req: Request, res: Response, next: NextFunction) {
  const parsed = patientIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    const interview = await interviewService.getLatestInterview(
      parsed.data.patientId,
      req.user!.sub,
      req.user!.role
    );
    logAudit({ userId: req.user?.sub, action: 'VIEW_INTERVIEW', resourceType: 'INTERVIEW', resourceId: interview?.id, ip: req.ip });
    return res.json({ ok: true, interview });
  } catch (err) {
    next(err);
  }
}

// ─── request interview update (IW-19) ────────────────────────────────────────

export async function requestUpdate(req: Request, res: Response, next: NextFunction) {
  const parsed = patientIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    await interviewService.requestInterviewUpdate(
      parsed.data.patientId,
      req.user!.sub,
      req.user!.role,
    );
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─── diff two interviews (IW-9) ──────────────────────────────────────────────

const diffParamsSchema = z.object({ id1: z.string().cuid(), id2: z.string().cuid() });

export async function diff(req: Request, res: Response, next: NextFunction) {
  const parsed = diffParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid interview ids'));
  }

  try {
    const result = await interviewService.diffInterviews(
      parsed.data.id1,
      parsed.data.id2,
      req.user!.sub,
      req.user!.role,
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── matched protocols for patient (30.7.1) ─────────────────────────────────

export async function getMatchedProtocols(req: Request, res: Response, next: NextFunction) {
  const parsed = patientIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid patient id'));
  }

  try {
    const result = await interviewService.getMatchedProtocolsForPatient(
      parsed.data.patientId,
      req.user!.sub,
      req.user!.role,
    );

    // 55.3: Add suggested protocol vs active protocol comparison
    const dietitianId = req.user!.sub;
    const activeAccess = await prisma.dietitianProtocolAccess.findFirst({
      where: { dietitianId, isActive: true },
      include: { protocol: { select: { id: true, name: true } } },
    });

    const matchedProtocols = (result as { protocols?: Array<{ id: string; name: string }> }).protocols ?? [];
    const suggested = matchedProtocols.length > 0 ? matchedProtocols[0] : null;
    const isOptimalProtocolActive = suggested
      ? activeAccess?.protocolId === suggested.id
      : true;

    return res.json({
      ok: true,
      ...result,
      suggestedProtocolId: suggested?.id ?? null,
      suggestedProtocolName: suggested?.name ?? null,
      activeProtocolId: activeAccess?.protocolId ?? null,
      activeProtocolName: activeAccess?.protocol?.name ?? null,
      isOptimalProtocolActive,
    });
  } catch (err) {
    next(err);
  }
}
