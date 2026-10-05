import { Skeleton, SkeletonStatCard, SkeletonChart } from "@/components/ui/skeleton";

/** Loading state — mirrors admin/(panel)/page.tsx (overview). */
export default function AdminOverviewLoading() {
  return (
    <div className="space-y-6">
      {/* Page head */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-[52px] rounded-full!" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Activity charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Latest reports panel */}
        <div className="panel p-5 space-y-3">
          <Skeleton className="h-5 w-44" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 border-t border-border-ink pt-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
        {/* Health panel */}
        <div className="panel p-5 space-y-3">
          <Skeleton className="h-5 w-44" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-t border-border-ink pt-3"
            >
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-6 w-12 rounded-full!" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
