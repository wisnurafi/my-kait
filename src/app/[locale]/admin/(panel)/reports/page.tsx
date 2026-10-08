import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { getReports, type ReportStatus } from "@/server/actions/admin";
import { ReportActions } from "@/components/admin/report-actions";
import { ReportDetailButton } from "@/components/admin/report-detail";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

const FILTERS: (ReportStatus | "all")[] = [
  "all",
  "pending",
  "reviewed",
  "dismissed",
  "actioned",
];

function filterLabel(f: ReportStatus | "all"): string {
  if (f === "all") return "filterAll";
  return `filter${f[0].toUpperCase()}${f.slice(1)}`;
}

const statusVariant = {
  pending: "warning",
  reviewed: "info",
  dismissed: "default",
  actioned: "success",
} as const;

function fmtDate(d: Date, locale: string) {
  return new Date(d).toLocaleString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const active: ReportStatus | "all" =
    status === "pending" ||
    status === "reviewed" ||
    status === "dismissed" ||
    status === "actioned"
      ? status
      : "all";
  const reports = await getReports(active === "all" ? undefined : active);

  return (
    <div className="space-y-6">
      <div className="stagger-in">
        <div className="label mb-2 cursor-blink">{t("eyebrow")}</div>
        <h2>{t("reportsTitle")}</h2>
        <p className="text-sm text-fg-secondary mt-1">{t("reportsSubtitle")}</p>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 flex-wrap stagger-in">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/admin/reports" : `/admin/reports?status=${f}`}
            className={cn(
              "px-3 py-1.5 rounded-lg no-underline font-mono text-[11px] uppercase tracking-[0.12em] border transition-colors",
              active === f
                ? "bg-accent-soft text-accent border-accent/30"
                : "text-fg-secondary border-border-ink hover:text-fg hover:border-border-strong",
            )}
          >
            {t(filterLabel(f))}
          </Link>
        ))}
      </div>

      {/* Queue — .rtable collapses into labeled stacked cards on mobile */}
      <div className="panel overflow-hidden stagger-in p-3 md:p-0">
        {reports.length === 0 ? (
          <p className="p-6 text-sm text-fg-secondary">{t("emptyReports")}</p>
        ) : (
          <table className="rtable">
            <thead>
              <tr>
                <th>{t("colTemplate")}</th>
                <th>{t("colReporter")}</th>
                <th>{t("colReason")}</th>
                <th>{t("colDate")}</th>
                <th>{t("colStatus")}</th>
                <th className="text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td data-label={t("colTemplate")}>
                    <div className="font-medium max-w-[180px] truncate">
                      {r.templateName}
                    </div>
                    {r.templateSlug && (
                      <Link
                        href={`/t/${r.templateSlug}`}
                        target="_blank"
                        title={t("viewTemplate")}
                        className="font-mono text-xs text-accent hover:underline inline-flex items-center gap-1 no-underline mt-0.5"
                      >
                        /t/{r.templateSlug} <ExternalLink size={11} />
                      </Link>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      {r.reportCount > 1 && (
                        <Badge variant="warning" className="font-mono text-[10px]">
                          {t("reportedTimes", { count: r.reportCount })}
                        </Badge>
                      )}
                      {r.shareActive === false && (
                        <Badge variant="default" className="font-mono text-[10px]">
                          {t("unshared")}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td data-label={t("colReporter")} className="text-fg-secondary whitespace-nowrap">
                    {r.reporterId ? (
                      <Link
                        href={`/admin/users/${r.reporterId}`}
                        className="no-underline hover:text-fg hover:underline"
                      >
                        {r.reporterName}
                      </Link>
                    ) : (
                      (r.reporterName ?? t("anonymous"))
                    )}
                  </td>
                  <td data-label={t("colReason")} className="max-w-[280px]">
                    <span className="line-clamp-2 text-fg-secondary">
                      {r.reason}
                    </span>
                  </td>
                  <td data-label={t("colDate")} className="text-xs text-fg-tertiary whitespace-nowrap font-mono">
                    {fmtDate(r.createdAt, locale)}
                  </td>
                  <td data-label={t("colStatus")} className="whitespace-nowrap">
                    <Badge variant={statusVariant[r.status]}>
                      {t(filterLabel(r.status))}
                    </Badge>
                  </td>
                  <td data-label={t("colActions")}>
                    {/* Single flex row: detail + moderation actions stay
                        aligned; wraps only on narrow screens. */}
                    <div className="flex items-center gap-1.5 flex-wrap md:justify-end">
                      <ReportDetailButton
                        report={{
                          templateName: r.templateName,
                          templateSlug: r.templateSlug,
                          reporterName: r.reporterName ?? t("anonymous"),
                          reporterId: r.reporterId,
                          reason: r.reason,
                          dateLabel: fmtDate(r.createdAt, locale),
                          statusLabel: t(filterLabel(r.status)),
                          statusVariant: statusVariant[r.status],
                          reportCount: r.reportCount,
                        }}
                      />
                      {r.status === "pending" ? (
                        <ReportActions reportId={r.id} />
                      ) : (
                        <span className="text-xs text-fg-tertiary">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reports.length >= 200 && (
        <p className="text-xs text-fg-tertiary font-mono">{t("limitNote")}</p>
      )}
    </div>
  );
}
