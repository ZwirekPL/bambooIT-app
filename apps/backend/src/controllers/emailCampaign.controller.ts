import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as service from '../services/emailCampaign.service';
import { logAudit } from '../services/audit.service';

const audienceEnum = z.enum(['ALL_CLIENTS', 'LEADS', 'TEST']);

const createBody = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  audience: audienceEnum,
});

const updateBody = z.object({
  subject: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(20000).optional(),
  audience: audienceEnum.optional(),
});

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    const [campaigns, audienceCounts] = await Promise.all([
      service.listCampaigns(),
      service.getAudienceCounts(),
    ]);
    return res.json({ ok: true, campaigns, audienceCounts });
  } catch (err) {
    next(err);
  }
}

export async function audienceCounts(_req: Request, res: Response, next: NextFunction) {
  try {
    const counts = await service.getAudienceCounts();
    return res.json({ ok: true, audienceCounts: counts });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const campaign = await service.getCampaign(req.params.id);
    return res.json({ ok: true, campaign });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid campaign payload'));
  }
  try {
    const campaign = await service.createCampaign(parsed.data, req.user!.sub);
    logAudit({
      userId: req.user!.sub,
      action: 'EMAIL_CAMPAIGN_CREATED',
      resourceType: 'EMAIL_CAMPAIGN',
      resourceId: campaign.id,
      ip: req.ip,
    });
    return res.status(201).json({ ok: true, campaign });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  const parsed = updateBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid campaign payload'));
  }
  try {
    const campaign = await service.updateCampaign(req.params.id, parsed.data);
    return res.json({ ok: true, campaign });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteCampaign(req.params.id);
    logAudit({
      userId: req.user!.sub,
      action: 'EMAIL_CAMPAIGN_DELETED',
      resourceType: 'EMAIL_CAMPAIGN',
      resourceId: req.params.id,
      ip: req.ip,
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function send(req: Request, res: Response, next: NextFunction) {
  try {
    const { campaign, transportConfigured } = await service.sendCampaign(req.params.id, {
      email: req.user!.email,
    });
    logAudit({
      userId: req.user!.sub,
      action: 'EMAIL_CAMPAIGN_SENT',
      resourceType: 'EMAIL_CAMPAIGN',
      resourceId: campaign.id,
      ip: req.ip,
      metadata: {
        audience: campaign.audience,
        recipientCount: campaign.recipientCount,
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount,
        transportConfigured,
      },
    });
    return res.json({ ok: true, campaign, transportConfigured });
  } catch (err) {
    next(err);
  }
}
