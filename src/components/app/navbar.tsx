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
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { HookLogo } from "@/components/hook-logo";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeLanguageSwitcher } from "@/components/app/theme-language-switcher";
import { LogOut, Home, Pencil, Link2, FileText, History, Settings, Globe, KeyRound, CalendarClock, Variable } from "lucide-react";

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
  const pathname = usePathname();
  const showInvalidBadge = invalidWebhookCount > 0;
  // i18n key "nav.invalidWebhooks" (ICU plural with {count}) — added separately
  const invalidLabel = showInvalidBadge
    ? t("invalidWebhooks", { count: invalidWebhookCount })
    : undefined;
  const webhooksA11y = (key: string) =>
    key === "webhooks" && invalidLabel
      ? { title: invalidLabel, "aria-label": `${t(key)}: ${invalidLabel}` }
      : {};

  const renderDesktopItem = (item: DesktopNavItem) => {
    const isActive = pathname.includes(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        {...webhooksA11y(item.key)}
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
      {/* Mobile top bar — logo + theme/language/logout, one-tap access on small screens */}
      <header className="sticky top-0 z-40 md:hidden flex items-center justify-between gap-2 px-4 py-2.5 bg-surface border-b border-border-ink">
        <Link href="/dashboard" className="flex items-center gap-2 no-underline min-w-0">
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
          {sectionWorkspace.map(renderDesktopItem)}
          <div className="border-t border-border-ink mt-3 pt-3">
            <p className="label px-3 pb-1">{t("sectionSystem")}</p>
            {sectionSystem.map(renderDesktopItem)}
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

      {/* Mobile bottom nav — section 1 (Workspace) only, 6 items max so it
          doesn't wrap on 360px screens (see fix/mobile-topbar-theme).
          Logs + settings stay reachable on desktop sidebar / direct URL. */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex items-stretch justify-around bg-surface border-t border-border-ink px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {sectionWorkspace.map((item) => {
          const isActive = pathname.includes(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              {...webhooksA11y(item.key)}
              className={cn(
                "hv relative flex flex-col items-center gap-1 px-2 py-2 no-underline",
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
              <span className={cn("ia relative", item.ia)}>
                <item.icon size={18} />
                {item.key === "webhooks" && showInvalidBadge && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1.5 h-2.5 w-2.5 rounded-full bg-error ring-2 ring-surface"
                  />
                )}
              </span>
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
