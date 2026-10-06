"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import {
  listScheduledAction,
  cancelScheduledAction,
  type ScheduledPublic,
} from "@/server/actions/scheduled";
import { CalendarClock, Ban, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type Filter = "upcoming" | "history" | "all";

const statusVariant: Record<string, "info" | "warning" | "success" | "error" | "default"> = {
  pending: "info",
  sending: "warning",
  sent: "success",
  failed: "error",
  cancelled: "default",
};

function formatDateTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ScheduledList() {
  const t = useTranslations("scheduled");
  const locale = useLocale();
  const [items, setItems] = useState<ScheduledPublic[] | null>(null);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    try {
      setItems(await listScheduledAction());
    } catch {
      toast.error(t("loadFailed"));
      setItems([]);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setCancelling(true);
    try {
      const res = await cancelScheduledAction(id);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success(t("cancelledOk"));
        await load();
      }
    } catch {
      toast.error(t("cancelFailed"));
    } finally {
      setCancelling(false);
      setConfirmId(null);
    }
  };

  const filtered = (items ?? []).filter((s) => {
    if (filter === "upcoming") return s.status === "pending" || s.status === "sending";
    if (filter === "history")
      return s.status === "sent" || s.status === "failed" || s.status === "cancelled";
    return true;
  });

  const filters: Array<[Filter, string]> = [
    ["upcoming", t("filterUpcoming")],
    ["history", t("filterHistory")],
    ["all", t("filterAll")],
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {filters.map(([f, label]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-[0.12em] border transition-colors",
              filter === f
                ? "bg-accent-soft text-accent border-accent/30"
                : "text-fg-secondary border-border-ink hover:text-fg hover:border-border-strong",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {items === null ? (
        <p className="text-sm text-fg-tertiary">{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-10 text-center">
            <Inbox size={28} className="text-fg-tertiary" />
            <p className="text-sm text-fg-secondary">{t("empty")}</p>
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => (
            <li key={s.id} className="panel p-3 flex items-center gap-3 flex-wrap">
              <CalendarClock size={18} className="text-fg-tertiary shrink-0" />
              <div className="flex-1 min-w-[180px]">
                <div className="font-bold flex items-center gap-2 flex-wrap">
                  {s.webhookNameSnapshot}
                  <Badge variant={statusVariant[s.status] ?? "default"}>
                    {t(`status_${s.status}`)}
                  </Badge>
                  <span className="font-mono text-xs text-fg-tertiary">{s.mode}</span>
                </div>
                <div className="text-xs text-fg-tertiary mt-1">
                  {formatDateTime(s.scheduledAt, locale)}
                  {s.lastError && (
                    <span className="text-error"> · {s.lastError}</span>
                  )}
                </div>
              </div>
              {s.status === "pending" && (
                <Button
                  variant={confirmId === s.id ? "destructive" : "ghost"}
                  onClick={() => handleCancel(s.id)}
                  disabled={cancelling}
                  className="gap-2"
                >
                  <Ban size={16} />
                  {confirmId === s.id ? t("cancelConfirmButton") : t("cancelButton")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirmId && (
        <p className="text-sm text-error" role="alert">
          {t("cancelConfirm")}
        </p>
      )}
    </div>
  );
}
