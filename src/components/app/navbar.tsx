"use client";

/**
 * Navbar — precise devtool sidebar.
 * Surface bg, 1px right border, active item gets lime left indicator
 * + accent-soft fill. 18px lucide icons, mono micro labels.
 *
 * Redesign contract: aside carries .dash-sidebar (dot-grid + scanline bg),
 * every nav item gets .hv, lucide icons are wrapped in .ia.ia-<anim> spans,
 * and a .nav-sweep span sits inside each nav link for the lime sweep.
 */
import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { HookLogo } from "@/components/hook-logo";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeLanguageSwitcher } from "@/components/app/theme-language-switcher";
import { LogOut, Home, Pencil, Link2, FileText, History, Settings, Globe, KeyRound, CalendarClock, Variable, Menu, X } from "lucide-react";

const sectionWorkspace = [
  { href: "/dashboard", icon: Home, key: "dashboard", ia: "ia-pop" },
  { href: "/editor", icon: Pencil, key: "editor", ia: "ia-scribble" },
  { href: "/webhooks", icon: Link2, key: "webhooks", ia: "ia-swing" },
  { href: "/templates", icon: FileText, key: "templates", ia: "ia-lift" },
  { href: "/variables", icon: Variable, key: "variables", ia: "ia-wave" },
  { href: "/scheduled", icon: CalendarClock, key: "scheduled", ia: "ia-ring" },
] as const;

const sectionSystem = [
  { href: "/api-keys", icon: KeyRound, key: "apiKeys", ia: "ia-jiggle" },
  { href: "/logs", icon: History, key: "logs", ia: "ia-rewind" },
  { href: "/settings", icon: Settings, key: "settings", ia: "ia-gearspin" },
] as const;

type DesktopNavItem =
  | (typeof sectionWorkspace)[number]
  | (typeof sectionSystem)[number];

export function Navbar({
  invalidWebhookCount = 0,
}: {
  /** Webhooks with last_status = 'invalid' — shows a red badge/dot on the webhooks nav item. */
  invalidWebhookCount?: number;
}) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const showInvalidBadge = invalidWebhookCount > 0;
  // i18n key "nav.invalidWebhooks" (ICU plural with {count}) — added separately
  const invalidLabel = showInvalidBadge
    ? t("invalidWebhooks", { count: invalidWebhookCount })
    : undefined;
  const webhooksA11y = (key: string) =>
    key === "webhooks" && invalidLabel
      ? { title: invalidLabel, "aria-label": `${t(key)}: ${invalidLabel}` }
      : {};

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

  const renderDesktopItem = (item: DesktopNavItem, onNavigate?: () => void) => {
    const isActive = pathname.includes(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        {...webhooksA11y(item.key)}
        onClick={onNavigate}
        className={cn(
          "hv relative flex items-center gap-3 px-3 py-2.5 no-underline rounded-lg overflow-hidden",
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
        <span className="nav-sweep" aria-hidden="true" />
        <span className={cn("ia shrink-0", item.ia)}>
          <item.icon size={18} />
        </span>
        {t(item.key)}
        {item.key === "webhooks" && showInvalidBadge && (
          <span
            aria-hidden="true"
            className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-error/30 bg-error-soft px-1 font-mono text-[10px] font-medium leading-none text-error"
          >
            {invalidWebhookCount > 99 ? "99+" : invalidWebhookCount}
          </span>
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
          aria-controls="mobile-nav-drawer"
          className="hv p-2 -ml-2 rounded-lg text-fg-secondary hover:text-fg transition-colors duration-150 cursor-pointer focus-ring"
        >
          <Menu size={20} />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 no-underline min-w-0 flex-1">
          <HookLogo size={24} />
          <span className="font-display font-bold text-base tracking-tight text-fg truncate">
            my-kait
          </span>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeLanguageSwitcher />
          <button
            type="button"
            onClick={() => signOut({ redirectTo: "/" })}
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
      <aside className="dash-sidebar fixed left-0 top-0 h-full w-64 z-40 hidden md:flex flex-col bg-surface border-r border-border-ink">
        <div className="px-5 py-5 border-b border-border-ink">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <HookLogo size={32} />
            <span className="font-display font-bold text-lg tracking-tight text-fg">
              my-kait
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="label px-3 pb-1">{t("sectionWorkspace")}</p>
          {sectionWorkspace.map((item) => renderDesktopItem(item))}
          <div className="border-t border-border-ink mt-3 pt-3">
            <p className="label px-3 pb-1">{t("sectionSystem")}</p>
            {sectionSystem.map((item) => renderDesktopItem(item))}
          </div>
        </nav>

        <div className="px-3 py-4 border-t border-border-ink space-y-3">
          <Link
            href="/"
            className="hv relative flex items-center gap-3 px-3 py-2.5 no-underline rounded-lg overflow-hidden font-mono text-[11px] uppercase tracking-[0.14em] text-fg-secondary hover:text-fg hover:bg-surface-hover transition-colors duration-150 focus-ring"
          >
            <span className="nav-sweep" aria-hidden="true" />
            <span className="ia ia-pop shrink-0">
              <Globe size={18} />
            </span>
            {t("landingPage")}
          </Link>
          <ThemeLanguageSwitcher />
          <Button
            variant="ghost"
            size="sm"
            className="hv w-full justify-start gap-3 font-mono text-[11px] uppercase tracking-[0.14em]"
            onClick={() => signOut({ redirectTo: "/" })}
          >
            <span className="ia ia-out flex">
              <LogOut size={18} />
            </span>
            {t("logout")}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer nav — all sections, slides in from the left */}
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
              id="mobile-nav-drawer"
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
                <p className="label px-3 pb-1">{t("sectionWorkspace")}</p>
                {sectionWorkspace.map((item) =>
                  renderDesktopItem(item, () => setMenuOpen(false)),
                )}
                <div className="border-t border-border-ink mt-3 pt-3">
                  <p className="label px-3 pb-1">{t("sectionSystem")}</p>
                  {sectionSystem.map((item) =>
                    renderDesktopItem(item, () => setMenuOpen(false)),
                  )}
                </div>
              </nav>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
