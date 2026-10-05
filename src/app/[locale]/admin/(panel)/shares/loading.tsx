import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

/** Loading state — mirrors admin/(panel)/shares/page.tsx. */
export default function AdminSharesLoading() {
  return (
    <div className="space-y-6">
      {/* Page head */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Search input (debounced, no submit button) */}
      <div className="max-w-md">
        <Skeleton className="h-10 w-full rounded-xl!" />
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg!" />
        ))}
      </div>

      {/* Shares table */}
      <SkeletonTable rows={6} />
    </div>
  );
}
