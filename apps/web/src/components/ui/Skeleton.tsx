import { cn } from '@/lib/utils';

/**
 * Lightweight skeleton block — Tailwind animate-pulse + paper-darker bg.
 * Use to fill list rows / card slots while data loads.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-line/70', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/** Pre-built table row skeleton (7 columns, 5 rows). */
export function LeadsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="border-b border-line bg-slate-50 px-4 py-3">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-[100px_80px_1fr_1fr_120px_100px_60px] gap-4 px-4 py-3.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-6 w-full rounded-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pre-built card skeleton for subscription/profile panels. */
export function PanelCardSkeleton() {
  return (
    <div className="space-y-6 rounded-3xl border border-line bg-white p-8 md:p-10">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-48" />
        </div>
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-11 w-44 rounded-full" />
        <Skeleton className="h-11 w-32 rounded-full" />
      </div>
    </div>
  );
}
