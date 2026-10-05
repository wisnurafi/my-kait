import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

/** Loading state — mirrors admin/(panel)/reports/page.tsx. */
export default function AdminReportsLoading() {
  return (
    <div className="space-y-6">
      {/* Page head */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg!" />
        ))}
      </div>

      {/* Queue table */}
      <SkeletonTable rows={6} />
    </div>
  );
}
