import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as labPanelController from '../controllers/labpanel.controller';

export const labPanelRouter = Router();

labPanelRouter.post('/:patientId', requireAuth('ADMIN', 'DIETITIAN'), labPanelController.createLabPanel);
labPanelRouter.get('/:patientId', requireAuth('ADMIN', 'DIETITIAN'), labPanelController.listLabPanels);
labPanelRouter.get('/detail/:id', requireAuth('ADMIN', 'DIETITIAN'), labPanelController.getLabPanel);
