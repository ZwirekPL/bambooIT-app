import { Router } from 'express';
import * as blogController from '../controllers/blog.controller';
import * as blogCategoryController from '../controllers/blogCategory.controller';

export const blogRouter = Router();

// Public — no auth required
blogRouter.get('/categories', blogCategoryController.listCategories);
blogRouter.get('/', blogController.listPosts);
blogRouter.get('/:slug', blogController.getPostBySlug);
