import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REDACTED, redactFields } from './redact';

/** The code below the header comment, which is the only part allowed to differ. */
const code = (path: string) => {
  const source = readFileSync(path, 'utf8');
  return source.slice(source.indexOf('export const REDACTED'));
};

test('the worker copy matches the API redaction (REP-037: change both together)', () => {
  const api = join(import.meta.dir, '../../../api/src/platform/redact.ts');
  expect(code(join(import.meta.dir, 'redact.ts'))).toBe(code(api));
});

test('walks class instances as well as plain objects', () => {
  class VendorReply {
    constructor(
      readonly status: string,
      readonly token: string,
    ) {}
  }
  expect(redactFields({ reply: new VendorReply('ok', 't0ken') })).toEqual({
    reply: { status: 'ok', token: REDACTED },
  });
});
