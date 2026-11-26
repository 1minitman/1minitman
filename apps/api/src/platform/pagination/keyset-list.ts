import {
  keysetPage,
  keysetPlan,
  type KeysetPlan,
  type KeysetPosition,
  type KeysetSort,
} from '@1minitman/db';
import { ProblemError } from '../errors';
import { createCursorCodec } from './cursor';

/*
 * One keyset list of the API: the sorts a route declares (each an indexed, NOT NULL column) and
 * the cursor that pages it. Usage in a handler:
 *
 *   const page = users.plan(query);                    // query: listQuerySchema(...) output
 *   const rows = await tx.select({ ...columns, cursor_key: page.key }).from(t)
 *     .where(and(filters, page.where)).orderBy(...page.orderBy).limit(page.fetch);
 *   return c.json(page.toResponse(rows, toItem));
 */

export interface ListQuery {
  limit: number;
  cursor?: string;
  sort: string;
}

export interface ListPage {
  next_cursor: string | null;
  prev_cursor: string | null;
  has_more: boolean;
}

export interface PlannedPage extends KeysetPlan {
  position: KeysetPosition | undefined;
  toResponse<R extends { cursor_key: string; id: string }, I>(
    rows: readonly R[],
    toItem: (row: R) => I,
  ): ListPage & { items: I[] };
}

export const defineKeysetList = <S extends string>(args: {
  /** Names the list in its cursors; unique across the API (for example `admin.users`). */
  list: string;
  sorts: Record<S, KeysetSort>;
  /** The uuid primary key that breaks ties. */
  id: KeysetSort['column'];
}) => ({
  plan(query: ListQuery): PlannedPage {
    const sort = Object.hasOwn(args.sorts, query.sort) ? args.sorts[query.sort as S] : undefined;
    // The route schema already refuses an unknown sort; this keeps the rule if one does not.
    if (!sort) {
      throw new ProblemError('validation', {
        errors: [{ path: 'sort', code: 'invalid_format', message: 'Unknown sort field' }],
      });
    }
    const codec = createCursorCodec({ list: args.list, sort: query.sort, kind: sort.kind });
    const position = codec.decode(query.cursor);
    const plan = keysetPlan({ sort, id: args.id, limit: query.limit, position });
    return {
      ...plan,
      position,
      toResponse(rows, toItem) {
        const page = keysetPage(rows, { limit: query.limit, position, idOf: (r) => r.id });
        return {
          items: page.rows.map(toItem),
          next_cursor: page.next ? codec.encode(page.next) : null,
          prev_cursor: page.prev ? codec.encode(page.prev) : null,
          has_more: page.hasMore,
        };
      },
    };
  },
});
