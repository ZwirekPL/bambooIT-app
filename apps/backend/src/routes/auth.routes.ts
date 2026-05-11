import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { forgotPasswordLimiter, authActionLimiter, resendVerificationLimiter } from '../middleware/rateLimiters';

export const authRouter = Router();

authRouter.post('/login', authController.login);
authRouter.post('/register', authController.register);
authRouter.post('/logout', requireAuth(), authController.logout);
authRouter.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
authRouter.post('/reset-password', authActionLimiter, authController.resetPassword);
authRouter.post('/verify-email', authActionLimiter, authController.verifyEmail);
authRouter.post('/resend-verification', resendVerificationLimiter, authController.resendVerification);
