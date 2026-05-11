import { Router } from 'express';
import * as referralController from '../controllers/referral.controller';
import { requireAuth } from '../middleware/auth';

export const referralRouter = Router();

// GET /referrals/my — get or create referral code for authenticated user
referralRouter.get('/my', referralController.getMyReferral);

// GET /referrals/admin/stats — admin-only referral statistics
referralRouter.get('/admin/stats', requireAuth('ADMIN'), referralController.getAdminStats);
