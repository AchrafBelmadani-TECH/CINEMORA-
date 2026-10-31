import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  /** Wired to TanStack Query refetch — a real retry, not decoration. */
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

/** Designed failure state — the UI never blanks out on API errors. */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not reach the catalog. Check your connection and try again.',
  onRetry,
  compact = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-red-500/15 bg-red-500/5 text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-red-400/25 bg-surface text-red-300">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <h3 className={cn('font-semibold text-ink', compact ? 'text-sm' : 'text-lg')}>{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted sm:text-sm">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-ink transition-colors duration-200 hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}
