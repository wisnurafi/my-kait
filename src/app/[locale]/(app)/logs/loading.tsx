import { Skeleton, SkeletonStatCard } from "@/components/ui/skeleton";

/**
 * Mirrors the redesigned logs layout: page header, 3 summary cards,
 * collapsible filter panel, then the .rtable table skeleton.
 */
export default function LogsLoading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-[52px] rounded-2xl shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-64 max-w-full" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Filter panel */}
      <div className="panel p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      {/* Table rows */}
      <div className="panel overflow-hidden">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 border-b border-border-ink last:border-0"
          >
            <Skeleton className="h-6 w-20 !rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-14 hidden md:block shrink-0" />
            <Skeleton className="h-4 w-20 hidden md:block shrink-0" />
            <Skeleton className="h-4 w-28 hidden lg:block shrink-0" />
            <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
