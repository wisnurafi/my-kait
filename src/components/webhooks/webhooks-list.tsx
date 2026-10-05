"use client";

import { useState, useEffect, useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import {
  pingWebhookAction,
  deleteWebhookAction,
  sendTestMessageAction,
  pingAllWebhooksAction,
  moveWebhookToFolderAction,
} from "@/server/actions/webhooks";
import { PingHistory } from "@/components/webhooks/ping-history";
import { EditWebhookForm } from "@/components/webhooks/edit-webhook-form";
import {
  Search,
  Zap,
  Trash2,
  Send,
  RefreshCw,
  Pencil,
  Link as LinkIcon,
  Folder,
  Eye,
  X,
  Plus,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

type WebhookStatus = "active" | "invalid" | "rate_limited" | "unchecked";

const statusConfig: Record<WebhookStatus, { variant: "active" | "danger" | "warning" | "default"; pulse: boolean }> = {
  active: { variant: "active", pulse: true },
  invalid: { variant: "danger", pulse: false },
  rate_limited: { variant: "warning", pulse: false },
  unchecked: { variant: "default", pulse: false },
};

const PAGE_SIZE = 12;

type ConfirmTarget = { kind: "delete" | "test"; id: string } | null;

export function WebhooksList({
  webhooks: initialWebhooks,
  folders,
  statusFilter,
}: {
  webhooks: Array<{
    id: string;
    name: string;
    folderId: string | null;
    discordWebhookId: string | null;
    lastStatus: WebhookStatus;
    lastCheckedAt: Date | null;
    lastUsedAt: Date | null;
    channelName: string | null;
    guildName: string | null;
    createdAt: Date;
  }>;
  folders: Array<{ id: string; name: string }>;
  /** Status filter, URL-driven (source of truth lives in ?status=). */
  statusFilter: string;
}) {
  const t = useTranslations("webhooks");
  const tc = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);

  const detailWebhook = detailId
    ? (initialWebhooks.find((w) => w.id === detailId) ?? null)
    : null;

  // Lock body scroll + close on Escape while the detail drawer is open
  // (same pattern as the logs detail drawer).
  useEffect(() => {
    if (!detailWebhook) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [detailWebhook]);

  const searchParam = searchParams.get("search") ?? "";
  const folderParam = searchParams.get("folder") ?? "all";

  // Reset client-side load-more whenever the result set changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [statusFilter, searchParam, folderParam]);

  const filteredWebhooks = statusFilter
    ? initialWebhooks.filter((w) => w.lastStatus === statusFilter)
    : initialWebhooks;
  const visibleWebhooks = filteredWebhooks.slice(0, visibleCount);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
  }

  // Debounce search — preserve other params (e.g. folder, status).
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get("search") ?? "";
      if (search !== current) {
        const params = new URLSearchParams(searchParams.toString());
        if (search) params.set("search", search);
        else params.delete("search");
        router.push(`?${params.toString()}`, { scroll: false });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  function updateStatus(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("status", value);
    else params.delete("status");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  function resetFilters() {
    setSearch("");
    setVisibleCount(PAGE_SIZE);
    router.push("?", { scroll: false });
  }

  function scrollToAdd() {
    const form = document.getElementById("add-webhook-form");
    if (!form) return;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    const input = form.querySelector("input");
    if (input) window.setTimeout(() => input.focus({ preventScroll: true }), 450);
  }

  function handlePing(webhookId: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("webhookId", webhookId);
      const res = await pingWebhookAction(formData);
      if (res?.error) toast.error(res.error);
      else toast.success(t("pingOk"));
    });
  }

  function handleDelete(webhookId: string) {
    setConfirmTarget({ kind: "delete", id: webhookId });
  }

  function handleTestSend(webhookId: string) {
    setConfirmTarget({ kind: "test", id: webhookId });
  }

  function handleConfirm() {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("webhookId", target.id);
      if (target.kind === "delete") {
        await deleteWebhookAction(formData);
        toast.success(t("deleted"));
      } else {
        const result = await sendTestMessageAction(formData);
        if (result.error) toast.error(result.error);
        else toast.success(t("testSent"));
      }
    });
  }

  function handlePingAll() {
    startTransition(async () => {
      try {
        await pingAllWebhooksAction();
        toast.success(t("pingAllDone"));
      } catch {
        toast.error(t("pingFailed"));
      }
    });
  }

  function handleMoveFolder(webhookId: string, folderId: string | null) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("webhookId", webhookId);
      formData.set("folderId", folderId ?? "");
      const res = await moveWebhookToFolderAction(formData);
      if (res?.error) toast.error(res.error);
      else toast.success(t("movedToFolder"));
    });
  }

  const searchActive = Boolean(searchParam || search);
  const hasActiveFilter = searchActive || statusFilter !== "" || folderParam !== "all";

  // Truly empty: no webhooks at all and no active search/filter/folder.
  if (initialWebhooks.length === 0 && !hasActiveFilter) {
    return (
      <EmptyState
        icon={<LinkIcon />}
        title={t("noWebhooks")}
        description={t("noWebhooksHint")}
        action={
          <Button variant="primary" onClick={scrollToAdd} className="hv gap-2">
            <Plus size={16} className="ia-plus" />
            {t("add")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="hv relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" aria-hidden="true">
            <Search size={16} className="ia-search" />
          </span>
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={handleSearch}
            className="pl-9 font-mono"
          />
        </div>
        <Button variant="secondary" size="md" onClick={handlePingAll} disabled={pending} className="hv gap-2">
          <RefreshCw size={16} className={pending ? "animate-spin" : "ia-refresh"} />
          {t("pingAll")}
        </Button>
        <Select
          value={statusFilter}
          onChange={(e) => updateStatus(e.target.value)}
          className="w-auto"
          aria-label={t("allStatuses")}
        >
          <option value="">{t("allStatuses")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="invalid">{t("status.invalid")}</option>
          <option value="rate_limited">{t("status.rate_limited")}</option>
          <option value="unchecked">{t("status.unchecked")}</option>
        </Select>
      </div>

      {filteredWebhooks.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title={tc("noResults")}
          description={t("noResultsHint")}
          action={
            <Button variant="secondary" onClick={resetFilters} className="hv gap-2">
              <X size={14} className="ia-x" />
              {tc("reset")}
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleWebhooks.map((wh, i) => {
              const sc = statusConfig[wh.lastStatus];
              // The folder may have been deleted (stale folderId) — only show
              // the badge when the folder still exists, never an empty badge.
              const folderName = wh.folderId
                ? folders.find((f) => f.id === wh.folderId)?.name
                : undefined;
              return (
                <div
                  key={wh.id}
                  className="stagger-in"
                  style={{ "--stagger-index": i } as React.CSSProperties}
                >
                  <Card className="p-5 h-full">
                    {/* Card header: icon box + name + badges */}
                    <div className="flex items-center gap-3">
                      <div
                        className="hv w-10 h-10 rounded-lg bg-accent-soft border border-accent/40 flex items-center justify-center shrink-0"
                        aria-hidden="true"
                      >
                        <LinkIcon size={18} className="ia-link text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingId === wh.id ? (
                          <EditWebhookForm
                            webhookId={wh.id}
                            currentName={wh.name}
                            onDone={() => setEditingId(null)}
                          />
                        ) : (
                          <h3 className="font-display text-lg font-bold uppercase tracking-[0.05em] truncate">
                            {wh.name}
                          </h3>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        <Badge variant={sc.variant} pulse={sc.pulse} dot={!sc.pulse}>
                          {t(`status.${wh.lastStatus}`)}
                        </Badge>
                        {folderName && (
                          <Badge variant="default" className="gap-1">
                            <Folder size={11} />
                            {folderName}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Meta block */}
                    <div className="font-mono text-xs text-fg-tertiary mt-2.5 space-y-1">
                      {wh.guildName && wh.channelName && (
                        <p className="truncate">
                          #{wh.channelName} · {wh.guildName}
                        </p>
                      )}
                      {wh.discordWebhookId && (
                        <p className="truncate">{wh.discordWebhookId}</p>
                      )}
                      {wh.lastCheckedAt && (
                        <p>
                          {t("lastChecked")}:{" "}
                          {format.dateTime(wh.lastCheckedAt, { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      )}
                    </div>
                    {folders.length > 0 && (
                      <div className="flex items-center gap-2 mt-2.5">
                        <Folder size={13} className="text-fg-secondary shrink-0" aria-hidden="true" />
                        <Select
                          value={wh.folderId ?? ""}
                          onChange={(e) => handleMoveFolder(wh.id, e.target.value || null)}
                          disabled={pending}
                          className="h-9 px-3 py-1 text-sm max-w-[220px]"
                          aria-label={t("folder")}
                        >
                          <option value="">{t("noFolder")}</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                    {/* Action row: icon-buttons */}
                    <div className="flex gap-1 mt-3 pt-3 border-t border-border-ink flex-wrap">
                      <Tooltip content={t("detailTitle")}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetailId(wh.id)}
                          className="hv"
                        >
                          <Eye size={16} />
                        </Button>
                      </Tooltip>
                      <Tooltip content={t("ping")}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePing(wh.id)}
                          disabled={pending}
                          className="hv"
                        >
                          <Zap size={16} />
                        </Button>
                      </Tooltip>
                      <Tooltip content={t("sendTest")}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTestSend(wh.id)}
                          disabled={pending}
                          className="hv"
                        >
                          <Send size={16} />
                        </Button>
                      </Tooltip>
                      <Tooltip content={t("editWebhook")}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingId(editingId === wh.id ? null : wh.id)}
                          className="hv"
                        >
                          <Pencil size={16} className="ia-pencil" />
                        </Button>
                      </Tooltip>
                      <Tooltip content={t("deleteWebhook")}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(wh.id)}
                          disabled={pending}
                          className="hv text-error"
                        >
                          <Trash2 size={16} className="ia-trash" />
                        </Button>
                      </Tooltip>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Client-side load-more: 12 at a time, no server changes */}
          {filteredWebhooks.length > visibleCount && (
            <div className="flex flex-col items-center gap-2.5 pt-2">
              <p className="font-mono text-xs text-fg-tertiary">
                {t("showingCount", { shown: visibleWebhooks.length, total: filteredWebhooks.length })}
              </p>
              <Button
                variant="secondary"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="hv gap-2"
              >
                <Plus size={16} className="ia-plus" />
                {t("loadMore")} ({filteredWebhooks.length - visibleCount})
              </Button>
            </div>
          )}
        </>
      )}

      {/* Detail drawer — the single detail pattern (ping history lives here) */}
      {detailWebhook && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setDetailId(null)}
            aria-hidden
          />
          <div
            className="relative w-full max-w-lg h-full panel overflow-y-auto p-6"
            style={{ borderLeft: "1px solid var(--border)", borderRadius: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={t("detailTitle")}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold uppercase">{t("detailTitle")}</h2>
              <Tooltip content={tc("close")} position="bottom">
                <Button variant="ghost" size="icon" onClick={() => setDetailId(null)} className="hv">
                  <X size={18} className="ia-x" />
                </Button>
              </Tooltip>
            </div>

            <div className="space-y-5">
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center gap-3">
                  <span className="text-fg-secondary">{t("addName")}</span>
                  <span className="font-semibold truncate">{detailWebhook.name}</span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <span className="text-fg-secondary">{t("status")}</span>
                  <Badge
                    variant={statusConfig[detailWebhook.lastStatus].variant}
                    pulse={statusConfig[detailWebhook.lastStatus].pulse}
                    dot={!statusConfig[detailWebhook.lastStatus].pulse}
                  >
                    {t(`status.${detailWebhook.lastStatus}`)}
                  </Badge>
                </div>
                {detailWebhook.guildName && detailWebhook.channelName && (
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-fg-secondary">Discord</span>
                    <span className="font-mono text-xs text-fg-tertiary truncate">
                      #{detailWebhook.channelName} · {detailWebhook.guildName}
                    </span>
                  </div>
                )}
                {detailWebhook.discordWebhookId && (
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-fg-secondary">ID</span>
                    <span className="font-mono text-xs text-fg-tertiary truncate">
                      {detailWebhook.discordWebhookId}
                    </span>
                  </div>
                )}
                {detailWebhook.lastCheckedAt && (
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-fg-secondary">{t("lastChecked")}</span>
                    <span className="font-mono text-xs text-fg-tertiary">
                      {format.dateTime(detailWebhook.lastCheckedAt, { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                )}
                {detailWebhook.lastUsedAt && (
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-fg-secondary">{t("lastUsed")}</span>
                    <span className="font-mono text-xs text-fg-tertiary">
                      {format.dateTime(detailWebhook.lastUsedAt, { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                )}
              </div>

              <PingHistory webhookId={detailWebhook.id} />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirm}
        title={confirmTarget?.kind === "test" ? t("testTitle") : t("deleteTitle")}
        message={confirmTarget?.kind === "test" ? t("testConfirm") : t("confirmDelete")}
        confirmLabel={confirmTarget?.kind === "test" ? t("sendTest") : t("confirmAction")}
        danger={confirmTarget?.kind !== "test"}
        loading={pending}
      />
    </div>
  );
}
