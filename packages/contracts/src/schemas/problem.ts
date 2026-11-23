import { z } from 'zod';

/** RFC 9457 problem+json. Every error the API returns has this shape. */
export const ProblemSchema = z.object({
  type: z.string().default('about:blank'),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  request_id: z.string(),
  /** Machine reason for gating errors, e.g. "entitlement", "permission", "restricted". */
  reason: z.string().optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;
