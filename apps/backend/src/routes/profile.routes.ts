import { Router } from 'express';
import * as profileController from '../controllers/profile.controller';
import * as notifController from '../controllers/notificationPreferences.controller';
// TODO(2b-cleanup): note.controller dropped in 2b (diet notes) — listMy mount commented below
// import * as noteController from '../controllers/note.controller';
import * as dsarController from '../controllers/dsar.controller';

export const profileRouter = Router();

// GDPR / DSAR endpoints
profileRouter.get('/data-export', dsarController.exportData);
profileRouter.get('/consents', dsarController.getConsents);
profileRouter.get('/consents/history', dsarController.getConsentHistory);
profileRouter.post('/consents/:type/revoke', dsarController.revokeConsent);
profileRouter.post('/consents/cookies', dsarController.syncCookieConsents);

profileRouter.get('/', profileController.getMyProfile);
profileRouter.patch('/', profileController.updateMyProfile);
profileRouter.get('/dietitian', profileController.getDietitianProfile);
profileRouter.patch('/dietitian', profileController.updateDietitianProfile);
profileRouter.patch('/password', profileController.changePassword);
profileRouter.patch('/email', profileController.changeEmail);
profileRouter.get('/notifications', notifController.getNotificationPreferences);
profileRouter.patch('/notifications', notifController.updateNotificationPreferences);
profileRouter.delete('/account', profileController.deleteAccount);
// TODO(2b-cleanup): note.controller dropped in 2b
// profileRouter.get('/notes', noteController.listMy);
