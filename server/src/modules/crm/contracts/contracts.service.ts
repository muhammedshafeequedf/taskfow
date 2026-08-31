import mongoose from 'mongoose';
import {
  CrmContract,
  type CrmContractKind,
  type CrmContractSupportPeriod,
} from '../models/crmContract.model';
import { CrmAccount } from '../models/crmAccount.model';
import { CustomerOrg } from '../../customer-portal/customer-org/customerOrg.model';
import { WorkLog } from '../../workLogs/workLog.model';
import { SlaPolicy } from '../../service-desk/models/slaPolicy.model';
import { BillingInvoice } from '../../billing/models/billingInvoice.model';
import { ApiError } from '../../../utils/ApiError';
import { requireWorkspaceId, toOrgOid } from '../crmWorkspace';

const SUPPORT_PERIODS: CrmContractSupportPeriod[] = [
  'lifelong_with_payment',
  'from_prod_release',
  'from_last_invoice',
];

const ALLOWED_UPDATE = [
  'title',
  'kind',
  'value',
  'currency',
  'billingCycle',
  'startDate',
  'endDate',
  'renewalDate',
  'autoRenew',
  'hoursIncluded',
  'hoursUsed',
  'hourlyRate',
  'supportPeriod',
  'supportDurationMonths',
  'prodReleaseDate',
  'status',
  'notes',
  'projectId',
  'dealId',
  'slaPolicyId',
  'customerOrgId',
  'accountId',
] as const;

export type ListContractsQuery = {
  accountId?: string;
  customerOrgId?: string;
  kind?: string;
  status?: string;
  renewingWithinDays?: number;
};

function asDate(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function assertHourlyFields(kind: string, input: Record<string, unknown>) {
  if (kind !== 'hourly') return;
  const rate = Number(input.hourlyRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new ApiError(400, 'Hourly rate is required and must be greater than 0');
  }
  const period = String(input.supportPeriod ?? '') as CrmContractSupportPeriod;
  if (!SUPPORT_PERIODS.includes(period)) {
    throw new ApiError(400, 'Support period is required for hourly agreements');
  }
  if (period !== 'lifelong_with_payment') {
    const months = Number(input.supportDurationMonths);
    if (!Number.isFinite(months) || months < 1) {
      throw new ApiError(400, 'Support duration (months) is required and must be at least 1');
    }
  }
  if (period === 'from_prod_release' && !asDate(input.prodReleaseDate)) {
    throw new ApiError(400, 'Prod release date is required for this support period');
  }
}

function pickUpdates(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_UPDATE) {
    if (!(key in input)) continue;
    const val = input[key];
    if (key === 'startDate' || key === 'endDate' || key === 'renewalDate' || key === 'prodReleaseDate') {
      out[key] = val === null || val === '' ? null : asDate(val);
      continue;
    }
    if (
      key === 'value' ||
      key === 'hoursIncluded' ||
      key === 'hoursUsed' ||
      key === 'hourlyRate' ||
      key === 'supportDurationMonths'
    ) {
      out[key] = val === null || val === undefined || val === '' ? undefined : Number(val);
      continue;
    }
    if (key === 'autoRenew') {
      out[key] = Boolean(val);
      continue;
    }
    if (key === 'projectId' || key === 'dealId' || key === 'slaPolicyId' || key === 'customerOrgId' || key === 'accountId') {
      out[key] = val === null || val === '' ? null : val;
      continue;
    }
    out[key] = val;
  }
  return out;
}

async function resolveCustomerOrgId(
  orgOid: mongoose.Types.ObjectId,
  input: Record<string, unknown>
): Promise<{ customerOrgId?: string; accountId?: string }> {
  let customerOrgId = input.customerOrgId ? String(input.customerOrgId) : '';
  let accountId = input.accountId ? String(input.accountId) : undefined;

  if (accountId) {
    const account = await CrmAccount.findOne({ _id: accountId, taskflowOrganizationId: orgOid }).lean();
    if (!account) throw new ApiError(404, 'Account not found');
    if (!customerOrgId && account.customerOrgId) {
      customerOrgId = String(account.customerOrgId);
    }
  }

  if (!customerOrgId && accountId) {
    const linked = await CustomerOrg.findOne({
      taskflowOrganizationId: orgOid,
      crmAccountId: accountId,
    }).lean();
    if (linked) customerOrgId = String(linked._id);
  }

  if (customerOrgId) {
    const customerOrg = await CustomerOrg.findOne({ _id: customerOrgId, taskflowOrganizationId: orgOid });
    if (!customerOrg) throw new ApiError(404, 'Customer organisation not found');
  }

  if (!customerOrgId && !accountId) {
    throw new ApiError(400, 'Account or customer organisation is required');
  }

  return { customerOrgId: customerOrgId || undefined, accountId };
}

