import { z } from 'zod';
import { CursorSchema } from './primitives';

/*
 * Keyset pagination only, never OFFSET (MOD-00 plan section 4.1 behaviour 9, rule 7). The API
 * encodes the cursor and checks that it belongs to the list and sort that issued it
 * (`apps/api/src/platform/pagination`).
 */

/** Page sizes a list accepts: 25, 50 or 100 [ADM §1.4]. Any other value is a 422. */
export const PAGE_LIMITS = [25, 50, 100] as const;
export type PageLimit = (typeof PAGE_LIMITS)[number];
export const DEFAULT_PAGE_LIMIT: PageLimit = 50;

export const PageLimitSchema = z.coerce
  .number()
  .pipe(z.literal(PAGE_LIMITS))
  .default(DEFAULT_PAGE_LIMIT);

export const CursorQuerySchema = z.object({
  limit: PageLimitSchema,
  cursor: CursorSchema.optional(),
});
export type CursorQuery = z.infer<typeof CursorQuerySchema>;

/**
 * Query schema of a sortable list: `limit`, `cursor` and `sort`, where `sort` is one of the
 * values the route declares (each maps to an indexed column in the API). An unknown sort value
 * is a 422 `validation` [ADM §1.4], [TR §8.1].
 */
export const listQuerySchema = <const S extends readonly [string, ...string[]]>(
  sorts: S,
  defaultSort: S[number],
) =>
  CursorQuerySchema.extend({
    sort: z.enum(sorts).default(defaultSort as never),
  });

/**
 * One page of a list. `has_more` is true when `next_cursor` is set. `count_estimate` is
 * optional and approximate (never a COUNT over the whole table on a hot path).
 */
export const cursorPage = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    next_cursor: CursorSchema.nullable(),
    prev_cursor: CursorSchema.nullable(),
    has_more: z.boolean(),
    count_estimate: z.number().int().nonnegative().optional(),
  });
