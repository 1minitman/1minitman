/** Port: something the service depends on and can ask "are you there?". */
export interface DependencyProbe {
  readonly name: 'database' | 'redis';
  /** Resolves when the dependency answers; rejects otherwise. */
  ping(): Promise<void>;
}

export interface DependencyStatus {
  status: 'up' | 'down';
  latency_ms?: number;
  detail?: string;
}
