import { describe, expect, test } from 'bun:test';
import {
  CLIENT_ERROR_CODES,
  errorMessageKey,
  FIELD_CODES,
  fieldErrorMessageKey,
  isProblemCode,
  PROBLEM_CODE_LIST,
  PROBLEM_CODES,
} from './errors/registry';
import { declaredProblemCodes } from './test-support/openapi';
import { readRepoFile } from './test-support/sources';

/*
 * Every code a client can meet has an English message (1MM-STD-13 section 5.2, GAP-STD13-03):
 * the platform codes of section 4.1, the client codes of 4.2, the field codes of 4.3, and every
 * code an operation declares. Later codes arrive with the route that returns them.
 */

const catalogue = JSON.parse(readRepoFile('packages/i18n/src/locales/en.json')) as Record<
  string,
  string
>;
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '');

describe('error messages in the en catalogue', () => {
  const platform = PROBLEM_CODE_LIST.filter((code) => PROBLEM_CODES[code].group === 'platform');

  test('every platform and client code has error.<code>', () => {
    const missing = [...platform, ...CLIENT_ERROR_CODES]
      .map(errorMessageKey)
      .filter((key) => !catalogue[key]);
    expect(missing).toEqual([]);
  });

  test('every code an operation declares has error.<code>', () => {
    const missing = [...declaredProblemCodes()]
      .filter(isProblemCode)
      .map(errorMessageKey)
      .filter((key) => !catalogue[key]);
    expect(missing).toEqual([]);
  });

  test('every field code has error.field.<code> using only {label}, {min}, {max}', () => {
    for (const code of FIELD_CODES) {
      const message = catalogue[fieldErrorMessageKey(code)];
      expect({ code, present: Boolean(message) }).toEqual({ code, present: true });
      for (const name of placeholders(message ?? ''))
        expect(['label', 'min', 'max']).toContain(name);
    }
  });

  test('no error.* key names a code that does not exist', () => {
    const known = new Set<string>([
      ...PROBLEM_CODE_LIST.map(errorMessageKey),
      ...CLIENT_ERROR_CODES.map(errorMessageKey),
      ...FIELD_CODES.map(fieldErrorMessageKey),
    ]);
    const stray = Object.keys(catalogue).filter(
      (key) => key.startsWith('error.') && !known.has(key),
    );
    expect(stray).toEqual([]);
  });

  test('no message is "Something went wrong" alone (1MM-STD-04 section 14)', () => {
    for (const [key, text] of Object.entries(catalogue)) {
      if (key.startsWith('error.')) expect(text.trim()).not.toMatch(/^something went wrong\.?$/i);
    }
  });
});
