/**
 * 37.5 — Recipe Rating Routes.
 *
 * Patient routes (require auth):
 *   POST   /ratings          — rate a recipe
 *   POST   /ratings/batch    — batch rate (from check-in)
 *   GET    /ratings/my       — my ratings
 *
 * Admin/Dietitian routes (mounted under /admin):
 *   GET    /ratings/recipe/:recipeId — ratings for a recipe
 *   GET    /ratings/top              — top rated recipes
 *   GET    /ratings/low              — lowest rated recipes
 */

import { Router } from 'express';
import * as ratingController from '../controllers/rating.controller';

export const ratingRouter = Router();

// Patient endpoints
ratingRouter.post('/', ratingController.rateRecipe);
ratingRouter.post('/batch', ratingController.batchRate);
ratingRouter.get('/my', ratingController.getMyRatings);

// 64.2 — Favorite meals
ratingRouter.post('/favorite', ratingController.toggleFavorite);
ratingRouter.get('/favorites', ratingController.listFavorites);

// Admin/Dietitian endpoints (also mounted here for simplicity — requireAuth already applied)
ratingRouter.get('/recipe/:recipeId', ratingController.getRecipeRatings);
ratingRouter.get('/top', ratingController.getTopRated);
ratingRouter.get('/low', ratingController.getLowRated);
