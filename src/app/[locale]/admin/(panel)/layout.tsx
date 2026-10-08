import { setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/admin-session";
import { getPendingReportsCount } from "@/server/actions/admin";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Toaster } from "@/components/ui/toast";

/**
 * Guarded admin shell. Middleware already redirects unauthenticated
 * requests; this is the second layer (never trust middleware alone).
 */
export default async function AdminPanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const email = await verifyAdminSession(
    (await cookies()).get(ADMIN_COOKIE_NAME)?.value,
  );
  if (!email) redirect(`/${locale}/admin/login`);

  let pendingCount = 0;
  try {
    pendingCount = await getPendingReportsCount();
  } catch {
    pendingCount = 0;
  }

  return (
    <div className="min-h-screen">
      <AdminSidebar pendingCount={pendingCount} />
      <main className="dash-main md:pl-64">
        {/* relative: keeps content above .dash-main::before noise layer */}
        <div className="relative p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
