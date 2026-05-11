import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireActiveOrder } from '../middleware/paywall';
import { authActionLimiter } from '../middleware/rateLimiters';
import * as interviewController from '../controllers/interview.controller';

export const interviewRouter = Router();

interviewRouter.post('/pre-check', authActionLimiter, interviewController.preCheck);
interviewRouter.post('/', requireActiveOrder(), interviewController.create);
interviewRouter.put('/:id', requireAuth(), interviewController.update);
interviewRouter.post('/request-update/:patientId', requireAuth('ADMIN', 'DIETITIAN'), interviewController.requestUpdate);
interviewRouter.get('/patient/:patientId', requireAuth('ADMIN', 'DIETITIAN'), interviewController.listByPatient);
interviewRouter.get('/latest/:patientId', requireAuth(), interviewController.getLatest);
interviewRouter.get('/diff/:id1/:id2', requireAuth(), interviewController.diff);
interviewRouter.get('/matched-protocols/:patientId', requireAuth('ADMIN', 'DIETITIAN'), interviewController.getMatchedProtocols);
