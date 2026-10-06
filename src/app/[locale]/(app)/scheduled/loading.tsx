import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the scheduled page layout: PageHeader (mascot media 52px +
 * eyebrow + title + description), filter chip row (3 pills), then
 * scheduled row skeletons (icon tile + title/badge line + preview
 * line + meta line + cancel button slot).
 */
export default function ScheduledLoading() {
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

      {/* Filter chips */}
      <div className="flex gap-2">
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>

      {/* Rows */}
      <ul className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="panel p-4 flex items-center gap-3">
            <Skeleton className="size-9 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}
