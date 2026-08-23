import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICustomerRequest extends Document {
  customerOrgId: Types.ObjectId;
  projectId: Types.ObjectId;
  title: string;
  description: string;
  type: 'bug' | 'feature' | 'suggestion' | 'concern' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  attachments: string[];
  createdBy: Types.ObjectId;
  approvalFlow: {
    customerAdminStage: {
      required: boolean;
      status: 'pending' | 'approved' | 'rejected' | 'skipped';
      reviewedBy?: Types.ObjectId;
      reviewedAt?: Date;
      note?: string;
    };
    taskflowStage: {
      status: 'pending' | 'approved' | 'rejected';
      reviewedBy?: Types.ObjectId;
      reviewedAt?: Date;
      note?: string;
    };
  };
  status:
    | 'draft'
    | 'submitted'
    | 'pending_customer_approval'
    | 'pending_taskflow_approval'
    | 'approved'
    | 'rejected'
    | 'ticket_created'
    | 'in_progress'
    | 'resolved'
    | 'closed';
  linkedIssueId?: Types.ObjectId;
  linkedIssueKey?: string;
  linkedServiceTicketId?: Types.ObjectId;
  workClassification?: 'billable_change' | 'fix';
  closureEmailSentAt?: Date;
  portalComments?: Array<{
    body: string;
    authorName: string;
    customerId: Types.ObjectId;
    forwardedToIssue: boolean;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const customerRequestSchema = new Schema<ICustomerRequest>(
  {
    customerOrgId: { type: Schema.Types.ObjectId, ref: 'CustomerOrg', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['bug', 'feature', 'suggestion', 'concern', 'other'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    attachments: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'CustomerUser', required: true },
    approvalFlow: {
      customerAdminStage: {
        required: { type: Boolean, default: true },
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected', 'skipped'],
          default: 'pending',
        },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'CustomerUser' },
        reviewedAt: { type: Date },
        note: { type: String },
      },
      taskflowStage: {
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        reviewedAt: { type: Date },
        note: { type: String },
      },
    },
    status: {
      type: String,
      enum: [
        'draft',
        'submitted',
        'pending_customer_approval',
        'pending_taskflow_approval',
        'approved',
        'rejected',
        'ticket_created',
        'in_progress',
        'resolved',
        'closed',
      ],
      default: 'submitted',
    },
    linkedIssueId: { type: Schema.Types.ObjectId, ref: 'Issue' },
    linkedIssueKey: { type: String },
    linkedServiceTicketId: { type: Schema.Types.ObjectId, ref: 'ServiceTicket' },
    workClassification: { type: String, enum: ['billable_change', 'fix'] },
    closureEmailSentAt: { type: Date },
    portalComments: {
      type: [
        {
          body: { type: String, required: true },
          authorName: { type: String, required: true },
          customerId: { type: Schema.Types.ObjectId, ref: 'CustomerUser', required: true },
          forwardedToIssue: { type: Boolean, default: false },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

customerRequestSchema.index({ customerOrgId: 1, status: 1 });
customerRequestSchema.index({ customerOrgId: 1, createdBy: 1 });
customerRequestSchema.index({ linkedIssueId: 1 });
customerRequestSchema.index({ linkedServiceTicketId: 1 });

export const CustomerRequest = mongoose.model<ICustomerRequest>('CustomerRequest', customerRequestSchema);
