import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as userController from '../controllers/user.controller';

export const userRouter = Router();

userRouter.delete('/:id', requireAuth('ADMIN'), userController.remove);
