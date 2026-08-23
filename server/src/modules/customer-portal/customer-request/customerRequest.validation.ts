import { z } from 'zod';

export const createRequestSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200).trim(),
  description: z.string().default(''),
  type: z.enum(['bug', 'feature', 'suggestion', 'concern', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  attachments: z.array(z.string()).default([]),
});

export const listRequestsQuerySchema = z.object({
  status: z.string().optional(),
  projectId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reviewRequestSchema = z.object({
  note: z.string().optional(),
  reason: z.string().optional(),
  workClassification: z.enum(['billable_change', 'fix']).optional(),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;
export type ReviewRequestInput = z.infer<typeof reviewRequestSchema>;
