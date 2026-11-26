import { describe, expect, test } from 'bun:test';
import { ProblemSchema } from '../schemas/problem';
import { PROBLEM_CODES_EXTENSION, PROBLEM_CONTENT_TYPE, problemResponses } from './operation';

describe('problemResponses()', () => {
  test('always declares internal (500)', () => {
    expect(Object.keys(problemResponses())).toEqual(['500']);
    expect(problemResponses()[500]).toMatchObject({
      description: '`internal`: Internal error',
      [PROBLEM_CODES_EXTENSION]: ['internal'],
    });
  });

  test('groups codes by status, once each, with ProblemSchema', () => {
    const responses = problemResponses(
      'unauthenticated',
      'session_expired',
      'not_found',
      'not_found',
    );
    expect(Object.keys(responses).sort()).toEqual(['401', '404', '500']);
    expect(responses[401]?.[PROBLEM_CODES_EXTENSION]).toEqual([
      'unauthenticated',
      'session_expired',
    ]);
    expect(responses[404]?.[PROBLEM_CODES_EXTENSION]).toEqual(['not_found']);
    expect(responses[401]?.content[PROBLEM_CONTENT_TYPE].schema).toBe(ProblemSchema);
  });
});
