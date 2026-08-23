import mongoose, { Document, Schema } from 'mongoose';

export const CRM_CAMPAIGN_TYPES = ['inbound', 'outbound', 'event', 'partner', 'other'] as const;
export const CRM_CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed'] as const;

export type CrmCampaignType = (typeof CRM_CAMPAIGN_TYPES)[number];
export type CrmCampaignStatus = (typeof CRM_CAMPAIGN_STATUSES)[number];

export interface ICrmCampaign extends Document {
  taskflowOrganizationId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  type: CrmCampaignType;
  status: CrmCampaignStatus;
  channel?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  startsAt?: Date;
  endsAt?: Date;
  budget?: number;
  currency: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const crmCampaignSchema = new Schema<ICrmCampaign>(
  {
    taskflowOrganizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, enum: CRM_CAMPAIGN_TYPES, default: 'inbound' },
    status: { type: String, enum: CRM_CAMPAIGN_STATUSES, default: 'draft', index: true },
    channel: { type: String, trim: true },
    utmSource: { type: String, trim: true },
    utmMedium: { type: String, trim: true },
    utmCampaign: { type: String, trim: true },
    startsAt: { type: Date },
    endsAt: { type: Date },
    budget: { type: Number, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true, trim: true },
    notes: { type: String },
  },
  { timestamps: true }
);

crmCampaignSchema.index({ taskflowOrganizationId: 1, code: 1 }, { unique: true });
crmCampaignSchema.index({ taskflowOrganizationId: 1, status: 1, updatedAt: -1 });

export const CrmCampaign = mongoose.model<ICrmCampaign>('CrmCampaign', crmCampaignSchema);
