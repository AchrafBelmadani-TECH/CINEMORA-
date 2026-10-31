import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Loading placeholder — decorative by design. */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-white/5', className)} {...rest} />;
}
