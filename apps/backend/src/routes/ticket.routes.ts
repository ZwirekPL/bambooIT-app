import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as ticketController from '../controllers/ticket.controller';

// Client-facing ticket endpoints. Mounted at /tickets; the company is resolved
// from the authenticated user, so clients only ever see their own tickets.
export const ticketRouter = Router();

ticketRouter.get('/my', requireAuth('CLIENT'), ticketController.listMyTickets);
ticketRouter.post('/my', requireAuth('CLIENT'), ticketController.createMyTicket);
ticketRouter.get('/my/:id', requireAuth('CLIENT'), ticketController.getMyTicket);
ticketRouter.post('/my/:id/messages', requireAuth('CLIENT'), ticketController.addMyMessage);
