import { Router } from 'express';
import * as onboardingController from '../controllers/onboarding.controller';

export const onboardingRouter = Router();

// GET /onboarding/status — check patient onboarding completion
onboardingRouter.get('/status', onboardingController.getStatus);

// GET /onboarding/dietitian-status — check dietitian onboarding completion
onboardingRouter.get('/dietitian-status', onboardingController.getDietitianStatus);
