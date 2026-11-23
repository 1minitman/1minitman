import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'error';

const DOT: Record<StatusTone, string> = {
  neutral: 'bg-fg-3',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
};

/** A state label. Colour is never the only signal: the text always says the state. */
export const StatusBadge = ({
  tone = 'neutral',
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) => (
  <span className="inline-flex items-center gap-2 rounded-sm border px-2 py-1 text-[12px] font-semibold">
    <span aria-hidden className={cn('size-2 rounded-full', DOT[tone])} />
    {children}
  </span>
);
