import type { Environment } from '@1minitman/contracts';
import { cn } from '@1minitman/ui-web';

// Admin spec A04: production solid, staging outlined, dev / local dashed. Never a coloured stripe.
const STYLE: Record<Environment, string> = {
  production: 'bg-inverse-bg text-inverse-fg border-inverse-bg',
  staging: 'border-border-strong',
  demo: 'border-border-strong',
  dev: 'border-dashed border-border-strong',
  local: 'border-dashed border-border-strong',
};

export const EnvironmentBadge = ({ environment }: { environment: Environment | undefined }) => (
  <span
    data-testid="shell.environment.badge"
    className={cn(
      'rounded-sm border px-2 py-0.5 text-[12px] font-extrabold tracking-[0.12em] uppercase',
      environment ? STYLE[environment] : 'border-dashed border-border-strong text-fg-3',
    )}
  >
    {environment ?? 'offline'}
  </span>
);
