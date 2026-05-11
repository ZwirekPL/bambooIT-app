import { Router } from 'express';
import * as patientController from '../controllers/patient.controller';
import * as alertsController from '../controllers/dietitianAlerts.controller';
import * as micronutrientController from '../controllers/micronutrient.controller';

export const patientRouter = Router();

patientRouter.get('/alerts', alertsController.alerts);
patientRouter.get('/stats', patientController.stats);
patientRouter.get('/', patientController.list);
patientRouter.get('/:id/segment', patientController.getSegment);
patientRouter.get('/:id/micronutrient-trends', micronutrientController.getTrends);
patientRouter.get('/:id/recommended-products', patientController.getRecommendedProducts);
patientRouter.get('/:id', patientController.getById);
patientRouter.patch('/:id/assign', patientController.assignToMe);
patientRouter.patch('/:id', patientController.update);
patientRouter.delete('/:id', patientController.remove);
