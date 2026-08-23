export const CRM_LEAD_STATUSES = [
  'new',
  'contacted',
  'discovery',
  'qualified',
  'proposal_requested',
  'nurturing',
  'unqualified',
  'converted',
] as const;

export type CrmLeadStatus = (typeof CRM_LEAD_STATUSES)[number];

export const CRM_LEAD_SOURCES = [
  'website',
  'email',
  'referral',
  'linkedin',
  'cold',
  'partner',
  'event',
  'rfp',
  'other',
] as const;

export const CRM_LEAD_SERVICES = [
  'custom_dev',
  'staff_aug',
  'cloud',
  'support_amc',
  'product',
  'consulting',
  'integration',
  'other',
] as const;

export const CRM_LEAD_COMPANY_SIZES = ['startup', 'smb', 'mid_market', 'enterprise'] as const;

export const CRM_LEAD_TIMELINES = ['immediate', '1_3_months', '3_6_months', '6_plus', 'unknown'] as const;

export const CRM_LEAD_DECISION_ROLES = ['decision_maker', 'influencer', 'champion', 'end_user', 'unknown'] as const;

export const OPEN_LEAD_STATUSES: CrmLeadStatus[] = [
  'new',
  'contacted',
  'discovery',
  'qualified',
  'proposal_requested',
  'nurturing',
];

export function normalizeLeadStatus(raw: unknown): CrmLeadStatus | undefined {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return undefined;
  if (s === 'lost' || s === 'disqualified' || s === 'spam') return 'unqualified';
  if (s === 'open') return 'new';
  if ((CRM_LEAD_STATUSES as readonly string[]).includes(s)) return s as CrmLeadStatus;
  return undefined;
}

export function computeLeadScore(input: {
  contactEmail?: string;
  companyName?: string;
  website?: string;
  estimatedBudget?: number;
  companySize?: string;
  serviceInterest?: string[];
  timeline?: string;
  decisionRole?: string;
  rfpReceived?: boolean;
  source?: string;
  jobTitle?: string;
}): number {
  let score = 5;
  if (input.contactEmail) score += 10;
  if (input.companyName) score += 8;
  if (input.website) score += 5;
  if (input.jobTitle) score += 5;
  if ((input.estimatedBudget ?? 0) > 0) score += 12;
  if ((input.estimatedBudget ?? 0) >= 50000) score += 8;
  switch (input.companySize) {
    case 'enterprise':
      score += 20;
      break;
    case 'mid_market':
      score += 14;
      break;
    case 'smb':
      score += 8;
      break;
    case 'startup':
      score += 4;
      break;
    default:
      break;
  }
  if ((input.serviceInterest ?? []).length) score += 10;
  switch (input.timeline) {
    case 'immediate':
      score += 15;
      break;
    case '1_3_months':
      score += 10;
      break;
    case '3_6_months':
      score += 5;
      break;
    default:
      break;
  }
  if (input.decisionRole === 'decision_maker') score += 15;
  else if (input.decisionRole === 'champion') score += 10;
  else if (input.decisionRole === 'influencer') score += 6;
  if (input.rfpReceived) score += 18;
  if (input.source === 'referral' || input.source === 'partner' || input.source === 'rfp') score += 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}
