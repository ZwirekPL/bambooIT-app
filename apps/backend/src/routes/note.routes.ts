import { Router } from 'express';
import * as noteController from '../controllers/note.controller';

export const noteRouter = Router();

// DIETITIAN/ADMIN: create & list notes for a patient
noteRouter.post('/:patientId', noteController.create);
noteRouter.get('/:patientId', noteController.list);
