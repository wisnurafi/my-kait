import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { getGalleryTemplates } from "@/server/actions/templates";
import { Mascot } from "@/components/mascot";
import { HookLogo } from "@/components/hook-logo";
import { Badge } from "@/components/ui/badge";
import { DiscordLoginButton } from "@/components/auth/discord-login-button";
import { Download, ArrowUpRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicThemeManager } from "@/components/landing/theme-toggle";

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ search?: string; sort?: string; tag?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("gallery");

  const { search, sort, tag } = await searchParams;
  const activeSort = sort === "latest" ? "latest" : "popular";
  const activeTag = tag?.trim() || undefined;
  const templates = await getGalleryTemplates({
    search,
    sort: activeSort,
    tag: activeTag,
  });
  const session = await auth();

  // Bangun query string dengan patch parsial (null = hapus param).
  const buildHref = (patch: {
    search?: string | null;
    sort?: "popular" | "latest";
    tag?: string | null;
  }) => {
    const sp = new URLSearchParams();
    const s = patch.search !== undefined ? patch.search : search;
    const tg = patch.tag !== undefined ? patch.tag : activeTag;
    if (s) sp.set("search", s);
    if (tg) sp.set("tag", tg);
    sp.set("sort", patch.sort ?? activeSort);
    return `?${sp.toString()}`;
  };
  const tagHref = (tg: string) => buildHref({ tag: tg });

  const hasFilter = Boolean(search?.trim() || activeTag);

  return (
    <div className="min-h-screen">
      <PublicThemeManager />
      {/* minimal top bar */}
      <header className="border-b border-border-ink">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HookLogo size={30} />
            <span className="font-display font-bold text-lg tracking-tight">
              MY KAIT
            </span>
          </Link>
          {session ? (
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-fg-secondary hover:text-fg transition-colors"
            >
              {t("openApp")}
            </Link>
          ) : (
            <DiscordLoginButton callbackUrl={`/${locale}/dashboard`}>
              {t("loginDiscord")}
            </DiscordLoginButton>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-14">
        {/* heading */}
        <div className="flex items-start gap-5 mb-10">
          <Mascot mini size={64} />
          <div>
            <div className="label mb-2">{t("eyebrow")}</div>
            <h1 className="mb-2">{t("title")}</h1>
            <p className="text-fg-secondary max-w-xl">{t("subtitle")}</p>
          </div>
        </div>

        {/* search + sort */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <form method="GET" className="flex gap-2 flex-1 min-w-[240px] max-w-md">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary"
              />
              <input
                type="text"
                name="search"
                defaultValue={search ?? ""}
                placeholder={t("searchPlaceholder")}
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-input border border-border-ink text-sm text-fg placeholder:text-fg-tertiary focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            {activeSort !== "popular" && (
              <input type="hidden" name="sort" value={activeSort} />
            )}
            {activeTag && <input type="hidden" name="tag" value={activeTag} />}
            <button
              type="submit"
              className="h-10 px-4 rounded-lg bg-accent text-[#0a0a0b] text-sm font-semibold hover:brightness-110 transition-all cursor-pointer"
            >
              {t("search")}
            </button>
          </form>
          <div className="flex rounded-lg border border-border-ink overflow-hidden">
            {(
              [
                { key: "popular", label: t("popular") },
                { key: "latest", label: t("latest") },
              ] as const
            ).map((s) => (
              <Link
                key={s.key}
                href={buildHref({ sort: s.key })}
                className={cn(
                  "px-4 h-10 inline-flex items-center text-sm font-semibold transition-colors",
                  activeSort === s.key
                    ? "bg-accent-soft text-accent"
                    : "text-fg-secondary hover:text-fg",
                )}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {/* result count + active filters */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <span className="font-mono text-xs text-fg-tertiary">
            {templates.length === 1
              ? t("resultOne")
              : t("results", { count: templates.length })}
          </span>
          {search?.trim() && (
            <Link
              href={buildHref({ search: null })}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-ink bg-surface pl-3 pr-2 py-1 text-xs text-fg-secondary hover:text-fg hover:border-border-strong transition-colors"
            >
              “{search.trim()}”
              <X size={12} />
            </Link>
          )}
          {activeTag && (
            <Link
              href={buildHref({ tag: null })}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft pl-3 pr-2 py-1 text-xs text-accent hover:brightness-110 transition-all"
            >
              #{activeTag}
              <X size={12} />
            </Link>
          )}
          {hasFilter && (
            <Link
              href={buildHref({ search: null, tag: null })}
              className="text-xs font-medium text-fg-tertiary hover:text-fg transition-colors underline underline-offset-2"
            >
              {t("clearFilter")}
            </Link>
          )}
        </div>

        {/* grid */}
        {templates.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <div
                key={tpl.slug}
                className="panel lift p-5 flex flex-col gap-3 group"
              >
                <Link
                  href={`/t/${tpl.slug}`}
                  className="no-underline flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[17px] leading-snug group-hover:text-accent transition-colors">
                      {tpl.name}
                    </h3>
                    <ArrowUpRight
                      size={16}
                      className="text-fg-tertiary group-hover:text-accent shrink-0 mt-1 transition-colors"
                    />
                  </div>
                  {tpl.description && (
                    <p className="text-sm text-fg-secondary line-clamp-2">
                      {tpl.description}
                    </p>
                  )}
                  {tpl.preview && (
                    <p className="border-l-2 border-accent/40 pl-3 font-mono text-[12px] leading-relaxed text-fg-tertiary line-clamp-2">
                      {tpl.preview}
                    </p>
                  )}
                </Link>
                {tpl.tags && tpl.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tpl.tags.slice(0, 4).map((tg) => (
                      <Link
                        key={tg}
                        href={tagHref(tg)}
                        className="no-underline"
                        aria-label={`#${tg}`}
                      >
                        <Badge
                          variant="default"
                          className={cn(
                            "cursor-pointer transition-colors hover:border-accent/40 hover:text-accent",
                            tg === activeTag &&
                              "border-accent/40 bg-accent-soft text-accent",
                          )}
                        >
                          #{tg}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
                <div className="mt-auto pt-3 border-t border-border-ink flex items-center justify-between">
                  <span className="font-mono text-[11px] text-fg-tertiary">
                    @{tpl.author}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-fg-secondary">
                    <Download size={12} />
                    {tpl.importCount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel p-12 flex flex-col items-center text-center gap-4">
            <Mascot size={84} />
            <div>
              <h3 className="mb-1">{t("emptyTitle")}</h3>
              <p className="text-sm text-fg-secondary">{t("emptyDesc")}</p>
            </div>
            {hasFilter && (
              <Link
                href={buildHref({ search: null, tag: null })}
                className="text-sm font-semibold text-accent hover:brightness-110 transition-all"
              >
                {t("clearFilter")}
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
