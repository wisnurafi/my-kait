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
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Mascot } from "@/components/mascot";
import { clearLogsAction, deleteMessageAction, resendLogAction } from "@/server/actions/messages";
import { saveAsTemplateAction } from "@/server/actions/templates";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Copy,
  Pencil,
  RefreshCw,
  Download,
  Save,
  Terminal,
  History,
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
  const tn = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedLog, setSelectedLog] = useState<(typeof logsData.logs)[0] | null>(null);
  const [search, setSearch] = useState(currentFilters.search ?? "");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Whether any result-narrowing filter is active — drives the "no match"
  // vs "no logs yet" empty state distinction.
  const hasActiveFilters = Boolean(
    currentFilters.status ||
      currentFilters.webhookId ||
      currentFilters.mode ||
      currentFilters.source ||
      currentFilters.search,
  );

  // Lock body scroll while the detail drawer is open (same pattern as ui/dialog)
  useEffect(() => {
    if (!selectedLog) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selectedLog]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(currentFilters as Record<string, string>);
    if (value) params.set(key, value);
    else params.delete(key);
    // Changing any filter can shrink the result set — drop the page param
    // so we never land on an empty page. Page navigation itself is exempt.
    if (key !== "page") params.delete("page");
    router.push(`?${params.toString()}`, { scroll: false });
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

  function doResend() {
    if (!selectedLog?.payload) return;
    const logId = selectedLog.id;
    startTransition(async () => {
      const res = await resendLogAction(logId);
      if (res && "error" in res && res.error) {
        if ("code" in res && res.code === "NO_TARGET") {
          // Original webhook is gone: load the payload into the editor
          // so the user can pick a new target and send from there.
          loadIntoEditor(selectedLog.payload);
        }
        toast.error(res.error);
      } else {
        toast.success(t("toast.resent"));
        setSelectedLog(null);
      }
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
      <PageHeader
        eyebrow={tn("logs")}
        title={t("title")}
        media={<Mascot mini size={52} />}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const headers = [t("csvTime"), t("csvWebhook"), t("csvMode"), t("csvStatus"), t("csvHttp"), t("csvLatency"), t("csvError")];
                const csv = exportToCsv(logsData.logs, headers);
                downloadFile(csv, "logs.csv", "text/csv");
              }}
              className="hv gap-1.5"
            >
              <span className="ia ia-drop"><Download size={14} /></span> CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const json = JSON.stringify(logsData.logs, null, 2);
                downloadFile(json, "logs.json", "application/json");
              }}
              className="hv gap-1.5"
            >
              <span className="ia ia-drop"><Download size={14} /></span> JSON
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearLogs}
              disabled={pending}
              className="hv text-error gap-1.5"
            >
              <span className="ia ia-shake"><Trash2 size={14} /></span>
              {t("clearLogs")}
            </Button>
          </>
        }
      />

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

      {/* Filters — collapsible on mobile (<768px), always open on desktop.
          State is CSS-only via a checkbox + `peer-checked:`: the checkbox is
          never pre-checked, so server and client render identical HTML and
          visibility is decided purely by media queries. */}
      <div className="stagger-in" style={staggerStyle(3)}>
        <Card className="p-5">
          <input type="checkbox" id="logs-filter-toggle" className="peer sr-only" />
          <div className="md:hidden mb-1">
            <label
              htmlFor="logs-filter-toggle"
              className="hv inline-flex cursor-pointer items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-secondary hover:text-fg"
            >
              <span className="ia ia-nudge"><ChevronDown size={16} /></span>
              {t("filterToggle")}
            </label>
          </div>
          <div className="hidden peer-checked:block md:block">
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
              <Label>{t("filterSource")}</Label>
              <Select
                value={currentFilters.source ?? ""}
                onChange={(e) => updateFilter("source", e.target.value)}
              >
                <option value="">{t("filterAll")}</option>
                <option value="send">{t("source.send")}</option>
                <option value="edit">{t("source.edit")}</option>
                <option value="delete">{t("source.delete")}</option>
                <option value="resend">{t("source.resend")}</option>
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
              <span className="ia ia-scan absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary"><Search size={16} /></span>
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
                <FilterChip active onClick={() => updateFilter("status", "")} className="hv inline-flex items-center gap-1.5">
                  {t(`status.${currentFilters.status}`)} <span className="ia ia-x90"><X size={11} /></span>
                </FilterChip>
              )}
              {currentFilters.mode && (
                <FilterChip active onClick={() => updateFilter("mode", "")} className="hv inline-flex items-center gap-1.5">
                  {t(`mode.${currentFilters.mode as "normal" | "embed" | "both"}`)} <span className="ia ia-x90"><X size={11} /></span>
                </FilterChip>
              )}
              {currentFilters.webhookId && (
                <FilterChip active onClick={() => updateFilter("webhookId", "")} className="hv inline-flex items-center gap-1.5">
                  {webhooks.find((w) => w.id === currentFilters.webhookId)?.name ?? currentFilters.webhookId} <span className="ia ia-x90"><X size={11} /></span>
                </FilterChip>
              )}
              {currentFilters.source && (
                <FilterChip active onClick={() => updateFilter("source", "")} className="hv inline-flex items-center gap-1.5">
                  {t(`source.${currentFilters.source as "send" | "edit" | "delete" | "resend"}`)} <span className="ia ia-x90"><X size={11} /></span>
                </FilterChip>
              )}
              {currentFilters.search && (
                <FilterChip active onClick={() => updateFilter("search", "")} className="hv inline-flex items-center gap-1.5">
                  &ldquo;{currentFilters.search}&rdquo; <span className="ia ia-x90"><X size={11} /></span>
                </FilterChip>
              )}
              {(currentFilters.status || currentFilters.webhookId || currentFilters.mode || currentFilters.source || currentFilters.search) && (
                <Button variant="ghost" size="sm" onClick={() => router.push("?", { scroll: false })} className="hv gap-1">
                  <span className="ia ia-x90"><X size={14} /></span> {tc("reset")}
                </Button>
              )}
            </div>
          </div>
          </div>
        </Card>
      </div>

      {/* Logs table — .rtable: real table on desktop, stacked labeled
          cards below 768px (each td carries data-label). */}
      {logsData.logs.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={
              <span className="hv">
                <span className="ia ia-scan">
                  <Search size={22} />
                </span>
              </span>
            }
            title={t("noMatchTitle")}
            description={t("noMatchDesc")}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push("?", { scroll: false })}
                className="hv gap-1.5"
              >
                <span className="ia ia-x90">
                  <X size={14} />
                </span>{" "}
                {tc("reset")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={
              <span className="hv">
                <span className="ia ia-rewind">
                  <History size={22} />
                </span>
              </span>
            }
            title={t("noLogs")}
            description={t("emptyDesc")}
          />
        )
      ) : (
        <div className="space-y-2">
          <div className="panel overflow-hidden">
            <table className="rtable">
              <thead>
                <tr>
                  <th scope="col">{t("colStatus")}</th>
                  <th scope="col">{t("colTarget")}</th>
                  <th scope="col">{t("colMode")}</th>
                  <th scope="col">{t("colLatency")}</th>
                  <th scope="col">{t("colTime")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("colAction")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {logsData.logs.map((log) => {
                  const sc = statusConfig[log.status];
                  return (
                    <tr key={log.id}>
                      <td data-label={t("colStatus")}>
                        <Badge variant={sc.variant} dot className="flex-shrink-0">
                          {t(`status.${log.status}`)}
                        </Badge>
                      </td>
                      <td data-label={t("colTarget")}>
                        <div className="font-semibold text-sm">
                          {log.webhookNameSnapshot}
                        </div>
                        <div className="font-mono text-xs text-fg-tertiary mt-0.5">
                          #{log.id.slice(0, 8)} ·{" "}
                          {t(
                            `source.${log.source as "send" | "edit" | "delete" | "resend"}`,
                          )}
                        </div>
                      </td>
                      <td data-label={t("colMode")}>
                        {t(`mode.${log.mode as "normal" | "embed" | "both"}`)}
                      </td>
                      <td data-label={t("colLatency")}>
                        <span className="font-mono">
                          {log.latencyMs != null ? `${log.latencyMs}ms` : "—"}
                        </span>
                        {log.httpStatus != null && (
                          <span className="font-mono text-xs text-fg-tertiary">
                            {" "}
                            · HTTP {log.httpStatus}
                          </span>
                        )}
                      </td>
                      <td data-label={t("colTime")}>
                        <span className="font-mono text-xs">
                          {new Date(log.createdAt).toLocaleString(locale)}
                        </span>
                      </td>
                      <td data-label={t("colAction")}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="hv gap-1.5"
                        >
                          <span className="ia ia-nudge">
                            <ChevronRight size={14} />
                          </span>
                          {t("detail.title")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
                className="hv gap-1"
              >
                {tc("next")}{" "}
                <span className="ia ia-nudge">
                  <ChevronRight size={16} />
                </span>
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
                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)} className="hv">
                  <span className="ia ia-x90"><X size={18} /></span>
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
                    className="hv gap-1.5"
                    onClick={() => loadIntoEditor(selectedLog.payload)}
                  >
                    <Copy size={14} /> {t("detail.duplicate")}
                  </Button>
                  {selectedLog.status === "failed" && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="hv gap-1.5"
                      disabled={pending}
                      onClick={doResend}
                    >
                      <RefreshCw size={14} /> {t("detail.resend")}
                    </Button>
                  )}
                  {selectedLog.discordMessageId && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="hv gap-1.5"
                        onClick={() => loadIntoEditor(selectedLog.payload, selectedLog.id)}
                      >
                        <span className="ia ia-scribble"><Pencil size={14} /></span> {t("detail.editMessage")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="hv gap-1.5"
                        disabled={!selectedLog.discordMessageId || pending}
                        onClick={() => setConfirmDeleteOpen(true)}
                      >
                        <span className="ia ia-shake"><Trash2 size={14} /></span> {t("detail.deleteMessage")}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="hv gap-1.5"
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

function exportToCsv(logs: Array<{ webhookNameSnapshot: string; mode: string; status: string; httpStatus: number | null; latencyMs: number | null; error: string | null; createdAt: Date }>, headers: string[]): string {
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
