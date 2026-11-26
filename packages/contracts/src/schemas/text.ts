import { z } from 'zod';
import type { FieldCode } from '../errors/registry';

/*
 * Text normalisation and length (1MM-STD-21 sections 4 and 5, GAP-STD21-01). The client runs
 * these before it validates and sends; the API runs them again before it validates and stores.
 * Length is counted in Unicode code points, the unit of PostgreSQL `char_length()`, so the
 * client, the API and the CHECK constraints agree on an emoji near the limit.
 */

/** Unicode category Cc (C0, DEL, C1). */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;
// eslint-disable-next-line no-control-regex
const CONTROL_EXCEPT_NEWLINE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;
const LINE_SEPARATORS = /[\u2028\u2029]/g;

/** Characters as people count them: Unicode code points, not UTF-16 code units. */
export const codePointLength = (value: string): number => [...value].length;

/** Steps 1, 2, 4: NFC, no control characters or line breaks, trimmed. */
export const normalizeSingleLine = (value: string): string =>
  value.normalize('NFC').replace(CONTROL, '').replace(LINE_SEPARATORS, '').trim();

/** Steps 1, 2, 3: NFC, line endings to `\n`, no other control characters, trimmed. */
export const normalizeMultiLine = (value: string): string =>
  value
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(LINE_SEPARATORS, '\n')
    .replace(CONTROL_EXCEPT_NEWLINE, '')
    .trim();

/** Step 5: single-line rules, then the domain part lower-cased; the local part kept as typed. */
export const normalizeEmail = (value: string): string => {
  const text = normalizeSingleLine(value);
  const at = text.lastIndexOf('@');
  return at < 0 ? text : `${text.slice(0, at)}@${text.slice(at + 1).toLowerCase()}`;
};

/**
 * Step 6, first half: spaces, dashes, dots and brackets removed. Parsing a national number
 * with the member's country as the default needs the phone metadata and lands with the first
 * phone form; a value that is already E.164 passes `E164Schema` after this step.
 */
export const normalizePhoneInput = (value: string): string =>
  normalizeSingleLine(value).replace(/[\s\-.()[\]]/g, '');

export interface BoundedTextOptions {
  /** Minimum length in code points. 1 or more makes an empty value `required`. */
  min?: number;
  /** Maximum length in code points. */
  max?: number;
  /** Multi-line text keeps `\n` (step 3); single-line text loses line breaks (step 4). */
  multiline?: boolean;
}

const issue = (code: FieldCode, message: string, bound?: { min?: number; max?: number }) => ({
  code: 'custom' as const,
  message,
  params: { field_code: code, ...bound },
});

/**
 * A text field with optional bounds (1MM-STD-21 section 3). A bound that is `undefined` is
 * skipped, so a client with no config value never refuses what the server would accept.
 * Failures carry the field code (`required`, `too_short`, `too_long`) and the bound.
 */
export const boundedText = ({ min, max, multiline = false }: BoundedTextOptions = {}) =>
  z
    .string()
    .overwrite(multiline ? normalizeMultiLine : normalizeSingleLine)
    .superRefine((value, ctx) => {
      const length = codePointLength(value);
      if (length === 0 && min !== undefined && min > 0) {
        ctx.addIssue(issue('required', 'Required', { min }));
        return;
      }
      if (min !== undefined && length < min) {
        ctx.addIssue(issue('too_short', `Must be at least ${min} characters`, { min }));
      }
      if (max !== undefined && length > max) {
        ctx.addIssue(issue('too_long', `Must be at most ${max} characters`, { max }));
      }
    });
