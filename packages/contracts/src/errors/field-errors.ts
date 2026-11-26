import type { z } from 'zod';
import type { FieldError } from '../schemas/problem';
import { isFieldCode, type FieldCode } from './registry';

/**
 * Maps zod issues to the field codes of 1MM-STD-13 section 4.3, so the API's 422 and a client's
 * own check name a failure the same way. A helper that knows better (for example
 * `boundedText()`) attaches the code itself as `params.field_code`.
 */

type Issue = z.core.$ZodIssue;

const MISSING = /received (undefined|null)$/;

export const fieldCodeFromIssue = (issue: Issue): FieldCode => {
  switch (issue.code) {
    case 'custom': {
      const code: unknown = issue.params?.field_code;
      return isFieldCode(code) ? code : 'invalid_format';
    }
    case 'invalid_type':
      return MISSING.test(issue.message) ? 'required' : 'invalid_format';
    case 'too_small':
      if (issue.origin === 'string') return issue.minimum === 1 ? 'required' : 'too_short';
      return 'out_of_range';
    case 'too_big':
      return issue.origin === 'string' ? 'too_long' : 'out_of_range';
    default:
      // invalid_format, invalid_value (enum), unrecognized_keys, invalid_union, invalid_key,
      // invalid_element, not_multiple_of: the value has the wrong shape.
      return 'invalid_format';
  }
};

/** The `errors` member of a `validation` problem. An unknown key becomes one entry per key. */
export const fieldErrorsFromIssues = (issues: readonly Issue[], prefix = ''): FieldError[] =>
  issues.flatMap((issue) => {
    const base = [prefix, ...issue.path.map(String)].filter(Boolean);
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        path: [...base, key].join('.'),
        code: 'invalid_format' as const,
        message: issue.message,
      }));
    }
    return [{ path: base.join('.'), code: fieldCodeFromIssue(issue), message: issue.message }];
  });
