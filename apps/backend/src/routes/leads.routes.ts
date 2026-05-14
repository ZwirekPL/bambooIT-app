import { Router } from 'express';
import * as leadsController from '../controllers/leads.controller';

export const leadsRouter = Router();

// Public — marketing site lead capture (rate limited at server.ts mount).
leadsRouter.post('/audit', leadsController.submitAudit);
leadsRouter.post('/contact', leadsController.submitContact);
