/**
 * Email Campaign Routes (84.4)
 *
 * Admin-only endpoints for managing email campaigns.
 * Master switch: FeatureFlag 'EMAIL_CAMPAIGNS_ENABLED'
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { apiError } from '../utils/errors';
import * as campaignService from '../services/emailCampaign.service';
import { executeCampaign, detectTriggers } from '../services/emailCampaignWorker.service';
import { invalidateFlagCache } from '../services/featureFlag.service';
import { prisma } from '@db';

export const emailCampaignRouter = Router();

// All routes require ADMIN role
const adminOnly = requireAuth('ADMIN');

// ─── Master switch status ───────────────────────────────────────────────────

emailCampaignRouter.get('/status', adminOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const enabled = await campaignService.isCampaignSystemEnabled();
    return res.json({ ok: true, enabled });
  } catch (err) { next(err); }
});

// ─── Toggle master switch ──────────────────────────────────────────────────

emailCampaignRouter.post('/toggle-system', adminOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.featureFlag.findUnique({ where: { key: 'EMAIL_CAMPAIGNS_ENABLED' } });
    let enabled: boolean;
    if (existing) {
      const updated = await prisma.featureFlag.update({
        where: { key: 'EMAIL_CAMPAIGNS_ENABLED' },
        data: { enabled: !existing.enabled },
      });
      enabled = updated.enabled;
    } else {
      await prisma.featureFlag.create({
        data: { key: 'EMAIL_CAMPAIGNS_ENABLED', name: 'Email Campaigns', description: 'Master switch for email campaign system', enabled: true },
      });
      enabled = true;
    }
    invalidateFlagCache();
    return res.json({ ok: true, enabled });
  } catch (err) { next(err); }
});

// ─── List campaigns ─────────────────────────────────────────────────────────

emailCampaignRouter.get('/', adminOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const campaigns = await campaignService.listCampaigns();
    return res.json({ ok: true, campaigns });
  } catch (err) { next(err); }
});

// ─── Get campaign with stats ────────────────────────────────────────────────

emailCampaignRouter.get('/:id', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  const id = z.string().cuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  try {
    const campaign = await campaignService.getCampaign(id.data);
    const stats = await campaignService.getCampaignStats(id.data);
    return res.json({ ok: true, campaign, stats });
  } catch (err) { next(err); }
});

// ─── Create campaign ────────────────────────────────────────────────────────

const createSchema = z.object({
  type: z.enum(['WEEKLY_SUMMARY', 'DIETITIAN_SUMMARY', 'TRIGGER_PLATEAU', 'TRIGGER_MILESTONE', 'TRIGGER_INACTIVE', 'TRIGGER_PLAN_EXPIRY', 'MOTIVATION', 'CUSTOM']),
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  subjectVariantB: z.string().max(500).optional(),
  bodyTemplate: z.string().optional(),
  schedule: z.string().max(50).optional(),
  segmentation: z.string().max(50).optional(),
  enabled: z.boolean().optional(),
});

emailCampaignRouter.post('/', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'));
  try {
    const campaign = await campaignService.createCampaign(parsed.data);
    return res.status(201).json({ ok: true, campaign });
  } catch (err) { next(err); }
});

// ─── Update campaign ────────────────────────────────────────────────────────

emailCampaignRouter.patch('/:id', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  const id = z.string().cuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  try {
    const campaign = await campaignService.updateCampaign(id.data, req.body);
    return res.json({ ok: true, campaign });
  } catch (err) { next(err); }
});

// ─── Delete campaign ────────────────────────────────────────────────────────

emailCampaignRouter.delete('/:id', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  const id = z.string().cuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  try {
    await campaignService.deleteCampaign(id.data);
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Duplicate campaign ──────────────────────────────────────────────────────

emailCampaignRouter.post('/:id/duplicate', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  const id = z.string().cuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  try {
    const campaign = await campaignService.duplicateCampaign(id.data);
    return res.status(201).json({ ok: true, campaign });
  } catch (err) { next(err); }
});

// ─── Send test (dry run) ───────────────────────────────────────────────────

emailCampaignRouter.post('/:id/send-test', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  const id = z.string().cuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  try {
    const result = await executeCampaign(id.data, true);
    return res.json({ ok: true, dryRun: true, ...result });
  } catch (err) { next(err); }
});

// ─── Execute campaign (send now) ────────────────────────────────────────────

emailCampaignRouter.post('/:id/execute', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  const id = z.string().cuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  try {
    const result = await executeCampaign(id.data);
    return res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

// ─── Detect triggers (preview) ──────────────────────────────────────────────

emailCampaignRouter.get('/triggers/detect', adminOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const triggers = await detectTriggers();
    return res.json({ ok: true, triggers, count: triggers.length });
  } catch (err) { next(err); }
});

// ─── Tracking pixel (open) ──────────────────────────────────────────────────

emailCampaignRouter.get('/track/open/:sendId', async (req: Request, res: Response) => {
  try {
    await campaignService.trackOpen(req.params.sendId);
  } catch { /* ignore errors for tracking pixel */ }
  // Return 1x1 transparent PNG
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'no-store');
  return res.send(pixel);
});

// ─── Tracking link (click) ──────────────────────────────────────────────────

emailCampaignRouter.get('/track/click/:sendId', async (req: Request, res: Response) => {
  const redirect = (req.query.url as string) ?? '/';
  try {
    await campaignService.trackClick(req.params.sendId);
  } catch { /* ignore */ }
  return res.redirect(redirect);
});

// ─── Unsubscribe (public — no auth required) ────────────────────────────────

emailCampaignRouter.get('/unsubscribe/:sendId', async (req: Request, res: Response) => {
  try {
    const send = await prisma.emailSend.findUnique({
      where: { id: req.params.sendId },
      select: { recipientId: true },
    });
    if (send) {
      // Disable weeklySummary notification preference for this user
      await prisma.notificationPreferences.upsert({
        where: { userId: send.recipientId },
        update: { weeklySummary: false },
        create: { userId: send.recipientId, weeklySummary: false },
      });
    }
  } catch { /* ignore errors */ }
  // Redirect to a confirmation page
  const appUrl = process.env.APP_URL ?? 'https://e-dietetyk.com';
  return res.redirect(`${appUrl}/?unsubscribed=1`);
});

// ─── List recent sends for a campaign ───────────────────────────────────────

emailCampaignRouter.get('/:id/sends', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  const id = z.string().cuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  try {
    const sends = await campaignService.listSends(id.data);
    return res.json({ ok: true, sends });
  } catch (err) { next(err); }
});