async function lastInvoiceDatesByContract(
  orgOid: mongoose.Types.ObjectId,
  contractIds: string[]
): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  if (contractIds.length === 0) return map;
  const oids = contractIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (oids.length === 0) return map;

  const rows = await BillingInvoice.aggregate<{ _id: mongoose.Types.ObjectId; lastIssueDate: Date }>([
    {
      $match: {
        taskflowOrganizationId: orgOid,
        contractId: { $in: oids },
        status: { $ne: 'void' },
      },
    },
    { $group: { _id: '$contractId', lastIssueDate: { $max: '$issueDate' } } },
  ]);
  for (const row of rows) {
    map.set(String(row._id), new Date(row.lastIssueDate));
  }
  return map;
}

function enrichSupport(
  contract: Record<string, unknown>,
  lastInvoiceDate?: Date
): Record<string, unknown> {
  const period = contract.supportPeriod as CrmContractSupportPeriod | undefined;
  const months = Number(contract.supportDurationMonths ?? 0);
  let supportEndsAt: Date | null = null;
  let supportNote: string | undefined;

  if (period === 'lifelong_with_payment') {
    supportNote =
      contract.status === 'active'
        ? 'Lifelong while active with payment'
        : 'Lifelong with payment (inactive)';
  } else if (period === 'from_prod_release') {
    const release = contract.prodReleaseDate ? new Date(String(contract.prodReleaseDate)) : undefined;
    if (release && Number.isFinite(months) && months >= 1) {
      supportEndsAt = addMonths(release, months);
    } else {
      supportNote = 'Set prod release date and duration';
    }
  } else if (period === 'from_last_invoice') {
    if (lastInvoiceDate && Number.isFinite(months) && months >= 1) {
      supportEndsAt = addMonths(lastInvoiceDate, months);
    } else {
      supportNote = 'Starts after first invoice';
    }
  }

  return {
    ...contract,
    lastInvoiceDate: lastInvoiceDate ?? null,
    supportEndsAt,
    supportNote,
  };
}

export async function listContracts(workspaceId: string | null | undefined, query: ListContractsQuery = {}) {
  const orgId = requireWorkspaceId(workspaceId);
  const orgOid = toOrgOid(orgId);
  const filter: Record<string, unknown> = { taskflowOrganizationId: orgOid };
  if (query.customerOrgId) filter.customerOrgId = query.customerOrgId;
  if (query.accountId) filter.accountId = query.accountId;
  if (query.kind) filter.kind = query.kind;
  if (query.status) filter.status = query.status;
  if (query.renewingWithinDays != null && query.renewingWithinDays > 0) {
    const now = new Date();
    const until = new Date(now.getTime() + query.renewingWithinDays * 24 * 60 * 60 * 1000);
    filter.status = query.status ?? 'active';
    filter.renewalDate = { $gte: now, $lte: until };
  }
  const rows = await CrmContract.find(filter)
    .populate('customerOrgId', 'name')
    .populate('accountId', 'name type')
    .populate('slaPolicyId', 'name')
    .sort({ renewalDate: 1, startDate: -1 })
    .lean();

  const hourlyIds = rows.filter((c) => c.kind === 'hourly').map((c) => String(c._id));
  const invoiceMap = await lastInvoiceDatesByContract(orgOid, hourlyIds);

  return rows.map((c) => {
    if (c.kind !== 'hourly') return c;
    return enrichSupport(c as Record<string, unknown>, invoiceMap.get(String(c._id)));
  });
}

