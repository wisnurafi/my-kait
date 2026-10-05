import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the redesigned templates page layout:
 * PageHeader -> search -> folder chip rail (mobile) -> tag chips ->
 * card grid -> pagination, plus the folder sidebar on lg.
 */
function TemplateCardSkeleton() {
  return (
    <div className="panel p-5 space-y-3">
      {/* Card header: icon box + name + badge */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
        <Skeleton className="h-5 flex-1" />
        <Skeleton className="h-6 w-16 !rounded-full shrink-0" />
      </div>
      {/* Meta block */}
      <Skeleton className="h-3 w-24" />
      {/* Tags */}
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-14 !rounded-full" />
        <Skeleton className="h-5 w-10 !rounded-full" />
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

export default function TemplatesLoading() {
  return (
    <div className="space-y-6">
      {/* PageHeader */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex gap-8 flex-col lg:flex-row">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Search */}
          <Skeleton className="h-11 w-full rounded-xl" />
          {/* Folder chip rail (mobile) */}
          <div className="lg:hidden flex gap-2 overflow-hidden">
            <Skeleton className="h-8 w-24 !rounded-full shrink-0" />
            <Skeleton className="h-8 w-28 !rounded-full shrink-0" />
            <Skeleton className="h-8 w-20 !rounded-full shrink-0" />
          </div>
          {/* Card grid: 1 -> 2 -> 3 cols */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TemplateCardSkeleton key={i} />
            ))}
          </div>
          {/* Pagination */}
          <div className="panel px-4 py-3 flex items-center justify-between">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
        {/* Folder sidebar (desktop) */}
        <aside className="hidden lg:block lg:order-first w-64 shrink-0">
          <div className="panel p-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-3/4 rounded-lg" />
          </div>
        </aside>
      </div>
    </div>
  );
}
