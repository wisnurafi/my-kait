import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

/** Loading state — mirrors admin/(panel)/users/page.tsx. */
export default function AdminUsersLoading() {
  return (
    <div className="space-y-6">
      {/* Page head */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Search form */}
      <div className="flex gap-2 max-w-md">
        <Skeleton className="h-10 flex-1 !rounded-xl" />
        <Skeleton className="h-10 w-20 !rounded-xl" />
      </div>

      {/* Users table */}
      <SkeletonTable rows={6} />
    </div>
  );
}
