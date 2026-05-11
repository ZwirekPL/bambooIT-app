import { Router } from 'express';
import * as checkoutController from '../controllers/checkout.controller';

export const checkoutRouter = Router();

// POST /checkout/create-session — creates a Stripe Checkout session for patient orders
checkoutRouter.post('/create-session', checkoutController.createSession);
