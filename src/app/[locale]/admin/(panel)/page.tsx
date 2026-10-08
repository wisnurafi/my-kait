import { setRequestLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Mascot } from "@/components/mascot";
import { getAdminOverview, getReports, getAdminActivity, getHealthDetails } from "@/server/actions/admin";
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

/**
 * One health KPI row. When `expandLabel` is set and the count is non-zero,
 * the row becomes an expandable <details> disclosing the drill-down list.
 */
function HealthRow({
  label,
  count,
  variant,
  expandLabel,
  children,
}: {
  label: string;
  count: number;
  variant: "danger" | "warning" | "success";
  expandLabel?: string;
  children?: ReactNode;
}) {
  const head = (
    <>
      <span className="text-fg-secondary flex items-center gap-2">
        {expandLabel && count > 0 && (
          <ChevronRight
            size={14}
            aria-hidden="true"
            className="text-fg-tertiary transition-transform group-open:rotate-90"
          />
        )}
        {label}
      </span>
      <Badge variant={count > 0 ? variant : "success"}>{count}</Badge>
    </>
  );
  const rowClass = "border-t border-border-ink pt-3 first:border-0 first:pt-0";
  if (!expandLabel || count === 0) {
    return (
      <div className={`flex items-center justify-between ${rowClass}`}>
        {head}
      </div>
    );
  }
  return (
    <details className={`group ${rowClass}`}>
      <summary
        aria-label={expandLabel}
        className="flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden"
      >
        {head}
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  );
}

/** One compact drill-down line: title + meta, owner linked to user detail. */
function HealthItem({
  title,
  sub,
  userId,
  username,
}: {
  title: string;
  sub: string;
  userId: string;
  username: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-t border-border-ink/60 first:border-0">
      <div className="min-w-0">
        <p className="font-medium text-fg truncate text-[13px]">{title}</p>
        <p className="text-[11px] text-fg-tertiary truncate font-mono">{sub}</p>
      </div>
      <Link
        href={`/admin/users/${userId}`}
        title={username}
        className="shrink-0 text-xs text-accent hover:underline no-underline font-mono"
      >
        {username}
      </Link>
    </div>
  );
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
    stats.failedMessages24h === 0 &&
    stats.failedScheduled24h === 0 &&
    stats.stuckScheduled === 0;
  // Drill-down lists are fetched only when something needs attention.
  const showDetails =
    stats.webhooksDown > 0 ||
    stats.failedMessages24h > 0 ||
    stats.failedScheduled24h > 0 ||
    stats.stuckScheduled > 0;
  const details = showDetails ? await getHealthDetails() : null;

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
          <div className="space-y-3 text-sm">
            <HealthRow
              label={t("webhooksDown")}
              count={stats.webhooksDown}
              variant="danger"
              expandLabel={t("healthExpand")}
            >
              {details?.downWebhooks.map((w) => (
                <HealthItem
                  key={w.id}
                  title={w.name}
                  sub={
                    w.lastCheckedAt
                      ? t("healthCheckedAt", {
                          date: fmtDate(w.lastCheckedAt, locale),
                        })
                      : t("healthNeverChecked")
                  }
                  userId={w.userId}
                  username={w.username}
                />
              ))}
              {details &&
                stats.webhooksDown - details.downWebhooks.length > 0 && (
                  <p className="text-[11px] text-fg-tertiary font-mono pt-1">
                    {t("healthAndMore", {
                      count: stats.webhooksDown - details.downWebhooks.length,
                    })}
                  </p>
                )}
            </HealthRow>
            <HealthRow
              label={t("failedChecks24h")}
              count={stats.failedChecks24h}
              variant="warning"
            />
            <HealthRow
              label={t("failedMessages24h")}
              count={stats.failedMessages24h}
              variant="warning"
              expandLabel={t("healthExpand")}
            >
              {details && details.topFailedMessages.length > 0 && (
                <p className="text-[11px] text-fg-tertiary font-mono pt-1 pb-0.5">
                  {t("healthTopNote")}
                </p>
              )}
              {details?.topFailedMessages.map((m) => (
                <HealthItem
                  key={`${m.userId}:${m.webhookName}`}
                  title={m.webhookName}
                  sub={t("healthFailures", { count: m.failures })}
                  userId={m.userId}
                  username={m.username}
                />
              ))}
            </HealthRow>
            <HealthRow
              label={t("failedScheduled24h")}
              count={stats.failedScheduled24h}
              variant="warning"
              expandLabel={t("healthExpand")}
            >
              {details?.failedScheduled.map((s) => (
                <HealthItem
                  key={s.id}
                  title={s.webhookName}
                  sub={`${fmtDate(s.scheduledAt, locale)} · ${t("attemptsLabel", { count: s.attempts })}`}
                  userId={s.userId}
                  username={s.username}
                />
              ))}
              {details &&
                stats.failedScheduled24h - details.failedScheduled.length > 0 && (
                  <p className="text-[11px] text-fg-tertiary font-mono pt-1">
                    {t("healthAndMore", {
                      count:
                        stats.failedScheduled24h - details.failedScheduled.length,
                    })}
                  </p>
                )}
            </HealthRow>
            <HealthRow
              label={t("stuckScheduled")}
              count={stats.stuckScheduled}
              variant="danger"
              expandLabel={t("healthExpand")}
            >
              {details?.stuckScheduled.map((s) => (
                <HealthItem
                  key={s.id}
                  title={s.webhookName}
                  sub={
                    s.claimedAt
                      ? t("healthStuckSince", {
                          date: fmtDate(s.claimedAt, locale),
                        })
                      : fmtDate(s.scheduledAt, locale)
                  }
                  userId={s.userId}
                  username={s.username}
                />
              ))}
              {details &&
                stats.stuckScheduled - details.stuckScheduled.length > 0 && (
                  <p className="text-[11px] text-fg-tertiary font-mono pt-1">
                    {t("healthAndMore", {
                      count: stats.stuckScheduled - details.stuckScheduled.length,
                    })}
                  </p>
                )}
            </HealthRow>
          </div>
        </div>
      </div>
    </div>
  );
}
