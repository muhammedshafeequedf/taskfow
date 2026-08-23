import mongoose, { Document, Schema } from 'mongoose';

export type CrmContactOrigin = 'crm' | 'lead' | 'portal' | 'hrms' | 'staff';

export interface ICrmContact extends Document {
  taskflowOrganizationId: mongoose.Types.ObjectId;
  accountId?: mongoose.Types.ObjectId;
  customerOrgId?: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  isPrimary: boolean;
  linkedIn?: string;
  marketingConsent: boolean;
  origin: CrmContactOrigin;
  customerUserId?: mongoose.Types.ObjectId;
  employeeId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const crmContactSchema = new Schema<ICrmContact>(
  {
    taskflowOrganizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'CrmAccount', index: true },
    customerOrgId: { type: Schema.Types.ObjectId, ref: 'CustomerOrg', index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String },
    title: { type: String },
    department: { type: String },
    isPrimary: { type: Boolean, default: false },
    linkedIn: { type: String },
    marketingConsent: { type: Boolean, default: false },
    origin: { type: String, enum: ['crm', 'lead', 'portal', 'hrms', 'staff'], default: 'crm', index: true },
    customerUserId: { type: Schema.Types.ObjectId, ref: 'CustomerUser' },
    employeeId: { type: Schema.Types.ObjectId, ref: 'HrmsEmployee' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

crmContactSchema.index({ taskflowOrganizationId: 1, email: 1 });

export const CrmContact = mongoose.model<ICrmContact>('CrmContact', crmContactSchema);
