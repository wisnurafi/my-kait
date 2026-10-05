import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { getReports, type ReportStatus } from "@/server/actions/admin";
import { ReportActions } from "@/components/admin/report-actions";
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
        <div className="label mb-2">{t("eyebrow")}</div>
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

      {/* Queue */}
      <div className="panel overflow-hidden stagger-in">
        {reports.length === 0 ? (
          <p className="p-6 text-sm text-fg-secondary">{t("emptyReports")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-tertiary text-left">
                  <th className="px-4 py-3 font-medium">{t("colTemplate")}</th>
                  <th className="px-4 py-3 font-medium">{t("colReporter")}</th>
                  <th className="px-4 py-3 font-medium">{t("colReason")}</th>
                  <th className="px-4 py-3 font-medium">{t("colDate")}</th>
                  <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
                  <th className="px-4 py-3 font-medium text-right">
                    {t("colActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-border-ink align-top hover:bg-surface-hover/50"
                  >
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-fg-secondary whitespace-nowrap">
                      {r.reporterName ?? t("anonymous")}
                    </td>
                    <td className="px-4 py-3 max-w-[280px]">
                      <p className="line-clamp-2 text-fg-secondary">{r.reason}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-tertiary whitespace-nowrap font-mono">
                      {fmtDate(r.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={statusVariant[r.status]}>
                        {t(filterLabel(r.status))}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
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
          </div>
        )}
      </div>
    </div>
  );
}
