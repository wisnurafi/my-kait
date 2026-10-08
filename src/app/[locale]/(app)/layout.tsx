import { setRequestLocale } from "next-intl/server";
import { Navbar } from "@/components/app/navbar";
import { CommandPaletteProvider } from "@/components/app/command-palette";
import { Toaster } from "@/components/ui/toast";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { webhooks } from "@/lib/schema";
import { and, count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Require auth
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}`);
  }

  // Global invalid-webhook badge: cheap indexed count (webhooks_user_id_idx),
  // passed to Navbar for the desktop sidebar and the mobile drawer nav.
  // Re-queried on every navigation inside (app), so the badge clears itself
  // once all webhooks are healthy again.
  const [{ n: invalidWebhookCount }] = await db
    .select({ n: count() })
    .from(webhooks)
    .where(
      and(
        eq(webhooks.userId, session.user.id),
        eq(webhooks.lastStatus, "invalid"),
      ),
    );

  return (
    <div className="min-h-screen">
      <Navbar invalidWebhookCount={invalidWebhookCount} />
      <CommandPaletteProvider>
        <main className="dash-main md:pl-64">
          {/* relative: keeps content above .dash-main::before noise layer (same as admin shell) */}
          <div className="relative p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
        </main>
      </CommandPaletteProvider>
      <Toaster />
    </div>
  );
}
