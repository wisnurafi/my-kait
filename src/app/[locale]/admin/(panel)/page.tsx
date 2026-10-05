import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Mascot } from "@/components/mascot";
import { getAdminOverview, getReports, getAdminActivity } from "@/server/actions/admin";
import { AdminActivityCharts } from "@/components/admin/activity-charts";
import { Flag, ChevronRight, ArrowRight } from "lucide-react";

function StatCard({
  value,
  label,
  href,
  viewAria,
  locale,
}: {
  value: number;
  label: string;
  href?: string;
  /** aria-label for clickable cards, e.g. "Lihat daftar pengguna" */
  viewAria?: string;
  locale: string;
}) {
  const inner = (
    <>
      {href && (
        <span className="ia ia-nudge go" aria-hidden="true">
          <ChevronRight size={16} />
        </span>
      )}
      <p className="font-display font-bold text-3xl text-fg tabular-nums">
        {value.toLocaleString(locale === "en" ? "en-US" : "id-ID")}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-secondary mt-1.5">
        {label}
      </p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        aria-label={viewAria ?? label}
        className="hv kpi-card is-clickable panel p-5 no-underline"
      >
        {inner}
      </Link>
    );
  }
  return <div className="panel p-5">{inner}</div>;
}

function fmtDate(d: Date, locale: string) {
  return new Date(d).toLocaleString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const stats = await getAdminOverview();
  const latest = (await getReports("pending")).slice(0, 5);
  const activity = await getAdminActivity(30);
  const healthy =
    stats.webhooksDown === 0 &&
    stats.failedChecks24h === 0 &&
    stats.failedMessages24h === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap stagger-in">
        <div className="flex items-center gap-4">
          <Mascot mini size={52} />
          <div>
            <div className="label mb-2 cursor-blink">{t("eyebrow")}</div>
            <h2>{t("overviewTitle")}</h2>
            <p className="text-sm text-fg-secondary mt-1">
              {t("overviewSubtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* KPI cards — the 3 linked ones get a clear click affordance
          (is-clickable + chevron); the 2 static ones have none. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 stagger-in">
        <StatCard
          value={stats.users}
          label={t("statUsers")}
          href="/admin/users"
          viewAria={t("kpiViewLabel", { label: t("statUsers") })}
          locale={locale}
        />
        <StatCard value={stats.templates} label={t("statTemplates")} locale={locale} />
        <StatCard
          value={stats.activeShares}
          label={t("statActiveShares")}
          href="/admin/shares"
          viewAria={t("kpiViewLabel", { label: t("statActiveShares") })}
          locale={locale}
        />
        <StatCard value={stats.messages7d} label={t("statMessages7d")} locale={locale} />
        <StatCard
          value={stats.pendingReports}
          label={t("statPendingReports")}
          href="/admin/reports?status=pending"
          viewAria={t("kpiViewLabel", { label: t("statPendingReports") })}
          locale={locale}
        />
      </div>

      {/* Activity charts */}
      <AdminActivityCharts daily={activity} />

      <div className="grid md:grid-cols-2 gap-4">
        {/* Moderation */}
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2">
              <Flag size={16} className="text-warning" />
              {t("latestReports")}
            </h3>
            <Link
              href="/admin/reports"
              className="text-xs text-accent hover:underline inline-flex items-center gap-1 no-underline"
            >
              {t("viewQueue")} <ArrowRight size={12} />
            </Link>
          </div>
          {latest.length === 0 ? (
            <p className="text-sm text-fg-secondary">{t("noPending")}</p>
          ) : (
            <ul className="space-y-1">
              {latest.map((r) => (
                <li
                  key={r.id}
                  className="border-t border-border-ink first:border-0"
                >
                  <Link
                    href="/admin/reports?status=pending"
                    className="flex items-start justify-between gap-3 text-sm no-underline rounded-lg px-2 -mx-2 py-2.5 transition-colors hover:bg-surface-hover/50"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate text-fg">{r.templateName}</p>
                      <p className="text-xs text-fg-secondary line-clamp-1">
                        {r.reason}
                      </p>
                    </div>
                    <span className="text-xs text-fg-tertiary whitespace-nowrap font-mono pt-0.5">
                      {fmtDate(r.createdAt, locale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Health */}
        <div className="panel p-5">
          <h3 className="mb-4">{t("healthTitle")}</h3>
          {/* Numbers always stay visible — the zeros are informative too. */}
          {healthy && (
            <p className="text-sm text-success flex items-center gap-2 mb-4">
              <span className="inline-block size-2 rounded-full bg-success" />
              {t("allClear")}
            </p>
          )}
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-t border-border-ink pt-3 first:border-0 first:pt-0">
              <dt className="text-fg-secondary">{t("webhooksDown")}</dt>
              <dd>
                <Badge variant={stats.webhooksDown > 0 ? "danger" : "success"}>
                  {stats.webhooksDown}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-border-ink pt-3">
              <dt className="text-fg-secondary">{t("failedChecks24h")}</dt>
              <dd>
                <Badge variant={stats.failedChecks24h > 0 ? "warning" : "success"}>
                  {stats.failedChecks24h}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-border-ink pt-3">
              <dt className="text-fg-secondary">{t("failedMessages24h")}</dt>
              <dd>
                <Badge variant={stats.failedMessages24h > 0 ? "warning" : "success"}>
                  {stats.failedMessages24h}
                </Badge>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
