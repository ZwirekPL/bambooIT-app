import { Router } from 'express';
import * as foodProductController from '../controllers/foodProduct.controller';

export const foodProductRouter = Router();

// Public endpoints for food product search
foodProductRouter.get('/categories', foodProductController.listCategories);
foodProductRouter.get('/search', foodProductController.search);
foodProductRouter.get('/', foodProductController.list);
foodProductRouter.get('/:id', foodProductController.getById);
