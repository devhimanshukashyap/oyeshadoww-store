export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="skeleton aspect-[9/13] w-full rounded-none" />
          <div className="space-y-2 p-4">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="skeleton aspect-[9/13] w-full max-w-sm" />
      <div className="space-y-4">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-8 w-2/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
        <div className="skeleton h-4 w-4/6" />
        <div className="mt-6 skeleton h-24 w-full" />
        <div className="skeleton h-12 w-40" />
      </div>
    </div>
  );
}

export function PurchaseListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-3 p-4">
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-3 w-1/3" />
          <div className="skeleton h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ReelListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3 p-3">
          <div className="skeleton h-14 w-10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-3 w-1/5" />
          </div>
          <div className="skeleton h-9 w-24" />
        </div>
      ))}
    </div>
  );
}

export function DashboardCardsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-2 p-4">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border p-4 last:border-b-0">
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="skeleton h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function HealthSkeleton() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="card flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <div className="skeleton h-7 w-7 rounded-full" />
          <div className="space-y-2">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-28" />
          </div>
        </div>
        <div className="skeleton h-9 w-24" />
      </div>

      <div className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton h-3 w-14" />
            <div className="skeleton h-4 w-20" />
          </div>
        ))}
      </div>

      <TableSkeleton rows={4} cols={2} />
      <TableSkeleton rows={4} cols={2} />
      <TableSkeleton rows={2} cols={2} />
      <TableSkeleton rows={3} cols={1} />
    </div>
  );
}
