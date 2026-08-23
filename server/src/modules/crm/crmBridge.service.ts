import mongoose from 'mongoose';
import { CrmAccount } from './models/crmAccount.model';
import { CustomerOrg } from '../customer-portal/customer-org/customerOrg.model';
import { toOrgOid } from './crmWorkspace';

/** Kept for vendor/legacy rows. Client companies are CustomerOrg — do not create CRM accounts. */
export async function syncCrmAccountFromCustomerOrg(
  _customerOrgId: string,
  _taskflowOrganizationId: string,
  _ownerId?: string
): Promise<string> {
  return '';
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
