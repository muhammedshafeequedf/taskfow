import { Router } from 'express';
import { customerAuthMiddleware } from '../middleware/customerAuth.middleware';
import { customerRequirePermission } from '../middleware/customerRequirePermission';
import * as customerTicketController from './customerTicket.controller';

const router = Router();

router.get(
  '/',
  customerAuthMiddleware,
  customerRequirePermission('requests:view_own'),
  ...customerTicketController.listTickets
);

router.get(
  '/:ticketId',
  customerAuthMiddleware,
  customerRequirePermission('requests:view_own'),
  ...customerTicketController.getTicket
);

router.post(
  '/:ticketId/comments',
  customerAuthMiddleware,
  customerRequirePermission('requests:view_own'),
  ...customerTicketController.addComment
);

export const customerTicketRoutes = router;
