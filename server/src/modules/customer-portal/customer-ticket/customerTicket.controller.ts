import { Request, Response } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import { validate } from '../../../middleware/validate';
import { addTicketCommentSchema } from './customerTicket.validation';
import * as customerTicketService from './customerTicket.service';

async function listHandler(req: Request, res: Response): Promise<void> {
  const data = await customerTicketService.listTickets(
    req.customerUser!.orgId,
    req.customerUser!.id,
    req.customerUser!.permissions
  );
  res.status(200).json({ success: true, data });
}

async function getHandler(req: Request, res: Response): Promise<void> {
  const ticket = await customerTicketService.getTicket(
    req.customerUser!.orgId,
    req.params.ticketId,
    req.customerUser!.id,
    req.customerUser!.permissions
  );
  res.status(200).json({ success: true, data: { ticket } });
}

async function commentHandler(req: Request, res: Response): Promise<void> {
  const ticket = await customerTicketService.addCustomerComment(
    req.customerUser!.orgId,
    req.params.ticketId,
    req.customerUser!.id,
    req.customerUser!.name,
    req.body.body,
    req.customerUser!.permissions
  );
  res.status(200).json({ success: true, data: { ticket } });
}

export const listTickets = [asyncHandler(listHandler)];
export const getTicket = [asyncHandler(getHandler)];
export const addComment = [validate(addTicketCommentSchema, 'body'), asyncHandler(commentHandler)];
