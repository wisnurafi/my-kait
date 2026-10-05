import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { getWebhooks } from "@/server/actions/webhooks";
import { getLogs } from "@/server/actions/messages";
import { getDashboardStats } from "@/server/actions/stats";
import { Link } from "@/i18n/routing";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mascot } from "@/components/mascot";
import { CommandPaletteButton } from "@/components/app/command-palette";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardStats, StatCards } from "@/components/dashboard/dashboard-stats";
import { cn } from "@/lib/utils";
import { Plus, History } from "lucide-react";

const statusVariants = {
  sent: "success",
  failed: "danger",
  rate_limited: "warning",
  edited: "info",
  deleted: "default",
} as const;

const statusDot: Record<string, string> = {
  sent: "bg-success",
  failed: "bg-error",
  rate_limited: "bg-warning",
  edited: "bg-info",
  deleted: "bg-fg-tertiary",
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  const tLogs = await getTranslations("logs");
  const format = await getFormatter();

  const [webhooks, logsData, stats] = await Promise.all([
    getWebhooks(),
    getLogs({ perPage: 5 }),
    getDashboardStats(),
  ]);

  return (
    <div className="space-y-6">
      {/* Page head — unified PageHeader (eyebrow blinks via .cursor-blink) */}
      <div className="stagger-in">
        <PageHeader
          eyebrow={t("overview")}
          title={t("missionControl")}
          description={t("welcome")}
          media={<Mascot mini size={52} />}
          actions={
            <>
              <CommandPaletteButton />
              <Link href="/editor" className={cn(buttonClasses("primary", "md"), "hv")}>
                <span className="ia ia-plus90">
                  <Plus size={16} />
                </span>
                {t("createMessage")}
              </Link>
            </>
          }
        />
      </div>

      <StatCards
        webhooks={webhooks.length}
        sent={stats.totals.sent}
        successRate={stats.totals.successRate}
        caption={t("stats.last30days")}
        daily={stats.daily}
      />

      <div>
        <h2
          className="text-xl mb-4 stagger-in"
          style={{ "--stagger-index": 2 } as React.CSSProperties}
        >
          {t("stats.title")}
        </h2>
        <DashboardStats
          daily={stats.daily}
          webhooks={stats.webhooks}
          successRate={stats.totals.successRate}
          sent={stats.totals.sent}
          failed={stats.totals.failed}
        />
      </div>

      {/* Recent activity — responsive .rtable (cards on mobile) */}
      <div>
        <div
          className="panel overflow-hidden stagger-in"
          style={{ "--stagger-index": 6 } as React.CSSProperties}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-ink">
            <span className="font-display font-semibold text-[15px]">
              {t("recentActivity")}
            </span>
            <Link
              href="/logs"
              className="font-mono text-xs text-accent no-underline hover:text-accent-deep"
            >
              {t("viewAll")} →
            </Link>
          </div>
          {logsData.logs.length === 0 ? (
            <EmptyState
              icon={<History size={22} />}
              title={t("recentActivity")}
              description={t("noActivity")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="rtable">
                <thead>
                  <tr>
                    <th>{t("tableStatus")}</th>
                    <th>{t("tableTarget")}</th>
                    <th>{t("tableMode")}</th>
                    <th>{t("tableLatency")}</th>
                    <th className="text-right">{t("tableTime")}</th>
                  </tr>
                </thead>
                <tbody>
                  {logsData.logs.map((log) => (
                    <tr key={log.id}>
                      <td data-label={t("tableStatus")}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`status-dot ${statusDot[log.status] ?? "bg-fg-tertiary"}`}
                          />
                          <Badge variant={statusVariants[log.status] ?? "default"}>
                            {tLogs(`status.${log.status}`)}
                          </Badge>
                        </span>
                      </td>
                      <td data-label={t("tableTarget")} className="font-medium truncate max-w-[220px]">
                        <Link
                          href={`/logs?search=${encodeURIComponent(log.discordMessageId ?? log.webhookNameSnapshot)}`}
                          className="hover:text-link hover:underline"
                          title={t("viewInLogs")}
                        >
                          {log.webhookNameSnapshot}
                        </Link>
                      </td>
                      <td
                        data-label={t("tableMode")}
                        className="font-mono text-xs text-fg-secondary"
                      >
                        {tLogs(`mode.${log.mode as "normal" | "embed" | "both"}`)}
                      </td>
                      <td
                        data-label={t("tableLatency")}
                        className="font-mono text-xs text-fg-secondary"
                      >
                        {log.latencyMs != null ? `${log.latencyMs}ms` : "—"}
                      </td>
                      <td
                        data-label={t("tableTime")}
                        className="font-mono text-xs text-fg-tertiary text-right whitespace-nowrap"
                      >
                        {format.dateTime(log.createdAt, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
