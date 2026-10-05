import { setRequestLocale } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getWebhooks, getHealthAlerts } from "@/server/actions/webhooks";
import { getWebhookFolders } from "@/server/actions/folders";
import { WebhooksList } from "@/components/webhooks/webhooks-list";
import { AddWebhookForm } from "@/components/webhooks/add-webhook-form";
import { HealthAlerts } from "@/components/webhooks/health-alerts";
import { FolderQuickAdd } from "@/components/webhooks/folder-quick-add";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

const VALID_STATUSES = ["active", "invalid", "rate_limited", "unchecked"];

export default async function WebhooksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ search?: string; folder?: string; status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { search, folder, status } = await searchParams;
  const activeFolder = folder ?? "all";
  // Status filter is URL-driven (shareable, survives refresh) — validated
  // here so an unknown value never silently filters everything out.
  const statusFilter = status && VALID_STATUSES.includes(status) ? status : "";

  const [webhooks, healthAlerts, folderData] = await Promise.all([
    getWebhooks(
      search,
      activeFolder === "all" ? undefined : activeFolder === "unfiled" ? null : activeFolder,
    ),
    getHealthAlerts(),
    getWebhookFolders(),
  ]);
  const t = await getTranslations("webhooks");

  function folderHref(f: string) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (f !== "all") params.set("folder", f);
    const qs = params.toString();
    return `/${locale}/webhooks${qs ? `?${qs}` : ""}`;
  }

  function chip(f: string, label: string, count: number) {
    const isActive = activeFolder === f;
    return (
      <Link
        key={f}
        href={folderHref(f)}
        className={cn(
          "font-mono text-xs uppercase tracking-[0.08em] px-3 py-1.5 rounded-full border transition-colors",
          isActive
            ? "bg-accent text-[#0a0a0b] border-accent font-bold"
            : "border-border-ink text-fg-secondary hover:text-fg hover:border-border-strong",
        )}
        aria-current={isActive ? "true" : undefined}
      >
        {label} <span className="opacity-60">{count}</span>
      </Link>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <HealthAlerts initialAlerts={healthAlerts} />
      <AddWebhookForm />
      <div className="flex items-center gap-2 flex-wrap stagger-in" role="group" aria-label={t("folderFilter")}>
        {(folderData.folders.length > 0 || folderData.unfiledCount > 0) && (
          <>
            {chip("all", t("foldersAll"), folderData.totalCount)}
            {chip("unfiled", t("foldersUnfiled"), folderData.unfiledCount)}
            {folderData.folders.map((f) => chip(f.id, f.name, f.webhookCount))}
          </>
        )}
        <FolderQuickAdd />
      </div>
      <WebhooksList
        webhooks={webhooks}
        folders={folderData.folders}
        statusFilter={statusFilter}
      />
    </div>
  );
}
