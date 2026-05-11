import { Router } from 'express';
import * as mealController from '../controllers/meal.controller';

// Public read-only endpoints for meal library (used by frontend and AI pipeline)
export const mealRouter = Router();

mealRouter.get('/', mealController.list);
mealRouter.get('/candidates', mealController.candidates);
mealRouter.get('/:id', mealController.getById);
