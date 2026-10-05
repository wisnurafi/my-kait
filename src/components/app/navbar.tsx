"use client";

/**
 * Navbar — precise devtool sidebar.
 * Surface bg, 1px right border, active item gets lime left indicator
 * + accent-soft fill. 18px lucide icons, mono micro labels.
 */
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { HookLogo } from "@/components/hook-logo";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeLanguageSwitcher } from "@/components/app/theme-language-switcher";
import { LogOut, Home, Pencil, Link2, FileText, History, Settings, Globe } from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: Home, key: "dashboard" },
  { href: "/editor", icon: Pencil, key: "editor" },
  { href: "/webhooks", icon: Link2, key: "webhooks" },
  { href: "/templates", icon: FileText, key: "templates" },
  { href: "/logs", icon: History, key: "logs" },
  { href: "/settings", icon: Settings, key: "settings" },
] as const;

export function Navbar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <>
      {/* Mobile top bar — logo + theme/language, one-tap access on small screens */}
      <header className="sticky top-0 z-40 md:hidden flex items-center justify-between gap-2 px-4 py-2.5 bg-surface border-b border-border-ink">
        <Link href="/dashboard" className="flex items-center gap-2 no-underline min-w-0">
          <HookLogo size={24} />
          <span className="font-display font-bold text-base tracking-tight text-fg truncate">
            my-kait
          </span>
        </Link>
        <ThemeLanguageSwitcher />
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 z-40 hidden md:flex flex-col bg-surface border-r border-border-ink">
        <div className="px-5 py-5 border-b border-border-ink">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <HookLogo size={32} />
            <span className="font-display font-bold text-lg tracking-tight text-fg">
              my-kait
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.includes(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 no-underline rounded-lg",
                  "font-mono text-[11px] uppercase tracking-[0.14em]",
                  "transition-colors duration-150 focus-ring",
                  isActive
                    ? "bg-accent-soft text-accent"
                    : "text-fg-secondary hover:text-fg hover:bg-surface-hover",
                )}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-accent"
                  />
                )}
                <item.icon size={18} className="shrink-0" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border-ink space-y-3">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 no-underline rounded-lg font-mono text-[11px] uppercase tracking-[0.14em] text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors duration-150 focus-ring"
          >
            <Globe size={18} className="shrink-0" />
            {t("landingPage")}
          </Link>
          <ThemeLanguageSwitcher />
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 font-mono text-[11px] uppercase tracking-[0.14em]"
            onClick={() => signOut({ redirectTo: "/" })}
          >
            <LogOut size={18} />
            {t("logout")}
          </Button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex items-stretch justify-around bg-surface border-t border-border-ink px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          const isActive = pathname.includes(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1 px-2 py-2 no-underline",
                "font-mono text-[9px] uppercase tracking-[0.12em]",
                "transition-colors duration-150",
                isActive ? "text-accent" : "text-fg-secondary",
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute top-0 h-[2px] w-8 rounded-full bg-accent"
                />
              )}
              <item.icon size={18} />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
