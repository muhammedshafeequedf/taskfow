import mongoose from 'mongoose';
import { ServiceTicket } from '../../service-desk/models/serviceTicket.model';
import { CustomerRequest } from '../customer-request/customerRequest.model';
import { CrmAccount } from '../../crm/models/crmAccount.model';
import { userHasPermission } from '../../../shared/constants/legacyPermissionMap';
import { ApiError } from '../../../utils/ApiError';

function publicTicketShape(ticket: {
  _id: unknown;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  workClassification?: string;
  comments?: Array<{ body: string; authorName?: string; internal?: boolean; createdAt: Date }>;
  customerRequestId?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    _id: ticket._id,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    workClassification: ticket.workClassification,
    customerRequestId: ticket.customerRequestId,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    comments: (ticket.comments ?? [])
      .filter((c) => !c.internal)
      .map((c) => ({
        body: c.body,
        authorName: c.authorName,
        createdAt: c.createdAt,
      })),
  };
}

async function orgTicketFilter(orgId: string, userId: string, permissions: string[]) {
  const account = await CrmAccount.findOne({ customerOrgId: orgId }).select('_id').lean();
  const requestFilter: Record<string, unknown> = { customerOrgId: orgId };
  if (!userHasPermission(permissions, 'requests:view_all')) {
    requestFilter.createdBy = userId;
  }
  const requestIds = await CustomerRequest.find(requestFilter).distinct('_id');
  const or: Record<string, unknown>[] = [{ customerRequestId: { $in: requestIds } }];
  if (account && userHasPermission(permissions, 'requests:view_all')) {
    or.push({ accountId: account._id });
  }
  return { $or: or };
}

export async function listTickets(orgId: string, userId: string, permissions: string[]) {
  const filter = await orgTicketFilter(orgId, userId, permissions);
  const tickets = await ServiceTicket.find(filter)
    .select('subject status priority workClassification customerRequestId createdAt updatedAt')
    .sort({ createdAt: -1 })
    .lean();
  return { tickets: tickets.map((t) => publicTicketShape(t)) };
}

export async function getTicket(orgId: string, ticketId: string, userId: string, permissions: string[]) {
  const filter = await orgTicketFilter(orgId, userId, permissions);
  const ticket = await ServiceTicket.findOne({ _id: ticketId, ...filter }).lean();
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  return publicTicketShape(ticket);
}

export async function addCustomerComment(
  orgId: string,
  ticketId: string,
  userId: string,
  authorName: string,
  body: string,
  permissions: string[]
) {
  const filter = await orgTicketFilter(orgId, userId, permissions);
  const ticket = await ServiceTicket.findOne({ _id: ticketId, ...filter });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  ticket.comments.push({
    authorId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : undefined,
    authorName,
    body: body.trim(),
    internal: false,
    createdAt: new Date(),
  });
  await ticket.save();
  return publicTicketShape(ticket.toObject());
}
