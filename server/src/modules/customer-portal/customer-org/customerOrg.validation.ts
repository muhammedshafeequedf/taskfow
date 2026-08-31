import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  contactEmail: z.string().email().toLowerCase().trim(),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  description: z.string().max(500).optional(),
  logo: z.string().url().optional(),
  contactPhone: z.string().optional(),
  adminName: z.string().min(1).trim(),
  adminEmail: z.string().email().toLowerCase().trim(),
  leadId: z.string().optional(),
  dealId: z.string().optional(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  contactEmail: z.string().email().toLowerCase().trim().optional(),
  description: z.string().max(500).optional(),
  logo: z.string().url().optional(),
  contactPhone: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
