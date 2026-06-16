import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as orderController from '../controllers/order.controller';
import * as opsController from '../controllers/ops.controller';

export const orderRouter = Router();

// CLIENT endpoints
orderRouter.get('/my', requireAuth('CLIENT'), orderController.listMyOrders);
orderRouter.get('/my/hours', requireAuth('CLIENT'), opsController.getMyHours);
orderRouter.get('/my/portal', requireAuth('CLIENT'), orderController.getMyPortal);
orderRouter.get('/my/invoices', requireAuth('CLIENT'), orderController.listMyInvoices);
orderRouter.post('/my', requireAuth('CLIENT'), orderController.createMyOrder);
orderRouter.post('/my/cancel-subscription', requireAuth('CLIENT'), orderController.cancelMySubscription);
orderRouter.post('/my/resume-subscription', requireAuth('CLIENT'), orderController.resumeMySubscription);
orderRouter.get('/my/can-withdraw', requireAuth('CLIENT'), orderController.canWithdraw);
orderRouter.post('/my/withdraw', requireAuth('CLIENT'), orderController.withdrawFromContract);

orderRouter.get('/:id/invoice', requireAuth(), orderController.getInvoice);

// ADMIN manage orders
orderRouter.post('/:companyId', requireAuth('ADMIN'), orderController.createOrder);
orderRouter.patch('/:id/confirm', requireAuth('ADMIN'), orderController.confirmOrder);
orderRouter.get('/:companyId', requireAuth('ADMIN'), orderController.listOrders);
orderRouter.get('/detail/:id', requireAuth('ADMIN'), orderController.getOrder);
