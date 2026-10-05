import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { getWebhooks } from "@/server/actions/webhooks";
import { getLogs } from "@/server/actions/messages";
import { getDashboardStats } from "@/server/actions/stats";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mascot } from "@/components/mascot";
import { CommandPaletteButton } from "@/components/app/command-palette";
import { DashboardStats, StatCards } from "@/components/dashboard/dashboard-stats";
import { Plus } from "lucide-react";

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
      {/* Page head */}
      <div className="flex items-start justify-between gap-4 flex-wrap stagger-in">
        <div className="flex items-center gap-4">
          <Mascot mini size={52} />
          <div>
            <div className="label mb-2">{t("overview")}</div>
            <h2>{t("missionControl")}</h2>
            <p className="text-fg-secondary mt-1 text-sm">{t("welcome")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <CommandPaletteButton />
          <Link href="/editor">
            <Button className="gap-2">
              <Plus size={16} />
              {t("createMessage")}
            </Button>
          </Link>
        </div>
      </div>

      <StatCards
        webhooks={webhooks.length}
        sent={stats.totals.sent}
        successRate={stats.totals.successRate}
        caption={t("stats.last30days")}
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

      {/* Recent activity — table */}
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
            <div className="p-8 text-center text-fg-secondary text-sm">
              {t("noActivity")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-ink">
                    <th className="label text-left font-medium px-5 py-3">{t("tableStatus")}</th>
                    <th className="label text-left font-medium px-4 py-3">{t("tableTarget")}</th>
                    <th className="label text-left font-medium px-4 py-3">{t("tableMode")}</th>
                    <th className="label text-left font-medium px-4 py-3">{t("tableLatency")}</th>
                    <th className="label text-right font-medium px-5 py-3">{t("tableTime")}</th>
                  </tr>
                </thead>
                <tbody>
                  {logsData.logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border-ink last:border-0 transition-colors hover:bg-surface-hover"
                    >
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`status-dot ${statusDot[log.status] ?? "bg-fg-tertiary"}`}
                          />
                          <Badge variant={statusVariants[log.status] ?? "default"}>
                            {tLogs(`status.${log.status}`)}
                          </Badge>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium truncate max-w-[220px]">
                        {log.webhookNameSnapshot}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-fg-secondary">
                        {tLogs(`mode.${log.mode as "normal" | "embed" | "both"}`)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-fg-secondary">
                        {log.latencyMs != null ? `${log.latencyMs}ms` : "—"}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-fg-tertiary text-right whitespace-nowrap">
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
