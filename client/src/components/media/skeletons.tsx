import { Skeleton } from '@/components/ui/Skeleton';

/** Skeleton for a horizontal row: heading + poster strip. */
export function RowSkeleton() {
  return (
    <section aria-hidden className="mb-8">
      <Skeleton className="mb-3 ml-4 h-7 w-44 sm:ml-6" />
      <div className="flex gap-3 overflow-hidden px-4 sm:gap-4 sm:px-6">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="w-[9.5rem] shrink-0 sm:w-[11rem]">
            <Skeleton className="aspect-2/3 w-full rounded-xl" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Skeleton for a catalog grid page. */
export function GridSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-2/3 w-full rounded-xl" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the hero block. */
export function HeroSkeleton() {
  return (
    <div aria-hidden className="relative h-[68vh] min-h-105 w-full sm:h-[78vh]">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute inset-x-0 bottom-0 space-y-4 px-4 pb-12 sm:px-8 lg:px-16">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-12 w-2/3 max-w-xl" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-4 w-2/3 max-w-md" />
      </div>
    </div>
  );
}
