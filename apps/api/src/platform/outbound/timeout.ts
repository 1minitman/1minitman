import { ProblemError } from '../errors';

/**
 * The outbound timeout helper (MOD-00 plan section 4.1 behaviour 12, [TR §13.1]: a timeout on
 * every outbound call; 1MM-STD-16 section 6). Every vendor adapter wraps each call in
 * `withOutboundTimeout`. The caller always passes the timeout: no call inherits "no limit", and the
 * numbers are per vendor, held in `remote_config` once each adapter seeds its key
 * (GAP-STD16-02), with a coded default for when the config cannot be read.
 */
export interface OutboundTarget {
  /** The vendor or service, for the problem detail and the log: `termii`, `resend`, ... */
  provider: string;
  /** Milliseconds; a positive whole number. */
  timeoutMs: number;
}

/**
 * The vendor did not answer in time. A `ProblemError`, so an unhandled one becomes
 * 504 `provider_timeout` (1MM-STD-13 section 4.1); jobs catch it and retry with backoff.
 */
export class OutboundTimeoutError extends ProblemError {
  constructor(
    readonly provider: string,
    readonly timeoutMs: number,
  ) {
    super('provider_timeout', { detail: `${provider} did not answer within ${timeoutMs} ms` });
    this.name = 'OutboundTimeoutError';
  }
}

const assertTimeout = ({ provider, timeoutMs }: OutboundTarget) => {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`outbound call to ${provider} needs a positive timeout, got ${timeoutMs}`);
  }
};

/**
 * Runs `work` with an `AbortSignal` that fires after `timeoutMs`, and settles by then even when
 * `work` ignores the signal. Pass the signal on to `fetch` or the vendor SDK and read the response
 * body inside `work`, so reading it is bounded too:
 *
 *   const sent = await withOutboundTimeout({ provider: 'resend', timeoutMs }, async (signal) => {
 *     const res = await fetch(url, { method: 'POST', body, signal });
 *     return SendResultSchema.parse(await res.json());
 *   });
 *
 * A timeout rejects with `OutboundTimeoutError`; any other failure of `work` passes through.
 */
export const withOutboundTimeout = async <T>(
  target: OutboundTarget,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  assertTimeout(target);
  const controller = new AbortController();
  const timedOut = new OutboundTimeoutError(target.provider, target.timeoutMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort(timedOut);
      reject(timedOut);
    }, target.timeoutMs);
  });
  try {
    return await Promise.race([work(controller.signal), deadline]);
  } catch (error) {
    // `fetch` rejects with the abort reason or its own AbortError once the signal fires.
    throw controller.signal.aborted ? timedOut : error;
  } finally {
    clearTimeout(timer);
  }
};
