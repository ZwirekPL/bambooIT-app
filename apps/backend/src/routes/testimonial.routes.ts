import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { userLimiter } from '../middleware/rateLimiters';
import * as testimonialController from '../controllers/testimonial.controller';

export const testimonialRouter = Router();

// Public — get approved testimonials
testimonialRouter.get('/', testimonialController.getApproved);

// Authenticated — own testimonial
testimonialRouter.get('/my', requireAuth(), userLimiter, testimonialController.getMy);
testimonialRouter.post('/', requireAuth(), userLimiter, testimonialController.create);
testimonialRouter.patch('/my', requireAuth(), userLimiter, testimonialController.editMy);
testimonialRouter.delete('/my', requireAuth(), userLimiter, testimonialController.deleteMy);

// Admin — manage all testimonials
testimonialRouter.get('/admin', requireAuth('ADMIN'), userLimiter, testimonialController.listAll);
testimonialRouter.get('/admin/stats', requireAuth('ADMIN'), userLimiter, testimonialController.getStats);
testimonialRouter.patch('/admin/bulk', requireAuth('ADMIN'), userLimiter, testimonialController.bulkUpdateStatus);
testimonialRouter.patch('/admin/:id/status', requireAuth('ADMIN'), userLimiter, testimonialController.updateStatus);
testimonialRouter.patch('/admin/:id/reply', requireAuth('ADMIN'), userLimiter, testimonialController.replyToTestimonial);
testimonialRouter.patch('/admin/:id/pin', requireAuth('ADMIN'), userLimiter, testimonialController.togglePin);
