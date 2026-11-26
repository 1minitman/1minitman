import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { fieldErrorsFromIssues } from '../errors/field-errors';
import {
  CursorQuerySchema,
  DEFAULT_PAGE_LIMIT,
  PAGE_LIMITS,
  cursorPage,
  listQuerySchema,
} from './pagination';

describe('CursorQuerySchema', () => {
  test('accepts 25, 50 and 100 from a query string and defaults to 50', () => {
    for (const limit of PAGE_LIMITS) {
      expect(CursorQuerySchema.parse({ limit: String(limit) }).limit).toBe(limit);
    }
    expect(CursorQuerySchema.parse({}).limit).toBe(DEFAULT_PAGE_LIMIT);
  });

  test.each(['10', '0', '-25', '101', '50.5', 'abc'])('refuses limit %p', (limit) => {
    const result = CursorQuerySchema.safeParse({ limit });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromIssues(result.error.issues)[0]?.path).toBe('limit');
    }
  });

  test('an empty cursor is refused; a present one is passed through untouched', () => {
    expect(CursorQuerySchema.safeParse({ cursor: '' }).success).toBe(false);
    expect(CursorQuerySchema.parse({ cursor: 'abc_-' }).cursor).toBe('abc_-');
  });
});

describe('listQuerySchema', () => {
  const Query = listQuerySchema(['created_at', 'name'] as const, 'created_at');

  test('uses the default sort when none is sent', () => {
    expect(Query.parse({})).toEqual({ limit: 50, sort: 'created_at' });
  });

  test('an unknown sort field is a validation error on `sort`', () => {
    const result = Query.safeParse({ sort: 'password_hash' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromIssues(result.error.issues)).toEqual([
        expect.objectContaining({ path: 'sort', code: 'invalid_format' }),
      ]);
    }
  });
});

describe('cursorPage', () => {
  const Page = cursorPage(z.object({ id: z.string() }));

  test('count_estimate is optional and never negative', () => {
    const page = { items: [{ id: 'a' }], next_cursor: null, prev_cursor: null, has_more: false };
    expect(Page.safeParse(page).success).toBe(true);
    expect(Page.safeParse({ ...page, count_estimate: 10 }).success).toBe(true);
    expect(Page.safeParse({ ...page, count_estimate: -1 }).success).toBe(false);
  });
});