export async function getContractById(id: string, workspaceId: string | null | undefined) {
  const orgId = requireWorkspaceId(workspaceId);
  const orgOid = toOrgOid(orgId);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, 'Contract not found');

  const contract = await CrmContract.findOne({ _id: id, taskflowOrganizationId: orgOid })
    .populate('customerOrgId', 'name')
    .populate('accountId', 'name type')
    .populate('slaPolicyId', 'name')
    .lean();
  if (!contract) throw new ApiError(404, 'Contract not found');

  let result: Record<string, unknown> = { ...contract };
  if (contract.kind === 'hourly') {
    const invoiceMap = await lastInvoiceDatesByContract(orgOid, [String(contract._id)]);
    result = enrichSupport(result, invoiceMap.get(String(contract._id)));

    const recentInvoices = await BillingInvoice.find({
      taskflowOrganizationId: orgOid,
      contractId: contract._id,
      status: { $ne: 'void' },
    })
      .select('number status issueDate total currency amountPaid')
      .sort({ issueDate: -1 })
      .limit(5)
      .lean();
    result.recentInvoices = recentInvoices;
  }

  return result;
}

export async function createContract(workspaceId: string | null | undefined, input: Record<string, unknown>) {
  const orgId = requireWorkspaceId(workspaceId);
  const orgOid = toOrgOid(orgId);
  const { customerOrgId, accountId } = await resolveCustomerOrgId(orgOid, input);
  if (!input.title || !String(input.title).trim()) throw new ApiError(400, 'Title is required');
  if (!input.startDate) throw new ApiError(400, 'Start date is required');

  if (input.slaPolicyId) {
    const sla = await SlaPolicy.findOne({ _id: input.slaPolicyId, taskflowOrganizationId: orgOid });
    if (!sla) throw new ApiError(404, 'SLA policy not found');
  }

  const kind = (String(input.kind ?? 'other') as CrmContractKind) || 'other';
  assertHourlyFields(kind, input);

  const endDate = asDate(input.endDate);
  const renewalDate = asDate(input.renewalDate) ?? endDate;
  const supportPeriod = input.supportPeriod
    ? (String(input.supportPeriod) as CrmContractSupportPeriod)
    : undefined;
  const supportDurationMonths =
    input.supportDurationMonths != null && input.supportDurationMonths !== ''
      ? Number(input.supportDurationMonths)
      : undefined;
  const hourlyRate =
    input.hourlyRate != null && input.hourlyRate !== '' ? Number(input.hourlyRate) : undefined;

  const doc = await CrmContract.create({
    taskflowOrganizationId: orgOid,
    accountId: accountId || undefined,
    customerOrgId: customerOrgId || undefined,
    dealId: input.dealId || undefined,
    projectId: input.projectId || undefined,
    title: String(input.title).trim(),
    kind,
    value: Number(input.value ?? 0),
    currency: input.currency ?? 'USD',
    billingCycle: input.billingCycle ?? 'monthly',
    startDate: asDate(input.startDate)!,
    endDate,
    renewalDate,
    autoRenew: Boolean(input.autoRenew),
    hoursIncluded: input.hoursIncluded != null && input.hoursIncluded !== '' ? Number(input.hoursIncluded) : undefined,
    hourlyRate,
    supportPeriod,
    supportDurationMonths:
      supportPeriod && supportPeriod !== 'lifelong_with_payment' ? supportDurationMonths : undefined,
    prodReleaseDate: supportPeriod === 'from_prod_release' ? asDate(input.prodReleaseDate) : undefined,
    status: input.status ?? 'draft',
    slaPolicyId: input.slaPolicyId || undefined,
    notes: input.notes,
  });
  return doc.toObject();
}

