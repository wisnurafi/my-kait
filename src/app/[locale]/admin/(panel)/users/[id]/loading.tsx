import { Skeleton } from "@/components/ui/skeleton";

function ListRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-lg border border-border-ink px-4 py-3"
        >
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-20 !rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Loading state — mirrors admin/(panel)/users/[id]/page.tsx. */
export default function AdminUserDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Skeleton className="h-4 w-32" />

      {/* Header panel */}
      <div className="panel p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-9 w-28 !rounded-lg" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-sunken px-4 py-3 space-y-2">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Templates panel */}
      <div className="panel p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <ListRows rows={3} />
      </div>

      {/* Webhooks panel */}
      <div className="panel p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <ListRows rows={2} />
      </div>

      {/* Recent logs panel */}
      <div className="panel p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <ListRows rows={3} />
      </div>
    </div>
  );
}
