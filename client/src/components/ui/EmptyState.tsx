import type { ComponentType, ReactNode } from 'react';
import { Film } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  message?: string;
  /** Optional action (e.g. a button or link) rendered below the copy. */
  action?: ReactNode;
  className?: string;
}

/** Designed empty state for lists/results — never a blank region. */
export function EmptyState({ icon, title, message, action, className }: EmptyStateProps) {
  const Icon = icon ?? Film;
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-white/5 bg-card/60 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/25 bg-surface text-gold">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {message && <p className="max-w-sm text-sm leading-relaxed text-muted">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
