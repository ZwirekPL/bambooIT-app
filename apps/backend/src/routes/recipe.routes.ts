import { Router } from 'express';
import * as recipeController from '../controllers/recipe.controller';

export const recipeRouter = Router();

// Public endpoints for recipe search
recipeRouter.get('/search', recipeController.search);
recipeRouter.get('/', recipeController.list);
recipeRouter.get('/:id', recipeController.getById);
