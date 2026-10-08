"use client";

/**
 * Admin sidebar — mirrors the app Navbar (devtool sidebar, lime indicator).
 * No link to this area exists anywhere in the public UI.
 *
 * Dashboard redesign: desktop aside carries .dash-sidebar (dot-grid +
 * scanline texture from the CSS agent), nav items use .hv + .ia-<name>
 * icon animations + .nav-sweep hover sweep.
 */

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { motion, AnimatePresence } from "motion/react";
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
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, ia: "ia-tiles", key: "overview", exact: true },
  { href: "/admin/reports", icon: Flag, ia: "ia-wave", key: "reports", exact: false },
  { href: "/admin/shares", icon: Link2, ia: "ia-swing", key: "shares", exact: false },
  { href: "/admin/users", icon: Users, ia: "ia-nod", key: "users", exact: false },
  { href: "/admin/audit", icon: ScrollText, ia: "ia-unroll", key: "audit", exact: false },
] as const;

export function AdminSidebar({ pendingCount }: { pendingCount: number }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);

  const logout = async () => {
    await adminLogoutAction();
    router.push("/admin/login");
    router.refresh();
  };

  const isItemActive = (item: (typeof navItems)[number]) =>
    item.exact
      ? pathname === item.href || pathname.endsWith("/admin")
      : pathname.includes(item.href);

  // Mobile drawer: Escape closes, body scroll locks, focus moves into the drawer.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const itemClass = (isActive: boolean) =>
    cn(
      "hv relative flex items-center gap-3 px-3 py-2.5 no-underline rounded-lg overflow-hidden",
      "font-mono text-[11px] uppercase tracking-[0.14em]",
      "transition-colors duration-150 focus-ring",
      isActive
        ? "bg-accent-soft text-accent"
        : "text-fg-secondary hover:text-fg hover:bg-surface-hover",
    );

  const renderDrawerItem = (item: (typeof navItems)[number]) => {
    const isActive = isItemActive(item);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        onClick={() => setMenuOpen(false)}
        className={itemClass(isActive)}
      >
        <span className="nav-sweep" aria-hidden="true" />
        {isActive && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-accent z-10"
          />
        )}
        <span className={cn("ia relative", item.ia)} aria-hidden="true">
          <item.icon size={18} className="shrink-0" />
        </span>
        <span className="flex-1 relative">{t(item.key)}</span>
        {item.key === "reports" && pendingCount > 0 && (
          <Badge variant="warning" className="font-mono relative">
            {pendingCount}
          </Badge>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile top bar — hamburger + logo + theme/language/logout */}
      <header className="sticky top-0 z-40 md:hidden flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-border-ink">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={t("menu")}
          aria-expanded={menuOpen}
          aria-controls="admin-nav-drawer"
          className="hv p-2 -ml-2 rounded-lg text-fg-secondary hover:text-fg transition-colors duration-150 cursor-pointer focus-ring"
        >
          <Menu size={20} />
        </button>
        <Link href="/admin" className="hv flex items-center gap-2 no-underline min-w-0 flex-1">
          <HookLogo size={24} />
          <span className="font-display font-bold text-base tracking-tight text-fg truncate hidden min-[400px]:inline">
            my-kait
          </span>
          <Badge variant="danger" className="ml-1 font-mono text-[9px] shrink-0">
            <ShieldAlert size={10} className="mr-1" />
            {t("title")}
          </Badge>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeLanguageSwitcher />
          <button
            type="button"
            onClick={logout}
            title={t("logout")}
            aria-label={t("logout")}
            className="hv p-2 rounded-lg border border-border-ink bg-surface text-fg-secondary hover:text-fg hover:border-border-strong transition-colors duration-150 cursor-pointer focus-ring"
          >
            <span className="ia ia-out flex">
              <LogOut size={16} />
            </span>
          </button>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="dash-sidebar fixed left-0 top-0 h-full w-64 z-40 hidden md:flex flex-col border-r border-border-ink">
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
            const isActive = isItemActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={itemClass(isActive)}
              >
                <span className="nav-sweep" aria-hidden="true" />
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-accent z-10"
                  />
                )}
                <span className={cn("ia relative", item.ia)} aria-hidden="true">
                  <item.icon size={18} className="shrink-0" />
                </span>
                <span className="flex-1 relative">{t(item.key)}</span>
                {item.key === "reports" && pendingCount > 0 && (
                  <Badge variant="warning" className="font-mono relative">
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
            className="hv w-full justify-start gap-3 font-mono text-[11px] uppercase tracking-[0.14em]"
            onClick={logout}
          >
            <span className="ia ia-out" aria-hidden="true">
              <LogOut size={18} />
            </span>
            {t("logout")}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer nav — all items, slides in from the left */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              ref={drawerRef}
              id="admin-nav-drawer"
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={t("menu")}
              className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-surface border-r border-border-ink flex flex-col focus:outline-none"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between pl-4 pr-3 py-3 border-b border-border-ink">
                <span className="flex items-center gap-2">
                  <HookLogo size={24} />
                  <span className="font-display font-bold text-base tracking-tight text-fg">
                    my-kait
                  </span>
                  <Badge variant="danger" className="ml-1 font-mono text-[9px] shrink-0">
                    <ShieldAlert size={10} className="mr-1" />
                    {t("title")}
                  </Badge>
                </span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label={tc("close")}
                  className="hv p-2 rounded-lg text-fg-secondary hover:text-fg transition-colors duration-150 cursor-pointer focus-ring"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {navItems.map(renderDrawerItem)}
              </nav>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
