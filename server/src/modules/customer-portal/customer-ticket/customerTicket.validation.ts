import { z } from 'zod';

export const addTicketCommentSchema = z.object({
  body: z.string().min(1).max(8000),
});
