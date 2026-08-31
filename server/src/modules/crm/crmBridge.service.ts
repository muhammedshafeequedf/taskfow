import mongoose from 'mongoose';
import { CrmAccount } from './models/crmAccount.model';
import { CrmContact } from './models/crmContact.model';
import { CrmLead } from './models/crmLead.model';
import { CrmDeal } from './models/crmDeal.model';
import { CustomerOrg } from '../customer-portal/customer-org/customerOrg.model';
import { ApiError } from '../../utils/ApiError';
import { logAudit } from '../auditLogs/logAudit';
import { toOrgOid } from './crmWorkspace';

/** Create or return the CRM account linked to a customer portal organisation. */
export async function syncCrmAccountFromCustomerOrg(
  customerOrgId: string,
  taskflowOrganizationId: string,
  ownerId?: string
): Promise<string> {
  const orgOid = toOrgOid(taskflowOrganizationId);
  const org = await CustomerOrg.findOne({ _id: customerOrgId, taskflowOrganizationId: orgOid }).lean();
  if (!org) throw new ApiError(404, 'Customer organisation not found');

  if (org.crmAccountId) {
    const linked = await CrmAccount.findOne({ _id: org.crmAccountId, taskflowOrganizationId: orgOid }).lean();
    if (linked) return String(linked._id);
  }

  const existingByOrg = await CrmAccount.findOne({
    taskflowOrganizationId: orgOid,
    customerOrgId,
  }).lean();
  if (existingByOrg) {
    await CustomerOrg.findByIdAndUpdate(customerOrgId, { $set: { crmAccountId: existingByOrg._id } });
    await CrmContact.updateMany(
      { taskflowOrganizationId: orgOid, customerOrgId },
      { $set: { accountId: existingByOrg._id } }
    );
    return String(existingByOrg._id);
  }

  const account = await CrmAccount.create({
    taskflowOrganizationId: orgOid,
    name: org.name,
    type: 'client',
    customerOrgId: new mongoose.Types.ObjectId(customerOrgId),
    ownerId:
      ownerId && mongoose.isValidObjectId(ownerId) ? new mongoose.Types.ObjectId(ownerId) : undefined,
    notes: org.description,
  });

  await CustomerOrg.findByIdAndUpdate(customerOrgId, { $set: { crmAccountId: account._id } });

  await CrmContact.updateMany(
    { taskflowOrganizationId: orgOid, customerOrgId },
    { $set: { accountId: account._id } }
  );

  if (ownerId) {
    logAudit({
      userId: ownerId,
      action: 'create',
      resourceType: 'crm_account',
      resourceId: String(account._id),
      meta: { name: account.name, customerOrgId, syncedFromPortal: true },
    });
  }

  return String(account._id);
}

export async function linkAccountToCustomerOrg(
  accountId: string,
  customerOrgId: string,
  taskflowOrganizationId: string
): Promise<void> {
  const orgOid = toOrgOid(taskflowOrganizationId);
  await CustomerOrg.findOneAndUpdate(
    { _id: customerOrgId, taskflowOrganizationId: orgOid },
    { $set: { crmAccountId: accountId } }
  );
  await CrmAccount.findOneAndUpdate(
    { _id: accountId, taskflowOrganizationId: orgOid },
    { $set: { customerOrgId, type: 'client' } }
  );
}

export async function linkCustomerOrgToCrm(
  customerOrgId: string,
  taskflowOrganizationId: string,
  opts: { leadId?: string; dealId?: string; userId?: string }
): Promise<void> {
  const orgOid = toOrgOid(taskflowOrganizationId);
  const orgIdStr = String(customerOrgId);

  const org = await CustomerOrg.findOne({ _id: customerOrgId, taskflowOrganizationId: orgOid });
  if (!org) throw new ApiError(404, 'Customer organisation not found');

  if (opts.leadId) {
    const lead = await CrmLead.findOne({ _id: opts.leadId, taskflowOrganizationId: orgOid });
    if (!lead) throw new ApiError(404, 'Lead not found');
    if (lead.customerOrgId && String(lead.customerOrgId) !== orgIdStr) {
      throw new ApiError(400, 'Lead is already linked to another customer organisation');
    }
    await CrmLead.findByIdAndUpdate(opts.leadId, { $set: { customerOrgId } });
  }

  if (opts.dealId) {
    const deal = await CrmDeal.findOne({ _id: opts.dealId, taskflowOrganizationId: orgOid });
    if (!deal) throw new ApiError(404, 'Deal not found');
    if (deal.customerOrgId && String(deal.customerOrgId) !== orgIdStr) {
      throw new ApiError(400, 'Deal is already linked to another customer organisation');
    }
    await CrmDeal.findByIdAndUpdate(opts.dealId, { $set: { customerOrgId } });
    if (deal.leadId) {
      const lead = await CrmLead.findById(deal.leadId);
      if (lead && (!lead.customerOrgId || String(lead.customerOrgId) === orgIdStr)) {
        await CrmLead.findByIdAndUpdate(deal.leadId, { $set: { customerOrgId } });
      }
    }
  }

  if (opts.userId) {
    logAudit({
      userId: opts.userId,
      action: 'customer_org.linked_to_crm',
      resourceType: 'customer_org',
      resourceId: orgIdStr,
      meta: { leadId: opts.leadId, dealId: opts.dealId },
    });
  }
}

export async function linkProjectToAccount(
  projectId: string,
  accountId: string,
  taskflowOrganizationId: string
): Promise<void> {
  const account = await CrmAccount.findOne({
    _id: accountId,
    taskflowOrganizationId: toOrgOid(taskflowOrganizationId),
  });
  if (!account) return;
  const pid = new mongoose.Types.ObjectId(projectId);
  if (!account.projectIds.some((id: mongoose.Types.ObjectId) => String(id) === projectId)) {
    account.projectIds.push(pid);
    await account.save();
  }
}
