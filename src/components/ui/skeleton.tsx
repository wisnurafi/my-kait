import { cn } from "@/lib/utils";

/**
 * Neon Glass Skeleton — shimmer sweep animation.
 * Compose precise loading states per surface.
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("shimmer", className)} style={style} aria-hidden />;
}

/** Stat card skeleton (dashboard) */
export function SkeletonStatCard() {
  return (
    <div className="panel p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-20" />
    </div>
  );
}

/** Template/webhook card skeleton */
export function SkeletonCard() {
  return (
    <div className="panel p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-16 rounded-full!" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/** Chart skeleton (dashboard stats) */
export function SkeletonChart() {
  return (
    <div className="panel p-5 space-y-4">
      <Skeleton className="h-5 w-40" />
      <div className="flex items-end gap-1.5 h-32">
        {Array.from({ length: 14 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            // deterministic pseudo-random heights (no hydration mismatch)
            style={{ height: `${30 + ((i * 37) % 70)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Editor skeleton — mirrors Editor: PageHeader (media + title + mode
 * segmented control), toolbar row, then the 2-column grid (composer left,
 * sticky preview right). */
export function SkeletonEditor() {
  return (
    <div className="space-y-6">
      {/* PageHeader: media + eyebrow/title + segmented control */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Skeleton className="size-[52px] rounded-2xl shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-56 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-64 max-w-full rounded-lg" />
      </div>

      {/* Toolbar: undo/redo · JSON · save */}
      <div className="flex gap-2 flex-wrap">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>

      {/* 2-column grid: composer + live preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <div className="panel p-5 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="panel p-5 space-y-3">
            <Skeleton className="h-5 w-44" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          </div>
        </div>
        <div className="panel p-5 space-y-3 min-w-0">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Table skeleton (logs) */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="panel overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 flex items-center gap-3 border-b border-border-ink last:border-0">
          <Skeleton className="h-6 w-6 rounded-full!" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full!" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}
