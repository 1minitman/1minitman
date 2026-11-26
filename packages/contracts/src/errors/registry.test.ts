import { describe, expect, test } from 'bun:test';
import { codeSpan, markdownSections, readRepoFile, tableRows } from '../test-support/sources';
import {
  CLIENT_ERROR_CODES,
  errorMessageKey,
  FIELD_CODES,
  fieldErrorMessageKey,
  isFieldCode,
  isProblemCode,
  PROBLEM_CODE_LIST,
  PROBLEM_CODE_PATTERN,
  PROBLEM_CODES,
  PROBLEM_EXTENSION_MEMBERS,
  problemType,
  RETRY_CLASSES,
} from './registry';

const STANDARD = 'docs/standards/1MM-STD-13-ERROR-CODES.md';

describe('problem-type registry', () => {
  test('codes are unique, match the pattern and each has a status, title and retry class', () => {
    expect(new Set(PROBLEM_CODE_LIST).size).toBe(PROBLEM_CODE_LIST.length);
    for (const code of PROBLEM_CODE_LIST) {
      const entry = PROBLEM_CODES[code];
      expect(code).toMatch(PROBLEM_CODE_PATTERN);
      expect(entry.status).toBeGreaterThanOrEqual(400);
      expect(entry.status).toBeLessThan(600);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(RETRY_CLASSES).toContain(entry.retry);
      for (const member of entry.carries) expect(PROBLEM_EXTENSION_MEMBERS).toContain(member);
    }
  });

  test('client and field codes are unique and never collide with a problem code', () => {
    const all = [...PROBLEM_CODE_LIST, ...CLIENT_ERROR_CODES];
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(FIELD_CODES).size).toBe(FIELD_CODES.length);
    for (const code of [...CLIENT_ERROR_CODES, ...FIELD_CODES]) {
      expect(code).toMatch(PROBLEM_CODE_PATTERN);
    }
  });

  test('type URI and i18n keys are built from the code', () => {
    expect(problemType('not_found')).toBe('tag:1minitman.com,2026:problem:not_found');
    expect(errorMessageKey('rate_limited')).toBe('error.rate_limited');
    expect(errorMessageKey('no_connection')).toBe('error.no_connection');
    expect(fieldErrorMessageKey('too_long')).toBe('error.field.too_long');
  });

  test('guards accept registry values only', () => {
    expect(isProblemCode('validation')).toBe(true);
    expect(isProblemCode('toString')).toBe(false);
    expect(isProblemCode('about:blank')).toBe(false);
    expect(isProblemCode(404)).toBe(false);
    expect(isFieldCode('self')).toBe(true);
    expect(isFieldCode('validation')).toBe(false);
  });

  test('the gating codes of the Technical Reference carry their members', () => {
    expect(PROBLEM_CODES.entitlement.carries).toEqual(['entitlement', 'upsell']);
    expect(PROBLEM_CODES.permission.carries).toEqual(['permission']);
    expect(PROBLEM_CODES.quota_exhausted).toMatchObject({ status: 402, retry: 'upgrade' });
    expect(PROBLEM_CODES.precondition_failed.status).toBe(412);
  });
});

describe('registry against 1MM-STD-13', () => {
  const sections = markdownSections(readRepoFile(STANDARD));
  const section = (number: string) => {
    const text = sections.get(number);
    if (!text) throw new Error(`${STANDARD} has no section ${number}`);
    return text;
  };

  /** Codes with status and retry class from the "Code | Status | When | Retry" tables. */
  const documented = new Map<string, { status: number; retry?: string }>();
  for (const number of ['4.1', '4.4', '4.5']) {
    for (const row of tableRows(section(number), 'Code')) {
      const code = codeSpan(row[0]);
      if (!code) throw new Error(`Unreadable row in ${number}: ${row.join(' | ')}`);
      documented.set(code, { status: Number(row[1]), retry: codeSpan(row[3]) });
    }
  }
  // Sections 4.6 and 4.7 name their codes inside the response cell: "403 `approval_self`".
  for (const number of ['4.6', '4.7']) {
    for (const [, status, code] of section(number).matchAll(/\b(\d{3}) `([a-z][a-z0-9_]+)`/g)) {
      const known = documented.get(code ?? '');
      if (known) expect({ code, status: known.status }).toEqual({ code, status: Number(status) });
      else documented.set(code ?? '', { status: Number(status) });
    }
  }

  test('the list of codes in the standard equals the registry', () => {
    expect([...documented.keys()].sort()).toEqual([...PROBLEM_CODE_LIST].sort());
  });

  test('status and retry class match the standard for every code', () => {
    for (const [code, { status, retry }] of documented) {
      if (!isProblemCode(code)) continue;
      const entry = PROBLEM_CODES[code];
      expect({ code, status: entry.status }).toEqual({ code, status });
      if (retry) expect({ code, retry: entry.retry as string }).toEqual({ code, retry });
    }
  });

  test('client codes (4.2) and field codes (4.3) equal the standard', () => {
    const clientCodes = tableRows(section('4.2'), 'Code').map((row) => codeSpan(row[0]));
    const fieldCodes = tableRows(section('4.3'), 'Field code').map((row) => codeSpan(row[0]));
    expect(clientCodes).toEqual([...CLIENT_ERROR_CODES]);
    expect(fieldCodes).toEqual([...FIELD_CODES]);
  });

  test('retry classes equal section 3', () => {
    const classes = tableRows(readRepoFile(STANDARD), 'Class').map((row) => codeSpan(row[0]));
    expect(classes).toEqual([...RETRY_CLASSES]);
  });
});
