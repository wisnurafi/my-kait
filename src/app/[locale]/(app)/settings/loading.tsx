import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the redesigned settings layout: PageHeader (media + title),
 * profile card, preferences card, data export card, API keys link card,
 * danger zone, then legal links.
 */
export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* PageHeader: media + eyebrow/title */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-[52px] rounded-2xl shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-48 max-w-full" />
        </div>
      </div>

      {/* Profile card */}
      <div className="panel p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full!" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </div>

      {/* Preferences card */}
      <div className="panel p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-2/3 max-w-full" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-2/3 max-w-full" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full! shrink-0" />
        </div>
      </div>

      {/* Data export card */}
      <div className="panel p-6 space-y-4">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* API keys link card */}
      <div className="panel p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-2/3 max-w-full" />
          </div>
          <Skeleton className="h-5 w-5 rounded shrink-0" />
        </div>
      </div>

      {/* Danger zone */}
      <div className="panel p-6 space-y-4">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      {/* Legal links */}
      <div className="flex gap-4 justify-center">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}
