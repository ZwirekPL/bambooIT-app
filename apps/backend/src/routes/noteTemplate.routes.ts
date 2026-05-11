import { Router } from 'express';
import * as noteTemplateController from '../controllers/noteTemplate.controller';

export const noteTemplateRouter = Router();

noteTemplateRouter.get('/', noteTemplateController.list);
noteTemplateRouter.post('/', noteTemplateController.create);
noteTemplateRouter.patch('/:id', noteTemplateController.update);
noteTemplateRouter.delete('/:id', noteTemplateController.remove);
