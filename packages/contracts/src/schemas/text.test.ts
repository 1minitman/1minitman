import { describe, expect, test } from 'bun:test';
import { fieldErrorsFromIssues } from '../errors/field-errors';
import {
  boundedText,
  codePointLength,
  normalizeEmail,
  normalizeMultiLine,
  normalizePhoneInput,
  normalizeSingleLine,
} from './text';
import { E164Schema } from './primitives';

const codesOf = (schema: ReturnType<typeof boundedText>, value: unknown) => {
  const result = schema.safeParse(value);
  return result.success ? [] : fieldErrorsFromIssues(result.error.issues).map((e) => e.code);
};

// "é" composed (NFC, 1 code point) and decomposed (NFD, 2 code points).
const NFC_E = 'é';
const NFD_E = 'é';
const EMOJI = '\u{1F600}'; // 2 UTF-16 code units, 1 code point

describe('length in code points (1MM-STD-21 section 5)', () => {
  test('an emoji counts once, unlike String.length', () => {
    expect(EMOJI.length).toBe(2);
    expect(codePointLength(EMOJI)).toBe(1);
    expect(codePointLength(`ab${EMOJI}`)).toBe(3);
  });
});

describe('normalisation (1MM-STD-21 section 4)', () => {
  test('NFD is composed to NFC', () => {
    expect(normalizeSingleLine(`caf${NFD_E}`)).toBe(`caf${NFC_E}`);
    expect(normalizeMultiLine(`caf${NFD_E}`)).toBe(`caf${NFC_E}`);
  });

  test('single-line text is trimmed and loses control characters and line breaks', () => {
    expect(normalizeSingleLine('  Ada \u0007Lovelace\n ')).toBe('Ada Lovelace');
    expect(normalizeSingleLine('a b\r\nc\u0085')).toBe('abc');
  });

  test('multi-line text keeps line breaks as \\n and loses other control characters', () => {
    expect(normalizeMultiLine(' one\r\ntwo\rthree four\t\u0000 ')).toBe('one\ntwo\nthree\nfour');
  });

  test('right-to-left text is kept as typed', () => {
    expect(normalizeSingleLine(' مرحبا ')).toBe('مرحبا');
  });

  test('e-mail: domain lower-cased, local part kept', () => {
    expect(normalizeEmail('  Ada.Lovelace@Example.COM ')).toBe('Ada.Lovelace@example.com');
    expect(normalizeEmail('no-at-sign')).toBe('no-at-sign');
    expect(normalizeEmail('"a@b"@Host.ORG')).toBe('"a@b"@host.org');
  });

  test('phone: spaces, dashes, dots and brackets removed', () => {
    const value = normalizePhoneInput(' +234 (803) 123-45.67 ');
    expect(value).toBe('+2348031234567');
    expect(E164Schema.safeParse(value).success).toBe(true);
  });
});

describe('boundedText()', () => {
  const field = boundedText({ min: 2, max: 5 });

  test('boundaries: min - 1, min, max, max + 1', () => {
    expect(codesOf(field, 'a')).toEqual(['too_short']);
    expect(codesOf(field, 'ab')).toEqual([]);
    expect(codesOf(field, 'abcde')).toEqual([]);
    expect(codesOf(field, 'abcdef')).toEqual(['too_long']);
  });

  test('empty or white space only is required when there is a minimum', () => {
    expect(codesOf(field, '')).toEqual(['required']);
    expect(codesOf(field, '   \n\t ')).toEqual(['required']);
    expect(codesOf(boundedText({ max: 5 }), '   ')).toEqual([]);
  });

  test('emoji and combining marks count as people see them', () => {
    expect(codesOf(field, EMOJI.repeat(5))).toEqual([]);
    expect(codesOf(field, EMOJI.repeat(6))).toEqual(['too_long']);
    // Five decomposed "é" are ten code points before NFC and five after.
    expect(codesOf(field, NFD_E.repeat(5))).toEqual([]);
  });

  test('the parsed value is normalised', () => {
    expect(field.parse(`  caf${NFD_E} `)).toBe(`caf${NFC_E}`);
    expect(boundedText({ multiline: true }).parse(' a\r\nb ')).toBe('a\nb');
  });

  test('control characters are removed before the length is counted', () => {
    expect(codesOf(field, 'ab\u0000\u0000\u0000\u0000')).toEqual([]);
  });

  test('an undefined bound is skipped', () => {
    expect(codesOf(boundedText({ min: undefined, max: undefined }), 'x'.repeat(10_000))).toEqual(
      [],
    );
    expect(codesOf(boundedText(), '')).toEqual([]);
  });

  test('a non-string is invalid_format, a missing value is required', () => {
    expect(codesOf(field, 42)).toEqual(['invalid_format']);
    expect(codesOf(field, undefined)).toEqual(['required']);
  });

  test('the issue carries the bound for the message placeholders', () => {
    const result = field.safeParse('abcdef');
    expect(result.error?.issues[0]).toMatchObject({ params: { field_code: 'too_long', max: 5 } });
  });
});
