import { Router } from 'express';
import * as subscriptionController from '../controllers/subscription.controller';

export const subscriptionRouter = Router();

subscriptionRouter.get('/my', subscriptionController.getMy);
subscriptionRouter.post('/checkout', subscriptionController.createCheckout);
subscriptionRouter.get('/portal', subscriptionController.getPortal);
