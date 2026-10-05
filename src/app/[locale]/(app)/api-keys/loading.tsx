import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/**
 * Mirrors the redesigned API Keys layout: page header, create-key form,
 * then key cards.
 */
export default function ApiKeysLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-[52px] rounded-2xl shrink-0" />
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      </div>

      {/* Create form */}
      <div className="panel p-6">
        <div className="flex gap-2 flex-wrap items-end">
          <Skeleton className="h-10 flex-1 min-w-[180px] rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      {/* Key cards */}
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
