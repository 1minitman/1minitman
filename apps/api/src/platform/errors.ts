import { PROBLEM_CODES, type ProblemCode, type ProblemExtensions } from '@1minitman/contracts';

export interface ProblemDetails extends ProblemExtensions {
  /** English, occurrence-specific, safe for a developer: no personal data, SQL or stack. */
  detail?: string;
}

/**
 * Domain and application code throws ProblemError with a registry code; status, title and type
 * come from the registry (1MM-STD-13 section 8). It carries no framework type, so the
 * clean-architecture lint rule allows it in every layer; `platform/http/problem.ts` turns it
 * into problem+json.
 */
export class ProblemError extends Error {
  readonly status: number;

  constructor(
    readonly code: ProblemCode,
    readonly details: ProblemDetails = {},
  ) {
    super(details.detail ?? PROBLEM_CODES[code].title);
    this.name = 'ProblemError';
    this.status = PROBLEM_CODES[code].status;
  }
}
