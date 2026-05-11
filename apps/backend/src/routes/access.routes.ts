import { Router } from 'express';
import * as accessController from '../controllers/access.controller';

export const accessRouter = Router();

accessRouter.get('/status', accessController.getStatus);
