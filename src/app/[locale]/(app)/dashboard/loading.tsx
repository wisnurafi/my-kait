import { Skeleton, SkeletonStatCard, SkeletonChart } from "@/components/ui/skeleton";

/**
 * Mirrors the redesigned dashboard layout:
 * PageHeader (media + eyebrow/title/description + actions) ->
 * stat cards + caption -> "Statistik" heading ->
 * daily chart (2 cols) + donut -> recent activity panel.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* PageHeader: media + eyebrow/title/description + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Skeleton className="size-[52px] rounded-2xl shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
      </div>

      {/* Stat cards + caption */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
      </div>

      {/* "Statistik" section heading */}
      <Skeleton className="h-6 w-48" />

      {/* Charts: daily (spans 2) + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SkeletonChart />
        </div>
        <div className="panel p-5 flex flex-col items-center space-y-4">
          <Skeleton className="h-5 w-32 self-start" />
          <Skeleton className="size-[140px] rounded-full!" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      {/* Recent activity panel */}
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-ink">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-20" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-5 py-3 border-b border-border-ink last:border-0"
          >
            <Skeleton className="h-6 w-20 rounded-full! shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-40 max-w-full" />
            </div>
            <Skeleton className="h-4 w-14 hidden md:block shrink-0" />
            <Skeleton className="h-4 w-16 hidden md:block shrink-0" />
            <Skeleton className="h-4 w-24 hidden lg:block shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
