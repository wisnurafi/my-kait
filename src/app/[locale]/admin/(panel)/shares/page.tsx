import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getShares } from "@/server/actions/admin";
import { ShareToggle } from "@/components/admin/share-toggle";
import { cn } from "@/lib/utils";
import { Search, ExternalLink } from "lucide-react";

function fmtDate(d: Date, locale: string) {
  return new Date(d).toLocaleString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const FILTERS = [
  { v: "all", labelKey: "filterAll" },
  { v: "active", labelKey: "active" },
  { v: "inactive", labelKey: "inactive" },
] as const;

type ShareFilter = (typeof FILTERS)[number]["v"];

export default async function AdminSharesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; f?: string }>;
}) {
  const { locale } = await params;
  const { q, f } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const active: ShareFilter =
    f === "active" || f === "inactive" ? f : "all";
  const shares = await getShares(
    q,
    active === "all" ? undefined : active === "active",
  );

  const chipHref = (v: ShareFilter) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (v !== "all") p.set("f", v);
    const s = p.toString();
    return s ? `/admin/shares?${s}` : "/admin/shares";
  };

  return (
    <div className="space-y-6">
      <div className="stagger-in">
        <div className="label mb-2">{t("eyebrow")}</div>
        <h2>{t("sharesTitle")}</h2>
        <p className="text-sm text-fg-secondary mt-1">{t("sharesSubtitle")}</p>
      </div>

      {/* Search (plain GET form — no JS needed) */}
      <form method="get" className="flex gap-2 max-w-md stagger-in">
        {active !== "all" && <input type="hidden" name="f" value={active} />}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary"
          />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          {t("search")}
        </Button>
      </form>

      {/* Status filter */}
      <div className="flex gap-1.5 flex-wrap stagger-in">
        {FILTERS.map((fl) => (
          <Link
            key={fl.v}
            href={chipHref(fl.v)}
            className={cn(
              "px-3 py-1.5 rounded-lg no-underline font-mono text-[11px] uppercase tracking-[0.12em] border transition-colors",
              active === fl.v
                ? "bg-accent-soft text-accent border-accent/30"
                : "text-fg-secondary border-border-ink hover:text-fg hover:border-border-strong",
            )}
          >
            {t(fl.labelKey)}
          </Link>
        ))}
      </div>

      <div className="panel overflow-hidden stagger-in">
        {shares.length === 0 ? (
          <p className="p-6 text-sm text-fg-secondary">{t("emptyShares")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-tertiary text-left">
                  <th className="px-4 py-3 font-medium">{t("colTemplate")}</th>
                  <th className="px-4 py-3 font-medium">{t("colOwner")}</th>
                  <th className="px-4 py-3 font-medium">{t("colSlug")}</th>
                  <th className="px-4 py-3 font-medium">{t("colImports")}</th>
                  <th className="px-4 py-3 font-medium">{t("colReports")}</th>
                  <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
                  <th className="px-4 py-3 font-medium text-right">
                    {t("colActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shares.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-border-ink hover:bg-surface-hover/50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium max-w-[200px] truncate">
                        {s.templateName}
                      </div>
                      <div className="text-xs text-fg-tertiary font-mono">
                        {fmtDate(s.createdAt, locale)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-fg-secondary whitespace-nowrap">
                      {s.ownerName}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/t/${s.slug}`}
                        target="_blank"
                        className="font-mono text-xs text-accent hover:underline inline-flex items-center gap-1 no-underline"
                      >
                        /t/{s.slug} <ExternalLink size={11} />
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{s.importCount}</td>
                    <td className="px-4 py-3">
                      {s.pendingReports > 0 ? (
                        <Link href="/admin/reports?status=pending" className="no-underline">
                          <Badge variant="warning" className="font-mono">
                            {s.pendingReports}
                          </Badge>
                        </Link>
                      ) : (
                        <span className="text-fg-tertiary">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={s.isActive ? "success" : "default"}>
                        {s.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <ShareToggle shareId={s.id} isActive={s.isActive} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {shares.length >= 200 && (
        <p className="text-xs text-fg-tertiary font-mono">{t("limitNote")}</p>
      )}
    </div>
  );
}