export async function updateContract(id: string, workspaceId: string | null | undefined, input: Record<string, unknown>) {
  const orgId = requireWorkspaceId(workspaceId);
  const orgOid = toOrgOid(orgId);
  const existing = await CrmContract.findOne({ _id: id, taskflowOrganizationId: orgOid }).lean();
  if (!existing) throw new ApiError(404, 'Contract not found');

  const updates = pickUpdates(input);
  const nextKind = String(updates.kind ?? existing.kind ?? 'other');
  const mergedForValidation: Record<string, unknown> = {
    hourlyRate: updates.hourlyRate !== undefined ? updates.hourlyRate : existing.hourlyRate,
    supportPeriod: updates.supportPeriod !== undefined ? updates.supportPeriod : existing.supportPeriod,
    supportDurationMonths:
      updates.supportDurationMonths !== undefined ? updates.supportDurationMonths : existing.supportDurationMonths,
    prodReleaseDate: updates.prodReleaseDate !== undefined ? updates.prodReleaseDate : existing.prodReleaseDate,
  };
  assertHourlyFields(nextKind, mergedForValidation);

  if (updates.slaPolicyId) {
    const sla = await SlaPolicy.findOne({ _id: updates.slaPolicyId, taskflowOrganizationId: orgOid });
    if (!sla) throw new ApiError(404, 'SLA policy not found');
  }

  if (nextKind === 'hourly' && updates.supportPeriod === 'lifelong_with_payment') {
    updates.supportDurationMonths = undefined;
    updates.prodReleaseDate = null;
  }
  if (nextKind === 'hourly' && updates.supportPeriod && updates.supportPeriod !== 'from_prod_release') {
    if (!('prodReleaseDate' in updates)) updates.prodReleaseDate = null;
  }

  const updated = await CrmContract.findOneAndUpdate(
    { _id: id, taskflowOrganizationId: orgOid },
    { $set: updates },
    { new: true }
  ).lean();
  if (!updated) throw new ApiError(404, 'Contract not found');
  if (updated.kind === 'hourly') {
    const invoiceMap = await lastInvoiceDatesByContract(orgOid, [String(updated._id)]);
    return enrichSupport(updated as Record<string, unknown>, invoiceMap.get(String(updated._id)));
  }
  return updated;
}

export async function deleteContract(id: string, workspaceId: string | null | undefined) {
  const orgId = requireWorkspaceId(workspaceId);
  const deleted = await CrmContract.findOneAndDelete({ _id: id, taskflowOrganizationId: toOrgOid(orgId) });
  if (!deleted) throw new ApiError(404, 'Contract not found');
  return { deleted: true };
}

export async function getContractBurnDown(id: string, workspaceId: string | null | undefined) {
  const orgId = requireWorkspaceId(workspaceId);
  const contract = await CrmContract.findOne({ _id: id, taskflowOrganizationId: toOrgOid(orgId) }).lean();
  if (!contract) throw new ApiError(404, 'Contract not found');
  let hoursUsed = contract.hoursUsed ?? 0;
  if (contract.projectId) {
    const projectOid = new mongoose.Types.ObjectId(String(contract.projectId));
    const logs = await WorkLog.aggregate([
      { $lookup: { from: 'issues', localField: 'issue', foreignField: '_id', as: 'issueDoc' } },
      { $unwind: '$issueDoc' },
      { $match: { 'issueDoc.project': projectOid } },
      { $group: { _id: null, total: { $sum: '$minutesSpent' } } },
    ]);
    hoursUsed = (logs[0]?.total ?? 0) / 60;
  }
  const included = contract.hoursIncluded ?? 0;
  return {
    contract,
    hoursUsed: Math.round(hoursUsed * 10) / 10,
    hoursRemaining: Math.max(0, Math.round((included - hoursUsed) * 10) / 10),
    percentUsed: included > 0 ? Math.round((hoursUsed / included) * 100) : 0,
  };
}

