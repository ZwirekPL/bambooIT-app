import { Router } from 'express';
import { stripeWebhook } from '../controllers/webhook.controller';

export const webhookRouter = Router();

// NOTE: This route must be mounted BEFORE express.json() in server.ts
// so that req.body contains the raw Buffer needed for Stripe signature verification.
webhookRouter.post('/stripe', stripeWebhook);

// n8n webhook removed in 33.11 — AI calls OpenAI directly via BullMQ workers
