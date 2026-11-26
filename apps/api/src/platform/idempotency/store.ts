/*
 * The store behind `idempotent()` (MOD-00 plan behaviour 8, rule 6). One record per
 * `idem:{route}:{idempotency_key}` [DD §14]: first a lease while the handler runs, then the
 * stored response for 24 h. Claiming the key is atomic, so of any number of requests with one key
 * exactly one runs the handler.
 */

/** A response kept for replay. The body is base64 so any bytes survive. */
export interface StoredResponse {
  status: number;
  headers: [string, string][];
  body: string;
}

export type IdempotencyRecord =
  | { state: 'in_progress'; fingerprint: string; owner: string }
  | { state: 'completed'; fingerprint: string; owner: string; response: StoredResponse };

export type BeginResult =
  /** The key was free: this request owns it and runs the handler. */
  | { claimed: true }
  /** Another request holds or held the key. */
  | { claimed: false; record: IdempotencyRecord };

export interface IdempotencyStore {
  /** Claims `key` for `owner` for `leaseMs`, or returns the record already there. */
  begin(key: string, fingerprint: string, owner: string, leaseMs: number): Promise<BeginResult>;
  /** Stores the response for `ttlMs` if `owner` still holds the key (or it lapsed unclaimed). */
  complete(
    key: string,
    fingerprint: string,
    owner: string,
    response: StoredResponse,
    ttlMs: number,
  ): Promise<boolean>;
  /** Frees the key if `owner` still holds it, so a retry with the same key can run. */
  release(key: string, owner: string): Promise<void>;
}

/** In-memory store for tests and tools: same contract, one process only. */
export const createMemoryIdempotencyStore = (
  now: () => number = Date.now,
): IdempotencyStore & { size(): number } => {
  const records = new Map<string, { record: IdempotencyRecord; expiresAt: number }>();
  const live = (key: string) => {
    const entry = records.get(key);
    if (entry && entry.expiresAt <= now()) {
      records.delete(key);
      return undefined;
    }
    return entry;
  };
  return {
    begin(key, fingerprint, owner, leaseMs) {
      const entry = live(key);
      if (entry) return Promise.resolve({ claimed: false, record: entry.record });
      records.set(key, {
        record: { state: 'in_progress', fingerprint, owner },
        expiresAt: now() + leaseMs,
      });
      return Promise.resolve({ claimed: true });
    },
    complete(key, fingerprint, owner, response, ttlMs) {
      const entry = live(key);
      if (entry && entry.record.owner !== owner) return Promise.resolve(false);
      records.set(key, {
        record: { state: 'completed', fingerprint, owner, response },
        expiresAt: now() + ttlMs,
      });
      return Promise.resolve(true);
    },
    release(key, owner) {
      if (live(key)?.record.owner === owner) records.delete(key);
      return Promise.resolve();
    },
    size: () => records.size,
  };
};
