import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as orderController from '../controllers/order.controller';

export const orderRouter = Router();

// PATIENT endpoints
orderRouter.get('/my', requireAuth('PATIENT'), orderController.listMyOrders);
orderRouter.get('/my/portal', requireAuth('PATIENT'), orderController.getMyPortal);
orderRouter.get('/my/invoices', requireAuth('PATIENT'), orderController.listMyInvoices);
orderRouter.post('/my', requireAuth('PATIENT'), orderController.createMyOrder);
orderRouter.post('/my/cancel-subscription', requireAuth('PATIENT'), orderController.cancelMySubscription);
orderRouter.post('/my/resume-subscription', requireAuth('PATIENT'), orderController.resumeMySubscription);
orderRouter.get('/my/can-withdraw', requireAuth('PATIENT'), orderController.canWithdraw);
orderRouter.post('/my/withdraw', requireAuth('PATIENT'), orderController.withdrawFromContract);

orderRouter.patch('/:id/consultation-phone', requireAuth('PATIENT'), orderController.setConsultationPhone);
orderRouter.get('/:id/invoice', requireAuth(), orderController.getInvoice);

// ADMIN/DIETITIAN manage orders
orderRouter.post('/:patientId', requireAuth('ADMIN', 'DIETITIAN'), orderController.createOrder);
orderRouter.patch('/:id/confirm', requireAuth('ADMIN', 'DIETITIAN'), orderController.confirmOrder);
orderRouter.get('/:patientId', requireAuth('ADMIN', 'DIETITIAN'), orderController.listOrders);
orderRouter.get('/detail/:id', requireAuth('ADMIN', 'DIETITIAN'), orderController.getOrder);
