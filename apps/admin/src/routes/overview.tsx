import { StatusBadge } from '@1minitman/ui-web';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { healthQuery, readinessQuery } from '../lib/api';
import { env } from '../lib/env';

export const Route = createFileRoute('/overview')({ component: Overview });

function Overview() {
  const health = useQuery(healthQuery);
  const ready = useQuery(readinessQuery);
  const checks = ready.data?.checks;

  return (
    <div className="max-w-3xl">
      <h1 className="text-[32px] leading-[38px] font-extrabold tracking-[-0.03em]">Overview</h1>
      <p className="mt-2 text-fg-2">
        The console shell is running. Dashboard tiles arrive with module A33 (milestone M8).
      </p>

      <section aria-labelledby="platform" className="mt-8 rounded-sm border p-4">
        <h2 id="platform" className="text-[20px] font-bold">
          Platform status
        </h2>
        <dl className="mt-4 grid grid-cols-[10rem_1fr] gap-y-3 text-[14px]">
          <dt className="text-fg-2">API</dt>
          <dd data-testid="overview.status.api">
            {health.isPending ? (
              <StatusBadge>Checking</StatusBadge>
            ) : health.isError ? (
              <StatusBadge tone="error">Not reachable at {env.apiUrl}</StatusBadge>
            ) : (
              <StatusBadge tone="success">
                Running · v{health.data.version} · {health.data.environment}
              </StatusBadge>
            )}
          </dd>
          <dt className="text-fg-2">Database</dt>
          <dd data-testid="overview.status.database">
            <Dependency status={checks?.database.status} latency={checks?.database.latency_ms} />
          </dd>
          <dt className="text-fg-2">Redis</dt>
          <dd data-testid="overview.status.redis">
            <Dependency status={checks?.redis.status} latency={checks?.redis.latency_ms} />
          </dd>
        </dl>
      </section>
    </div>
  );
}

function Dependency({ status, latency }: { status?: 'up' | 'down'; latency?: number }) {
  if (!status) return <StatusBadge>Unknown</StatusBadge>;
  return status === 'up' ? (
    <StatusBadge tone="success">Up{latency === undefined ? '' : ` · ${latency} ms`}</StatusBadge>
  ) : (
    <StatusBadge tone="error">Down</StatusBadge>
  );
}
