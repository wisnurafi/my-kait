import { setRequestLocale } from "next-intl/server";
import { Navbar } from "@/components/app/navbar";
import { CommandPaletteProvider } from "@/components/app/command-palette";
import { Toaster } from "@/components/ui/toast";
import { auth } from "@/lib/auth";
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
  if (!session?.user) {
    redirect(`/${locale}`);
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <CommandPaletteProvider>
        <main className="dash-main md:pl-64 pb-20 md:pb-0">
          {/* relative: keeps content above .dash-main::before noise layer (same as admin shell) */}
          <div className="relative p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
        </main>
      </CommandPaletteProvider>
      <Toaster />
    </div>
  );
}
