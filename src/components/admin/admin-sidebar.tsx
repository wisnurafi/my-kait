"use client";

/**
 * Admin sidebar — mirrors the app Navbar (devtool sidebar, lime indicator).
 * No link to this area exists anywhere in the public UI.
 */

import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { HookLogo } from "@/components/hook-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeLanguageSwitcher } from "@/components/app/theme-language-switcher";
import { adminLogoutAction } from "@/server/actions/admin-auth";
import {
  LayoutDashboard,
  Flag,
  Link2,
  Users,
  ScrollText,
  LogOut,
  ShieldAlert,
} from "lucide-react";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, key: "overview", exact: true },
  { href: "/admin/reports", icon: Flag, key: "reports", exact: false },
  { href: "/admin/shares", icon: Link2, key: "shares", exact: false },
  { href: "/admin/users", icon: Users, key: "users", exact: false },
  { href: "/admin/audit", icon: ScrollText, key: "audit", exact: false },
] as const;

export function AdminSidebar({ pendingCount }: { pendingCount: number }) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await adminLogoutAction();
    router.push("/admin/login");
    router.refresh();
  };

  const itemClass = (isActive: boolean) =>
    cn(
      "relative flex items-center gap-3 px-3 py-2.5 no-underline rounded-lg",
      "font-mono text-[11px] uppercase tracking-[0.14em]",
      "transition-colors duration-150 focus-ring",
      isActive
        ? "bg-accent-soft text-accent"
        : "text-fg-secondary hover:text-fg hover:bg-surface-hover",
    );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 z-40 hidden md:flex flex-col bg-surface border-r border-border-ink">
        <div className="px-5 py-5 border-b border-border-ink">
          <div className="flex items-center gap-2.5">
            <HookLogo size={32} />
            <span className="font-display font-bold text-lg tracking-tight text-fg">
              my-kait
            </span>
            <Badge variant="danger" className="ml-1 font-mono text-[9px]">
              <ShieldAlert size={10} className="mr-1" />
              {t("title")}
            </Badge>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href || pathname.endsWith("/admin")
              : pathname.includes(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={itemClass(isActive)}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-accent"
                  />
                )}
                <item.icon size={18} className="shrink-0" />
                <span className="flex-1">{t(item.key)}</span>
                {item.key === "reports" && pendingCount > 0 && (
                  <Badge variant="warning" className="font-mono">
                    {pendingCount}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border-ink space-y-3">
          <div className="px-3">
            <ThemeLanguageSwitcher />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 font-mono text-[11px] uppercase tracking-[0.14em]"
            onClick={logout}
          >
            <LogOut size={18} />
            {t("logout")}
          </Button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex items-stretch justify-around bg-surface border-t border-border-ink px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href || pathname.endsWith("/admin")
            : pathname.includes(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1 px-3 py-2 no-underline",
                "font-mono text-[9px] uppercase tracking-[0.12em]",
                "transition-colors duration-150",
                isActive ? "text-accent" : "text-fg-secondary",
              )}
            >
              <item.icon size={20} />
              {t(item.key)}
              {item.key === "reports" && pendingCount > 0 && (
                <Badge variant="warning" className="absolute top-0 right-1 font-mono text-[9px] px-1">
                  {pendingCount}
                </Badge>
              )}
            </Link>
          );
        })}
        {/* Logout — the only way out on mobile (sidebar footer is desktop-only) */}
        <button
          type="button"
          onClick={logout}
          aria-label={t("logout")}
          className={cn(
            "relative flex flex-col items-center gap-1 px-3 py-2",
            "font-mono text-[9px] uppercase tracking-[0.12em]",
            "transition-colors duration-150 text-fg-secondary active:text-fg",
          )}
        >
          <LogOut size={20} />
          {t("logout")}
        </button>
      </nav>
    </>
  );
}
