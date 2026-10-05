import { setRequestLocale } from "next-intl/server";
import { getLogs } from "@/server/actions/messages";
import { getWebhooks } from "@/server/actions/webhooks";
import { LogsView } from "@/components/logs/logs-view";

export default async function LogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const filters = await searchParams;
  const [rawLogsData, webhooks] = await Promise.all([
    getLogs({
      status: filters.status,
      webhookId: filters.webhookId,
      mode: filters.mode,
      source: filters.source,
      search: filters.search,
      datePreset: filters.datePreset ?? "30d",
      sort: filters.sort ?? "newest",
      page: filters.page ? parseInt(filters.page) : 1,
    }),
    getWebhooks(),
  ]);

  // Drizzle infers jsonb payload as `unknown`; narrow it to the shape
  // LogsView expects so the page stays type-safe without an `as any`.
  const logsData = {
    ...rawLogsData,
    logs: rawLogsData.logs.map((log) => ({
      ...log,
      payload: log.payload as Record<string, unknown> | null,
    })),
  };

  return <LogsView logsData={logsData} webhooks={webhooks} currentFilters={filters} />;
}
