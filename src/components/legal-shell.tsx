import { Link } from "@/i18n/routing";
import { HookLogo } from "@/components/hook-logo";
import { PublicThemeManager } from "@/components/landing/theme-toggle";

/**
 * Shell minimal untuk halaman legal publik (privacy/terms) —
 * bisa diakses tanpa login, konsisten dengan tema landing.
 */
export function LegalShell({
  children,
  homeLabel,
}: {
  children: React.ReactNode;
  homeLabel: string;
}) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <PublicThemeManager />
      <header className="border-b border-border-ink">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <HookLogo size={28} />
            <span className="font-display text-[17px] font-bold tracking-wide">
              MY KAIT
            </span>
          </Link>
          <Link
            href="/"
            className="font-mono text-xs text-fg-secondary transition-colors hover:text-fg"
          >
            ← {homeLabel}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-14">{children}</main>
    </div>
  );
}
