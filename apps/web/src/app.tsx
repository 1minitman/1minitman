import { StatusBadge } from '@1minitman/ui-web';
import { useQuery } from '@tanstack/react-query';
import { BrandMark } from './components/brand-mark';
import { healthQuery } from './lib/api';

// Scope (OD-15): billing only. Sign-in, the Black Badge pay step, Premium / Gold checkout
// and plan management are added here as the billing API lands. No member features, ever.
export const App = () => {
  const health = useQuery(healthQuery);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 p-6">
      <div className="flex items-center gap-3">
        <BrandMark className="h-10 w-auto" />
        <span className="text-[20px] font-extrabold tracking-[-0.04em]">1minitman</span>
      </div>
      <h1 className="text-[32px] leading-[38px] font-extrabold tracking-[-0.03em]">
        Plan and billing
      </h1>
      <p className="text-fg-2">
        Web billing is not open yet. Manage your plan in the 1minitman app for now.
      </p>
      <div data-testid="web.status.api">
        {health.isPending ? (
          <StatusBadge>Checking the service</StatusBadge>
        ) : health.isError ? (
          <StatusBadge tone="error">Service not reachable</StatusBadge>
        ) : (
          <StatusBadge tone="success">Service running · {health.data.environment}</StatusBadge>
        )}
      </div>
    </main>
  );
};
