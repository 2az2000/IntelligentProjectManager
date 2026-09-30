import { Skeleton } from '@/components/ui/skeleton';

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-44 rounded-xl" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function BoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex gap-6 overflow-hidden">
      {Array.from({ length: columns }, (_, i) => (
        <div key={i} className="flex w-80 shrink-0 flex-col gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-[500px] rounded-xl" />
        </div>
      ))}
    </div>
  );
}