export async function getContractsHubDashboard(workspaceId: string | null | undefined) {
  const orgId = requireWorkspaceId(workspaceId);
  const orgOid = toOrgOid(orgId);
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [contracts, slaPolicies] = await Promise.all([
    CrmContract.find({ taskflowOrganizationId: orgOid }).lean(),
    SlaPolicy.find({ taskflowOrganizationId: orgOid }).select('name enabled').lean(),
  ]);

  const active = contracts.filter((c) => c.status === 'active');
  const activeValue = active.reduce((s, c) => s + (c.value ?? 0), 0);

  const byStatus = ['draft', 'active', 'expired', 'cancelled'].map((status) => ({
    name: status,
    count: contracts.filter((c) => c.status === status).length,
    value: contracts.filter((c) => c.status === status).reduce((s, c) => s + (c.value ?? 0), 0),
  }));

  const byKind = ['msa', 'retainer', 'amc', 'hourly', 'other'].map((kind) => ({
    name: kind.toUpperCase(),
    kind,
    count: contracts.filter((c) => (c.kind ?? 'other') === kind).length,
    value: contracts
      .filter((c) => (c.kind ?? 'other') === kind)
      .reduce((s, c) => s + (c.value ?? 0), 0),
  }));

  const renewals = contracts
    .filter((c) => c.status === 'active' && c.renewalDate)
    .map((c) => ({
      ...c,
      daysUntilRenewal: Math.ceil((new Date(c.renewalDate!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    }))
    .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

  const renewalsIn30 = renewals.filter((c) => c.daysUntilRenewal >= 0 && c.renewalDate! <= in30);
  const renewalsIn60 = renewals.filter((c) => c.daysUntilRenewal >= 0 && c.renewalDate! <= in60);
  const renewalsIn90 = renewals.filter((c) => c.daysUntilRenewal >= 0 && c.renewalDate! <= in90);

  const renewalBuckets = [
    { name: '0–30d', count: renewalsIn30.length, value: renewalsIn30.reduce((s, c) => s + (c.value ?? 0), 0) },
    {
      name: '31–60d',
      count: renewals.filter((c) => c.daysUntilRenewal > 30 && c.renewalDate! <= in60).length,
      value: renewals
        .filter((c) => c.daysUntilRenewal > 30 && c.renewalDate! <= in60)
        .reduce((s, c) => s + (c.value ?? 0), 0),
    },
    {
      name: '61–90d',
      count: renewals.filter((c) => c.daysUntilRenewal > 60 && c.renewalDate! <= in90).length,
      value: renewals
        .filter((c) => c.daysUntilRenewal > 60 && c.renewalDate! <= in90)
        .reduce((s, c) => s + (c.value ?? 0), 0),
    },
    {
      name: '90d+',
      count: renewals.filter((c) => c.daysUntilRenewal > 90).length,
      value: renewals.filter((c) => c.daysUntilRenewal > 90).reduce((s, c) => s + (c.value ?? 0), 0),
    },
  ];

  const retainers = active.filter((c) => c.kind === 'retainer' || c.kind === 'amc');
  const retainerBurn = retainers.map((c) => {
    const included = c.hoursIncluded ?? 0;
    const used = c.hoursUsed ?? 0;
    return {
      _id: String(c._id),
      title: c.title,
      kind: c.kind,
      hoursIncluded: included,
      hoursUsed: used,
      percentUsed: included > 0 ? Math.round((used / included) * 100) : 0,
      hoursRemaining: Math.max(0, included - used),
    };
  });

  const billingCycleMix = ['monthly', 'quarterly', 'annual', 'one_time'].map((cycle) => ({
    name: cycle,
    count: active.filter((c) => c.billingCycle === cycle).length,
    value: active.filter((c) => c.billingCycle === cycle).reduce((s, c) => s + (c.value ?? 0), 0),
  }));

  return {
    counts: {
      total: contracts.length,
      active: active.length,
      msas: contracts.filter((c) => c.kind === 'msa').length,
      retainers: contracts.filter((c) => c.kind === 'retainer' || c.kind === 'amc').length,
      hourly: contracts.filter((c) => c.kind === 'hourly').length,
      renewalsIn30: renewalsIn30.length,
      renewalsIn90: renewalsIn90.length,
      slaPolicies: slaPolicies.length,
      slaEnabled: slaPolicies.filter((p) => p.enabled).length,
      autoRenew: active.filter((c) => c.autoRenew).length,
    },
    activeValue,
    byStatus,
    byKind,
    renewalBuckets,
    upcomingRenewals: renewalsIn90.slice(0, 12).map((c) => ({
      _id: String(c._id),
      title: c.title,
      kind: c.kind ?? 'other',
      value: c.value ?? 0,
      currency: c.currency ?? 'USD',
      renewalDate: c.renewalDate,
      daysUntilRenewal: c.daysUntilRenewal,
      autoRenew: c.autoRenew,
      accountId: String(c.accountId),
    })),
    retainerBurn: retainerBurn.sort((a, b) => b.percentUsed - a.percentUsed).slice(0, 10),
    billingCycleMix,
    slaPolicies: slaPolicies.map((p) => ({
      _id: String(p._id),
      name: p.name,
      enabled: p.enabled,
    })),
  };
}
