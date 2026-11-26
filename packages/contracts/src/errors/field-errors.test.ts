import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { boundedText } from '../schemas/text';
import { fieldCodeFromIssue, fieldErrorsFromIssues } from './field-errors';

const schema = z.strictObject({
  name: z.string(),
  nickname: z.string().min(3).max(5),
  title: z.string().min(1),
  age: z.number().int().min(18).max(99),
  kind: z.enum(['a', 'b']),
  email: z.email(),
  tags: z.array(z.string()).min(1),
  note: boundedText({ max: 3 }),
  target: z.string().refine((v) => v !== 'me', { message: 'self', params: { field_code: 'self' } }),
  other: z.string().refine(() => false, { message: 'x', params: { field_code: 'nonsense' } }),
  nested: z.object({ count: z.number() }),
});

const errorsFor = (input: unknown) => {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('expected a failure');
  return Object.fromEntries(
    fieldErrorsFromIssues(result.error.issues).map((e) => [e.path, e.code]),
  );
};

describe('field codes from zod issues', () => {
  const codes = errorsFor({
    nickname: 'ab',
    title: '',
    age: 120,
    kind: 'c',
    email: 'not-an-email',
    tags: [],
    note: 'abcd',
    target: 'me',
    other: 'x',
    nested: { count: 'one' },
    extra: true,
  });

  test('a missing field is required', () => expect(codes.name).toBe('required'));
  test('a short string is too_short, an empty one with min 1 is required', () => {
    expect(codes.nickname).toBe('too_short');
    expect(codes.title).toBe('required');
  });
  test('numbers and counts out of bounds are out_of_range', () => {
    expect(codes.age).toBe('out_of_range');
    expect(codes.tags).toBe('out_of_range');
  });
  test('wrong shapes are invalid_format', () => {
    expect(codes.kind).toBe('invalid_format');
    expect(codes.email).toBe('invalid_format');
    expect(codes['nested.count']).toBe('invalid_format');
  });
  test('an unknown key is reported once per key at its own path', () => {
    expect(codes.extra).toBe('invalid_format');
  });
  test('a helper-attached code wins; an unknown attached code falls back', () => {
    expect(codes.note).toBe('too_long');
    expect(codes.target).toBe('self');
    expect(codes.other).toBe('invalid_format');
  });
  test('a long string is too_long', () => {
    expect(errorsFor({ ...validInput, nickname: 'abcdef' }).nickname).toBe('too_long');
  });
  test('null counts as missing', () => {
    expect(errorsFor({ ...validInput, name: null }).name).toBe('required');
  });
  test('a prefix is prepended to every path', () => {
    const result = z.object({ a: z.string() }).safeParse({});
    expect(result.success).toBe(false);
    expect(fieldErrorsFromIssues(result.error?.issues ?? [], 'body')).toEqual([
      { path: 'body.a', code: 'required', message: expect.any(String) },
    ]);
  });
  test('a non-string type mismatch is invalid_format', () => {
    const result = z.number().safeParse('1');
    expect(fieldCodeFromIssue(result.error!.issues[0]!)).toBe('invalid_format');
  });
});

const validInput = {
  name: 'n',
  nickname: 'abc',
  title: 't',
  age: 30,
  kind: 'a',
  email: 'a@b.co',
  tags: ['x'],
  note: 'ok',
  target: 'you',
  other: 'x',
  nested: { count: 1 },
};
