import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as tenantController from '../controllers/tenant.controller';

export const tenantRouter = Router();

tenantRouter.post('/', requireAuth('ADMIN', 'DIETITIAN'), tenantController.create);
tenantRouter.get('/:slug', requireAuth('ADMIN', 'DIETITIAN'), tenantController.getBySlug);
tenantRouter.patch('/:slug', requireAuth('ADMIN', 'DIETITIAN'), tenantController.update);
