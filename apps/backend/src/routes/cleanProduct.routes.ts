import { Router } from 'express';
import * as cleanProductController from '../controllers/cleanProduct.controller';

export const cleanProductRouter = Router();

// Public endpoints
cleanProductRouter.get('/search', cleanProductController.search);
cleanProductRouter.get('/categories', cleanProductController.getCategories);
cleanProductRouter.get('/', cleanProductController.list);
cleanProductRouter.get('/:id', cleanProductController.getById);

// Preview nutrition (authenticated via recipe routes)
cleanProductRouter.post('/preview-nutrition', cleanProductController.previewNutrition);
