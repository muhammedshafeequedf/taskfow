export const LEAD_STATUSES = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'discovery', label: 'Technical discovery' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'proposal_requested', label: 'Proposal requested' },
  { id: 'nurturing', label: 'Nurturing' },
  { id: 'unqualified', label: 'Unqualified' },
  { id: 'converted', label: 'Converted' },
] as const;

export const LEAD_SOURCES = [
  { id: 'website', label: 'Website' },
  { id: 'email', label: 'Inbound email' },
  { id: 'referral', label: 'Referral' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'cold', label: 'Cold outreach' },
  { id: 'partner', label: 'Partner' },
  { id: 'event', label: 'Event / webinar' },
  { id: 'rfp', label: 'RFP / tender' },
  { id: 'other', label: 'Other' },
] as const;

export const LEAD_SERVICES = [
  { id: 'custom_dev', label: 'Custom development' },
  { id: 'staff_aug', label: 'Staff augmentation' },
  { id: 'cloud', label: 'Cloud / DevOps' },
  { id: 'support_amc', label: 'Support / AMC' },
  { id: 'product', label: 'Product license' },
  { id: 'consulting', label: 'Consulting' },
  { id: 'integration', label: 'Integrations' },
  { id: 'other', label: 'Other' },
] as const;

export const LEAD_COMPANY_SIZES = [
  { id: 'startup', label: 'Startup' },
  { id: 'smb', label: 'SMB' },
  { id: 'mid_market', label: 'Mid-market' },
  { id: 'enterprise', label: 'Enterprise' },
] as const;

export const LEAD_TIMELINES = [
  { id: 'immediate', label: 'Immediate' },
  { id: '1_3_months', label: '1–3 months' },
  { id: '3_6_months', label: '3–6 months' },
  { id: '6_plus', label: '6+ months' },
  { id: 'unknown', label: 'Unknown' },
] as const;

export const LEAD_ROLES = [
  { id: 'decision_maker', label: 'Decision maker' },
  { id: 'champion', label: 'Champion' },
  { id: 'influencer', label: 'Influencer' },
  { id: 'end_user', label: 'End user' },
  { id: 'unknown', label: 'Unknown' },
] as const;

export const OPEN_LEAD_STATUSES = [
  'new',
  'contacted',
  'discovery',
  'qualified',
  'proposal_requested',
  'nurturing',
];

export function leadLabel(list: readonly { id: string; label: string }[], id?: string): string {
  if (!id) return '—';
  return list.find((x) => x.id === id)?.label ?? id;
}

export function statusClass(status: string): string {
  switch (status) {
    case 'converted':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'qualified':
    case 'proposal_requested':
      return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'discovery':
    case 'contacted':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'nurturing':
      return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
    case 'unqualified':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    default:
      return 'bg-[color:var(--bg-page)] text-[color:var(--text-muted)] border-[color:var(--border-subtle)]';
  }
}

export function scoreClass(score?: number): string {
  const n = score ?? 0;
  if (n >= 70) return 'text-emerald-400';
  if (n >= 40) return 'text-amber-400';
  return 'text-[color:var(--text-muted)]';
}

export function assigneeName(assignee?: string | { _id: string; name?: string; email?: string }): string {
  if (!assignee) return 'Unassigned';
  if (typeof assignee === 'string') return assignee;
  return assignee.name || assignee.email || 'Unassigned';
}

export function refId(v?: string | { _id: string }): string {
  if (!v) return '';
  return typeof v === 'string' ? v : v._id;
}
