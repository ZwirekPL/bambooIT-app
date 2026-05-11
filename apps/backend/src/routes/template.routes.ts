import { Router } from 'express';
import * as templateController from '../controllers/template.controller';

// Public read-only endpoints for template plans (used by frontend and AI pipeline)
export const templateRouter = Router();

templateRouter.get('/', templateController.list);
templateRouter.get('/:id', templateController.getById);
