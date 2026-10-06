"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, FilterChip } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  listScheduledAction,
  cancelScheduledAction,
  type ScheduledPublic,
} from "@/server/actions/scheduled";
import { CalendarClock, Ban, Inbox } from "lucide-react";

type Filter = "upcoming" | "history" | "all";

const statusVariant: Record<string, "info" | "warning" | "success" | "error" | "default"> = {
  pending: "info",
  sending: "warning",
  sent: "success",
  failed: "error",
  cancelled: "default",
};

function staggerStyle(i: number) {
  return { "--stagger-index": i } as React.CSSProperties;
}

function formatAbsolute(iso: string, locale: string): string {
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

/** Locale-aware relative time: "in 25 minutes", "2 hours ago". */
function formatRelative(iso: string, locale: string): string {
  try {
    const diffMs = new Date(iso).getTime() - Date.now();
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const abs = Math.abs(diffMs);
    const minute = 60_000;
    const hour = 3_600_000;
    const day = 86_400_000;
    if (abs < minute) return rtf.format(Math.round(diffMs / 1000), "second");
    if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
    if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
    return rtf.format(Math.round(diffMs / day), "day");
  } catch {
    return iso;
  }
}

export function ScheduledList() {
  const t = useTranslations("scheduled");
  const locale = useLocale();
  const [items, setItems] = useState<ScheduledPublic[] | null>(null);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [cancelTarget, setCancelTarget] = useState<ScheduledPublic | null>(null);
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

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await cancelScheduledAction(cancelTarget.id);
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
      setCancelTarget(null);
    }
  };

  const counts = {
    upcoming: 0,
    history: 0,
    all: (items ?? []).length,
  };
  for (const s of items ?? []) {
    if (s.status === "pending" || s.status === "sending") counts.upcoming++;
    else counts.history++;
  }

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
      <div className="flex gap-2 flex-wrap stagger-in" role="group" aria-label={t("title")}>
        {filters.map(([f, label]) => (
          <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {label} <span className="opacity-60">{counts[f]}</span>
          </FilterChip>
        ))}
      </div>

      {items === null ? (
        <p className="text-sm text-fg-tertiary">{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-10 text-center">
            <Inbox size={28} className="text-fg-tertiary" />
            <p className="text-sm text-fg-secondary">
              {filter === "history" ? t("emptyHistory") : t("emptyUpcoming")}
            </p>
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s, i) => (
            <li
              key={s.id}
              className="panel p-4 flex items-center gap-3 stagger-in"
              style={staggerStyle(i)}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <CalendarClock size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold truncate">{s.webhookNameSnapshot}</span>
                  <Badge
                    variant={statusVariant[s.status] ?? "default"}
                    pulse={s.status === "sending"}
                  >
                    {t(`status_${s.status}`)}
                  </Badge>
                </div>
                {s.preview && (
                  <p className="text-sm text-fg-secondary truncate mt-0.5">
                    {s.preview}
                  </p>
                )}
                <div className="text-xs text-fg-tertiary mt-1 flex items-center gap-2 flex-wrap">
                  <span title={formatAbsolute(s.scheduledAt, locale)}>
                    {formatRelative(s.scheduledAt, locale)}
                  </span>
                  <span className="font-mono">{s.mode}</span>
                  {s.lastError && (
                    <span className="text-error truncate">· {s.lastError}</span>
                  )}
                </div>
              </div>
              {s.status === "pending" && (
                <Button
                  variant="ghost"
                  onClick={() => setCancelTarget(s)}
                  className="gap-2 shrink-0"
                >
                  <Ban size={16} />
                  {t("cancelButton")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {cancelTarget && (
        <ConfirmDialog
          open={!!cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancel}
          title={t("cancelTitle")}
          message={t("cancelMessage", { name: cancelTarget.webhookNameSnapshot })}
          confirmLabel={t("cancelConfirmLabel")}
          loading={cancelling}
        />
      )}
    </div>
  );
}
