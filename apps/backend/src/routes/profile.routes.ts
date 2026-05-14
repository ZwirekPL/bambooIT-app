import { Router } from 'express';
import * as profileController from '../controllers/profile.controller';
import * as notifController from '../controllers/notificationPreferences.controller';
import * as dsarController from '../controllers/dsar.controller';

export const profileRouter = Router();

// GDPR / DSAR endpoints
profileRouter.get('/data-export', dsarController.exportData);
profileRouter.get('/consents', dsarController.getConsents);
profileRouter.get('/consents/history', dsarController.getConsentHistory);
profileRouter.post('/consents/:type/revoke', dsarController.revokeConsent);
profileRouter.post('/consents/cookies', dsarController.syncCookieConsents);

profileRouter.patch('/password', profileController.changePassword);
profileRouter.patch('/email', profileController.changeEmail);
profileRouter.get('/company', profileController.getMyCompany);
profileRouter.patch('/company', profileController.updateMyCompany);
profileRouter.get('/notifications', notifController.getNotificationPreferences);
profileRouter.patch('/notifications', notifController.updateNotificationPreferences);
profileRouter.delete('/account', profileController.deleteAccount);