import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAdminUsers } from "@/server/actions/admin";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

function fmtDate(d: Date, locale: string) {
  return new Date(d).toLocaleString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const FILTERS = [
  { v: "all", labelKey: "filterAll" },
  { v: "active", labelKey: "filterActive" },
  { v: "suspended", labelKey: "filterSuspended" },
] as const;

type UserFilter = (typeof FILTERS)[number]["v"];

export default async function AdminUsersPage({
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

  const active: UserFilter =
    f === "active" || f === "suspended" ? f : "all";
  const list = await getAdminUsers(
    q,
    active === "all" ? undefined : active === "suspended",
  );

  const chipHref = (v: UserFilter) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (v !== "all") p.set("f", v);
    const s = p.toString();
    return s ? `/admin/users?${s}` : "/admin/users";
  };

  return (
    <div className="space-y-6">
      <div className="stagger-in">
        <div className="label mb-2">{t("eyebrow")}</div>
        <h2>{t("usersTitle")}</h2>
        <p className="text-sm text-fg-secondary mt-1">{t("usersSubtitle")}</p>
      </div>

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
            placeholder={t("searchUsersPlaceholder")}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          {t("search")}
        </Button>
      </form>

      {/* Suspended filter */}
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
        {list.length === 0 ? (
          <p className="p-6 text-sm text-fg-secondary">{t("emptyUsers")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-tertiary text-left">
                  <th className="px-4 py-3 font-medium">{t("colUser")}</th>
                  <th className="px-4 py-3 font-medium">{t("colJoined")}</th>
                  <th className="px-4 py-3 font-medium">{t("colTemplates")}</th>
                  <th className="px-4 py-3 font-medium">{t("colWebhooks")}</th>
                  <th className="px-4 py-3 font-medium">{t("colMessages")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-border-ink hover:bg-surface-hover/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="no-underline hover:underline"
                      >
                        <div className="font-medium text-fg">
                          {u.globalName ?? u.username}
                        </div>
                      </Link>
                      <div className="text-xs text-fg-tertiary font-mono">
                        @{u.username} · {u.discordId}
                      </div>
                      {u.isSuspended && (
                        <Badge variant="danger" className="mt-1 font-mono text-[10px]">
                          {t("suspended")}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-fg-secondary whitespace-nowrap">
                      {fmtDate(u.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{u.templateCount}</td>
                    <td className="px-4 py-3 tabular-nums">{u.webhookCount}</td>
                    <td className="px-4 py-3 tabular-nums">{u.messageCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {list.length >= 200 && (
        <p className="text-xs text-fg-tertiary font-mono">{t("limitNote")}</p>
      )}
    </div>
  );
}
