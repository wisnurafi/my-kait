import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { getAdminUsers } from "@/server/actions/admin";
import { AdminSearch } from "@/components/admin/admin-search";
import { cn } from "@/lib/utils";

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
        <div className="label mb-2 cursor-blink">{t("eyebrow")}</div>
        <h2>{t("usersTitle")}</h2>
        <p className="text-sm text-fg-secondary mt-1">{t("usersSubtitle")}</p>
      </div>

      {/* Search — debounced, URL-driven (?q=&f=) */}
      <AdminSearch
        basePath="/admin/users"
        preserve={["f"]}
        placeholder={t("searchUsersPlaceholder")}
      />

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

      <div className="panel overflow-hidden stagger-in p-3 md:p-0">
        {list.length === 0 ? (
          <p className="p-6 text-sm text-fg-secondary">{t("emptyUsers")}</p>
        ) : (
          <table className="rtable">
            <thead>
              <tr>
                <th>{t("colUser")}</th>
                <th>{t("colJoined")}</th>
                <th>{t("colTemplates")}</th>
                <th>{t("colWebhooks")}</th>
                <th>{t("colMessages")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td data-label={t("colUser")}>
                    <div className="min-w-0">
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
                    </div>
                  </td>
                  <td data-label={t("colJoined")} className="text-fg-secondary whitespace-nowrap">
                    {fmtDate(u.createdAt, locale)}
                  </td>
                  <td data-label={t("colTemplates")} className="tabular-nums">{u.templateCount}</td>
                  <td data-label={t("colWebhooks")} className="tabular-nums">{u.webhookCount}</td>
                  <td data-label={t("colMessages")} className="tabular-nums">{u.messageCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {list.length >= 200 && (
        <p className="text-xs text-fg-tertiary font-mono">{t("limitNote")}</p>
      )}
    </div>
  );
}
