import type { DependencyProbe, DependencyStatus } from '../domain/dependency-probe';

export interface ReadinessReport {
  status: 'ready' | 'degraded';
  checks: Record<DependencyProbe['name'], DependencyStatus>;
}

const TIMEOUT_MS = 2_000;

const check = async (probe: DependencyProbe): Promise<DependencyStatus> => {
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      probe.ping(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS} ms`)), TIMEOUT_MS);
      }),
    ]);
    return { status: 'up', latency_ms: Math.round(performance.now() - started) };
  } catch (error) {
    return { status: 'down', detail: error instanceof Error ? error.message : 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
};

/** Use case: ask every dependency in parallel and summarise. */
export const createCheckReadiness =
  (probes: { database: DependencyProbe; redis: DependencyProbe }) =>
  async (): Promise<ReadinessReport> => {
    const [database, redis] = await Promise.all([check(probes.database), check(probes.redis)]);
    const ready = database.status === 'up' && redis.status === 'up';
    return { status: ready ? 'ready' : 'degraded', checks: { database, redis } };
  };

export type CheckReadiness = ReturnType<typeof createCheckReadiness>;
