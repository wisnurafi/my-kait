import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the redesigned webhooks page layout:
 * PageHeader -> add-webhook form -> folder chips -> toolbar -> card grid.
 */
function WebhookCardSkeleton() {
  return (
    <div className="panel p-5 space-y-3">
      {/* Card header: icon box + name + badges */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
        <Skeleton className="h-5 flex-1" />
        <Skeleton className="h-6 w-16 !rounded-full shrink-0" />
      </div>
      {/* Meta block */}
      <div className="space-y-1.5 pt-0.5">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      {/* Action row: icon-buttons */}
      <div className="flex gap-1 pt-3 border-t border-border-ink">
        {Array.from({ length: 5 }).map((_, j) => (
          <Skeleton key={j} className="h-10 w-10 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function WebhooksLoading() {
  return (
    <div className="space-y-6">
      {/* PageHeader */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-56" />
      </div>
      {/* Add-webhook form */}
      <div className="panel p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <Skeleton className="h-11 w-44 rounded-lg" />
      </div>
      {/* Folder chips */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 !rounded-full" />
        <Skeleton className="h-8 w-24 !rounded-full" />
        <Skeleton className="h-8 w-16 !rounded-full" />
      </div>
      {/* Toolbar: search + ping-all + status filter */}
      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 w-36 rounded-lg" />
        <Skeleton className="h-11 w-32 rounded-lg" />
      </div>
      {/* Card grid: 1 col mobile -> 2 cols >= lg */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <WebhookCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
