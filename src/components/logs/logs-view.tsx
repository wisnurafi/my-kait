"use client";

/**
 * Logs view — filter, search, summary, detail drawer.
 * See PRD sections 3.8, 3.8.1.
 */

import { useState, useTransition, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card } from "@/components/ui/card";
import { Badge, FilterChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { Mascot } from "@/components/mascot";
import { clearLogsAction, deleteMessageAction } from "@/server/actions/messages";
import { saveAsTemplateAction } from "@/server/actions/templates";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Pencil,
  Eye,
  RefreshCw,
  Download,
  Save,
  Terminal,
} from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { DiscordPreview } from "@/components/editor/discord-preview";

type MessageStatus = "sent" | "failed" | "rate_limited" | "edited" | "deleted";
type MessageMode = "normal" | "embed" | "both";

const statusConfig: Record<MessageStatus, { variant: "success" | "danger" | "warning" | "info" | "default" }> = {
  sent: { variant: "success" },
  failed: { variant: "danger" },
  rate_limited: { variant: "warning" },
  edited: { variant: "info" },
  deleted: { variant: "default" },
};

function staggerStyle(i: number) {
  return { "--stagger-index": i } as React.CSSProperties;
}

export function LogsView({
  logsData,
  webhooks,
  currentFilters,
}: {
  logsData: {
    logs: Array<{
      id: string;
      webhookNameSnapshot: string;
      mode: MessageMode;
      webhookId: string | null;
      payload: Record<string, unknown> | null;
      status: MessageStatus;
      httpStatus: number | null;
      latencyMs: number | null;
      discordMessageId: string | null;
      error: string | null;
      source: string;
      createdAt: Date;
    }>;
    total: number;
    page: number;
    totalPages: number;
    summary: { sent: number; failed: number; successRate: number };
  };
  webhooks: Array<{ id: string; name: string }>;
  currentFilters: Record<string, string | undefined>;
}) {
  const t = useTranslations("logs");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedLog, setSelectedLog] = useState<(typeof logsData.logs)[0] | null>(null);
  const [search, setSearch] = useState(currentFilters.search ?? "");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(currentFilters as Record<string, string>);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`?${params.toString()}`);
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (currentFilters.search ?? "")) {
        updateFilter("search", search);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
  }

  function applySearch() {
    updateFilter("search", search);
  }

  function handlePageChange(newPage: number) {
    updateFilter("page", String(newPage));
  }

  function handleClearLogs() {
    setConfirmClearOpen(true);
  }

  function doClearLogs() {
    setConfirmClearOpen(false);
    startTransition(async () => {
      try {
        await clearLogsAction();
        toast.success(t("toast.clearSuccess"));
      } catch {
        toast.error(t("toast.clearFailed"));
      }
    });
  }

  function doDeleteMessage() {
    if (!selectedLog) return;
    const logId = selectedLog.id;
    setConfirmDeleteOpen(false);
    const fd = new FormData();
    fd.set("logId", logId);
    startTransition(async () => {
      const res = await deleteMessageAction(null, fd);
      if (res && "error" in res && res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("toast.deleted"));
      }
      setSelectedLog(null);
    });
  }

  function loadIntoEditor(payload: Record<string, unknown> | null, editLogId?: string) {
    const json = JSON.stringify(payload ?? {});
    sessionStorage.setItem("mykait-import-payload", json);
    if (editLogId) sessionStorage.setItem("mykait-edit-message-id", editLogId);
    toast.success(t("toast.loadedToEditor"));
    router.push("/editor");
  }

  return (
    <div className="space-y-6">
      {/* Page head */}
      <div className="flex items-start justify-between gap-4 flex-wrap stagger-in">
        <div>
          <div className="label mb-2">{t("title")}</div>
          <h2 className="uppercase">{t("title")}</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const csv = exportToCsv(logsData.logs);
              downloadFile(csv, "logs.csv", "text/csv");
            }}
            className="gap-1.5"
          >
            <Download size={14} /> CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const json = JSON.stringify(logsData.logs, null, 2);
              downloadFile(json, "logs.json", "application/json");
            }}
            className="gap-1.5"
          >
            <Download size={14} /> JSON
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearLogs}
            disabled={pending}
            className="text-error gap-1.5"
          >
            <Trash2 size={14} />
            {t("clearLogs")}
          </Button>
        </div>
      </div>

      {/* Summary cards — all-time totals, independent of active filters */}
      <div>
        <p className="text-[11px] text-fg-tertiary mb-2">{t("summaryAllTime")}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { value: logsData.summary.sent, label: t("summary.sent"), color: "text-success" },
            { value: logsData.summary.failed, label: t("summary.failed"), color: "text-error" },
            { value: `${logsData.summary.successRate}%`, label: t("summary.successRate"), color: "" },
          ].map((s, i) => (
            <div key={s.label} className="stagger-in" style={staggerStyle(i)}>
              <Card hover className="p-5">
                <div className={`text-3xl font-display font-bold ${s.color}`}>{s.value}</div>
                <div className="label mt-1.5">{s.label}</div>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="stagger-in" style={staggerStyle(3)}>
        <Card className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label>{t("filterStatus")}</Label>
              <Select
                value={currentFilters.status ?? ""}
                onChange={(e) => updateFilter("status", e.target.value)}
              >
                <option value="">{t("filterAll")}</option>
                <option value="sent">{t("status.sent")}</option>
                <option value="failed">{t("status.failed")}</option>
                <option value="rate_limited">{t("status.rate_limited")}</option>
                <option value="edited">{t("status.edited")}</option>
                <option value="deleted">{t("status.deleted")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("filterWebhook")}</Label>
              <Select
                value={currentFilters.webhookId ?? ""}
                onChange={(e) => updateFilter("webhookId", e.target.value)}
              >
                <option value="">{t("filterAll")}</option>
                {webhooks.map((wh) => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t("filterMode")}</Label>
              <Select
                value={currentFilters.mode ?? ""}
                onChange={(e) => updateFilter("mode", e.target.value)}
              >
                <option value="">{t("filterAll")}</option>
                <option value="normal">{t("mode.normal")}</option>
                <option value="embed">{t("mode.embed")}</option>
                <option value="both">{t("mode.both")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("filterDate")}</Label>
              <Select
                value={currentFilters.datePreset ?? "30d"}
                onChange={(e) => updateFilter("datePreset", e.target.value)}
              >
                <option value="today">{t("datePresets.today")}</option>
                <option value="7d">{t("datePresets.7d")}</option>
                <option value="30d">{t("datePresets.30d")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("sortLabel")}</Label>
              <Select
                value={currentFilters.sort ?? "newest"}
                onChange={(e) => updateFilter("sort", e.target.value)}
              >
                <option value="newest">{t("sortNewest")}</option>
                <option value="oldest">{t("sortOldest")}</option>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex gap-2.5 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" size={16} />
              <Input
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={handleSearch}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
                className="pl-9 font-mono"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={applySearch}>{tc("search")}</Button>
            <div className="flex items-center gap-2 flex-wrap">
              {currentFilters.status && (
                <FilterChip active onClick={() => updateFilter("status", "")} className="inline-flex items-center gap-1.5">
                  {t(`status.${currentFilters.status}`)} <X size={11} />
                </FilterChip>
              )}
              {currentFilters.mode && (
                <FilterChip active onClick={() => updateFilter("mode", "")} className="inline-flex items-center gap-1.5">
                  {t(`mode.${currentFilters.mode as "normal" | "embed" | "both"}`)} <X size={11} />
                </FilterChip>
              )}
              {currentFilters.search && (
                <FilterChip active onClick={() => updateFilter("search", "")} className="inline-flex items-center gap-1.5">
                  &ldquo;{currentFilters.search}&rdquo; <X size={11} />
                </FilterChip>
              )}
              {(currentFilters.status || currentFilters.webhookId || currentFilters.mode || currentFilters.search) && (
                <Button variant="ghost" size="sm" onClick={() => router.push("?")} className="gap-1">
                  <X size={14} /> {tc("reset")}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Logs list — terminal style */}
      {logsData.logs.length === 0 ? (
        <Card className="p-12 text-center">
          <Mascot mini size={56} className="mx-auto mb-4" />
          <p className="text-fg-secondary text-lg">{t("noLogs")}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {logsData.logs.map((log, i) => {
            const sc = statusConfig[log.status];
            return (
              <div key={log.id} className="stagger-in" style={staggerStyle(Math.min(i, 12))}>
                <Card hover className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                      <Badge variant={sc.variant} dot className="flex-shrink-0">
                        {t(`status.${log.status}`)}
                      </Badge>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{log.webhookNameSnapshot}</div>
                        <div className="font-mono text-xs text-fg-tertiary mt-0.5">
                          {new Date(log.createdAt).toLocaleString(locale)} · #{log.id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-fg-secondary mt-0.5">
                          {t(`mode.${log.mode as "normal" | "embed" | "both"}`)} · {t(`source.${log.source as "send" | "edit" | "delete" | "resend"}`)}
                          {log.httpStatus && ` · HTTP ${log.httpStatus}`}
                          {log.latencyMs != null && ` · ${log.latencyMs}ms`}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                      className="gap-1.5"
                    >
                      <Eye size={14} />
                      {t("detail.title")}
                    </Button>
                  </div>
                </Card>
              </div>
            );
          })}

          {/* Pagination */}
          {logsData.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(logsData.page - 1)}
                disabled={logsData.page <= 1}
                className="gap-1"
              >
                <ChevronLeft size={16} /> {tc("prev")}
              </Button>
              <span className="text-sm text-fg-secondary font-mono">
                {logsData.page} / {logsData.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(logsData.page + 1)}
                disabled={logsData.page >= logsData.totalPages}
                className="gap-1"
              >
                {tc("next")} <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Detail panel */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setSelectedLog(null)}
            aria-hidden
          />
          <div
            className="relative w-full max-w-lg h-full panel overflow-y-auto p-6"
            style={{ borderLeft: "1px solid var(--border)", borderRadius: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold uppercase">{t("detail.title")}</h2>
              <Tooltip content={t("detail.close")} position="bottom">
                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                  <X size={18} />
                </Button>
              </Tooltip>
            </div>

            <div className="space-y-5">
              {/* Meta */}
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center gap-3">
                  <span className="text-fg-secondary">{t("detail.messageId")}</span>
                  <span className="font-mono text-xs text-fg-tertiary truncate">{selectedLog.discordMessageId ?? "—"}</span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <span className="text-fg-secondary">{t("detail.logId")}</span>
                  <span className="font-mono text-xs text-fg-tertiary truncate">{selectedLog.id}</span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <span className="text-fg-secondary">{t("detail.time")}</span>
                  <span className="font-mono text-xs text-fg-tertiary">
                    {new Date(selectedLog.createdAt).toLocaleString(locale)}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <span className="text-fg-secondary">{t("filterStatus")}</span>
                  <Badge variant={statusConfig[selectedLog.status].variant} dot>
                    {t(`status.${selectedLog.status}`)}
                  </Badge>
                </div>
                {selectedLog.httpStatus && (
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-fg-secondary">HTTP</span>
                    <span className="font-mono text-xs text-fg-tertiary">{selectedLog.httpStatus}</span>
                  </div>
                )}
                {selectedLog.latencyMs != null && (
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-fg-secondary">{t("detail.duration")}</span>
                    <span className="font-mono text-xs text-fg-tertiary">{selectedLog.latencyMs}ms</span>
                  </div>
                )}
                {selectedLog.error && (
                  <div>
                    <div className="text-fg-secondary mb-1.5">{t("detail.error")}</div>
                    <div className="bg-sunken border border-border-ink rounded-lg p-3 text-xs text-error overflow-x-auto whitespace-pre-wrap font-mono">
                      {selectedLog.error}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              {selectedLog.payload && (
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => loadIntoEditor(selectedLog.payload)}
                  >
                    <Copy size={14} /> {t("detail.duplicate")}
                  </Button>
                  {selectedLog.status === "failed" && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => loadIntoEditor(selectedLog.payload)}
                    >
                      <RefreshCw size={14} /> {t("detail.resend")}
                    </Button>
                  )}
                  {selectedLog.discordMessageId && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => loadIntoEditor(selectedLog.payload, selectedLog.id)}
                      >
                        <Pencil size={14} /> {t("detail.editMessage")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1.5"
                        disabled={!selectedLog.discordMessageId || pending}
                        onClick={() => setConfirmDeleteOpen(true)}
                      >
                        <Trash2 size={14} /> {t("detail.deleteMessage")}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    disabled={!selectedLog.payload || pending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          const fd = new FormData();
                          fd.set("name", `${selectedLog.webhookNameSnapshot} ${t("detail.fromLog")}`);
                          fd.set("payload", JSON.stringify(selectedLog.payload ?? {}));
                          const res = await saveAsTemplateAction(null, fd);
                          if (res && "error" in res && res.error) {
                            toast.error(res.error);
                          } else {
                            toast.success(t("detail.templateSaved"));
                          }
                        } catch {
                          toast.error(t("detail.templateSaveFailed"));
                        }
                      });
                    }}
                  >
                    <Save size={14} /> {t("detail.saveTemplate")}
                  </Button>
                </div>
              )}

              {/* Payload — terminal block */}
              {selectedLog.payload && (
                <div>
                  <h3 className="font-display text-sm uppercase mb-2 flex items-center gap-1.5">
                    <Terminal size={14} className="text-fg-tertiary" /> {t("detail.payload")}
                  </h3>
                  <pre className="bg-sunken border border-border-ink rounded-lg p-4 text-xs leading-relaxed overflow-auto max-h-72 whitespace-pre-wrap break-words font-mono">
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                </div>
              )}

              {/* Payload preview */}
              {selectedLog.payload && (
                <div>
                  <h3 className="font-display text-sm uppercase mb-2">{t("detail.preview")}</h3>
                  <DiscordPreview
                    payload={selectedLog.payload ?? {}}
                    username="My Kait"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm: clear all logs */}
      <ConfirmDialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={doClearLogs}
        title={t("clearLogs")}
        message={t("confirmClear")}
        confirmLabel={t("clearLogs")}
        loading={pending}
        danger
      />

      {/* Confirm: delete Discord message */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={doDeleteMessage}
        title={t("detail.deleteMessage")}
        message={t("detail.confirmDeleteMessage")}
        confirmLabel={t("detail.deleteMessage")}
        loading={pending}
        danger
      />
    </div>
  );
}

/* --- Export helpers --- */

function exportToCsv(logs: Array<{ webhookNameSnapshot: string; mode: string; status: string; httpStatus: number | null; latencyMs: number | null; error: string | null; createdAt: Date }>): string {
  const headers = ["Waktu", "Webhook", "Mode", "Status", "HTTP", "Latency", "Error"];
  const rows = logs.map((l) => [
    new Date(l.createdAt).toISOString(),
    l.webhookNameSnapshot,
    l.mode,
    l.status,
    l.httpStatus ?? "",
    l.latencyMs ?? "",
    (l.error ?? "").replace(/"/g, '""'),
  ]);
  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
