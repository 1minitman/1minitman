import { z } from 'zod';

/** Keyset pagination only (never OFFSET). Limits follow the admin spec: 25, 50, 100. */
export const CursorQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export const cursorPage = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    next_cursor: z.string().nullable(),
    prev_cursor: z.string().nullable(),
    has_more: z.boolean(),
  });
