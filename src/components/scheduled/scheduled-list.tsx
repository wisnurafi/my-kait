"use client";

import { useCallback, useEffect, useState } from "react";
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
  type ScheduledFilter,
} from "@/server/actions/scheduled";
import { ScheduleDialog } from "@/components/editor/schedule-dialog";
import { CalendarClock, Ban, Inbox, ChevronLeft, ChevronRight } from "lucide-react";

type PageData = {
  items: ScheduledPublic[];
  total: number;
  page: number;
  totalPages: number;
  counts: Record<ScheduledFilter, number>;
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

const statusVariant: Record<string, "info" | "warning" | "success" | "error" | "default"> = {
  pending: "info",
  sending: "warning",
  sent: "success",
  failed: "error",
  cancelled: "default",
};

/** Minutes after scheduled_at a still-pending row is flagged overdue. */
const OVERDUE_MS = 10 * 60 * 1000;

/**
 * Dead-man's switch: if the external cron (cron-job.org) stops ticking,
 * pending rows pile up silently. Flag them so the user notices.
 */
function isOverdue(s: ScheduledPublic): boolean {
  if (s.status !== "pending") return false;
  const at = new Date(s.scheduledAt).getTime();
  return !Number.isNaN(at) && Date.now() - at > OVERDUE_MS;
}

export function ScheduledList() {
  const t = useTranslations("scheduled");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [data, setData] = useState<PageData | null>(null);
  const [filter, setFilter] = useState<ScheduledFilter>("upcoming");
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<ScheduledPublic | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<ScheduledPublic | null>(null);

  const load = useCallback(
    async (f: ScheduledFilter, p: number) => {
      try {
        const res = await listScheduledAction(f, p);
        setData(res);
        // If the current page went empty (e.g. last item cancelled), step back.
        if (res.items.length === 0 && res.page > 1) setPage(res.page - 1);
      } catch {
        toast.error(t("loadFailed"));
        setData({ items: [], total: 0, page: 1, totalPages: 1, counts: { upcoming: 0, history: 0, all: 0 } });
      }
    },
    [t],
  );

  useEffect(() => {
    load(filter, page);
  }, [filter, page, load]);

  const selectFilter = (f: ScheduledFilter) => {
    setFilter(f);
    setPage(1);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await cancelScheduledAction(cancelTarget.id);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success(t("cancelledOk"));
        await load(filter, page);
      }
    } catch {
      toast.error(t("cancelFailed"));
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  const filters: Array<[ScheduledFilter, string]> = [
    ["upcoming", t("filterUpcoming")],
    ["history", t("filterHistory")],
    ["all", t("filterAll")],
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap stagger-in" role="group" aria-label={t("title")}>
        {filters.map(([f, label]) => (
          <FilterChip key={f} active={filter === f} onClick={() => selectFilter(f)}>
            {label} <span className="opacity-60">{data?.counts[f] ?? 0}</span>
          </FilterChip>
        ))}
      </div>

      {data === null ? (
        <p className="text-sm text-fg-tertiary">{t("loading")}</p>
      ) : data.items.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-10 text-center">
            <Inbox size={28} className="text-fg-tertiary" />
            <p className="text-sm text-fg-secondary">
              {filter === "history" ? t("emptyHistory") : t("emptyUpcoming")}
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <ul className="space-y-2">
            {data.items.map((s, i) => (
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
                    {s.recurrence !== "none" && (
                      <Badge variant="default">
                        {t(`recurrence_${s.recurrence}`)}
                      </Badge>
                    )}
                    {isOverdue(s) && <Badge variant="warning">{t("overdue")}</Badge>}
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
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => setRescheduleTarget(s)}
                      className="gap-2 shrink-0"
                    >
                      <CalendarClock size={16} />
                      {t("rescheduleButton")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setCancelTarget(s)}
                      className="gap-2 shrink-0"
                    >
                      <Ban size={16} />
                      {t("cancelButton")}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(data.page - 1)}
                disabled={data.page <= 1}
                className="gap-1"
              >
                <ChevronLeft size={16} /> {tc("prev")}
              </Button>
              <span className="text-sm text-fg-secondary font-mono">
                {data.page} / {data.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(data.page + 1)}
                disabled={data.page >= data.totalPages}
                className="hv gap-1"
              >
                {tc("next")}{" "}
                <span className="ia ia-nudge">
                  <ChevronRight size={16} />
                </span>
              </Button>
            </div>
          )}
        </>
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

      {rescheduleTarget && (
        <ScheduleDialog
          mode="reschedule"
          open={!!rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          scheduleId={rescheduleTarget.id}
          initialScheduledAt={rescheduleTarget.scheduledAt}
          onRescheduled={() => load(filter, page)}
        />
      )}
    </div>
  );
}
