"use client";

import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useFormatter } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
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
import { Search, Zap, Trash2, Send, RefreshCw, Pencil, Webhook, Folder } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

type WebhookStatus = "active" | "invalid" | "rate_limited" | "unchecked";

const statusConfig: Record<WebhookStatus, { variant: "active" | "danger" | "warning" | "default"; pulse: boolean }> = {
  active: { variant: "active", pulse: true },
  invalid: { variant: "danger", pulse: false },
  rate_limited: { variant: "warning", pulse: false },
  unchecked: { variant: "default", pulse: false },
};

type ConfirmTarget = { kind: "delete" | "test"; id: string } | null;

export function WebhooksList({
  webhooks: initialWebhooks,
  folders,
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
}) {
  const t = useTranslations("webhooks");
  const tc = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);

  const filteredWebhooks = statusFilter
    ? initialWebhooks.filter((w) => w.lastStatus === statusFilter)
    : initialWebhooks;

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
  }

  // Debounce search — preserve other params (e.g. folder), reset page.
  // statusFilter is client-side only and is never reset by search.
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get("search") ?? "";
      if (search !== current) {
        const params = new URLSearchParams(searchParams.toString());
        if (search) params.set("search", search);
        else params.delete("search");
        params.delete("page");
        router.push(`?${params.toString()}`);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

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

  const searchActive = Boolean(searchParams.get("search") ?? search);

  // Truly empty: no webhooks at all and no active search/filter.
  // (When a search/filter yields nothing, the toolbar stays visible below
  // so the user can adjust or clear the keyword.)
  if (initialWebhooks.length === 0 && !searchActive && !statusFilter) {
    return (
      <Card className="p-12 text-center animate-fade-in">
        <div className="mx-auto mb-4 w-12 h-12 rounded-lg bg-accent-soft border border-accent/40 flex items-center justify-center">
          <Webhook size={22} className="text-accent" />
        </div>
        <p className="text-fg-secondary text-lg">{t("noWebhooks")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" size={16} />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={handleSearch}
            className="pl-9 font-mono"
          />
        </div>
        <Button variant="secondary" size="md" onClick={handlePingAll} disabled={pending} className="gap-2">
          <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
          {t("pingAll")}
        </Button>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto"
        >
          <option value="">{t("allStatuses")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="invalid">{t("status.invalid")}</option>
          <option value="unchecked">{t("status.unchecked")}</option>
        </Select>
      </div>

      {filteredWebhooks.length === 0 ? (
        <Card className="p-12 text-center animate-fade-in">
          <div className="mx-auto mb-4 w-12 h-12 rounded-lg bg-accent-soft border border-accent/40 flex items-center justify-center">
            <Search size={22} className="text-accent" />
          </div>
          <p className="text-fg-secondary text-lg">{tc("noResults")}</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredWebhooks.map((wh, i) => {
          const sc = statusConfig[wh.lastStatus];
          const isExpanded = expandedId === wh.id;
          return (
            <div
              key={wh.id}
              className="stagger-in"
              style={{ "--stagger-index": i } as React.CSSProperties}
            >
            <Card
              className="p-5 h-full hover:border-border-strong transition-colors"
              hover
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {editingId === wh.id ? (
                      <EditWebhookForm
                        webhookId={wh.id}
                        currentName={wh.name}
                        onDone={() => setEditingId(null)}
                      />
                    ) : (
                      <h3 className="font-display text-lg font-bold uppercase tracking-[0.05em]">{wh.name}</h3>
                    )}
                    <Badge variant={sc.variant} pulse={sc.pulse} dot={!sc.pulse}>
                      {t(`status.${wh.lastStatus}`)}
                    </Badge>
                    {wh.folderId && (
                      <Badge variant="default" className="gap-1">
                        <Folder size={11} />
                        {folders.find((f) => f.id === wh.folderId)?.name}
                      </Badge>
                    )}
                  </div>
                  {wh.guildName && wh.channelName && (
                    <p className="text-sm text-fg-secondary mt-1">
                      #{wh.channelName} · {wh.guildName}
                    </p>
                  )}
                  {folders.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
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
                  {wh.discordWebhookId && (
                    <p className="text-xs text-fg-tertiary mt-1 font-mono">
                      {wh.discordWebhookId}
                    </p>
                  )}
                  {wh.lastCheckedAt && (
                    <p className="text-xs text-fg-tertiary mt-1 font-mono">
                      {t("lastChecked")}: {format.dateTime(wh.lastCheckedAt, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePing(wh.id)}
                    disabled={pending}
                    className="gap-1.5"
                  >
                    <Zap size={14} />
                    {t("ping")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTestSend(wh.id)}
                    disabled={pending}
                    className="gap-1.5"
                  >
                    <Send size={14} />
                    {t("sendTest")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(isExpanded ? null : wh.id)}
                    className="gap-1.5"
                  >
                    {isExpanded ? t("collapse") : t("expand")}
                  </Button>
                  <Tooltip content={t("editWebhook")}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(editingId === wh.id ? null : wh.id)}
                      className="gap-1.5"
                    >
                      <Pencil size={14} />
                    </Button>
                  </Tooltip>
                  <Tooltip content={t("deleteWebhook")}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(wh.id)}
                      disabled={pending}
                      className="text-error"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </Tooltip>
                </div>
              </div>
              {isExpanded && <PingHistory webhookId={wh.id} />}
            </Card>
            </div>
          );
          })}
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
