"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { scheduleMessageAction, rescheduleAction } from "@/server/actions/scheduled";
import type { ScheduledRecurrence } from "@/lib/schema";
import { CalendarClock } from "lucide-react";

export interface ScheduleRequest {
  webhookId: string;
  manualUrl: string;
  payload: unknown;
  mode: "normal" | "embed" | "both";
  customVars?: Record<string, string>;
}

function toLocalInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function ScheduleDialog({
  open,
  onClose,
  mode = "schedule",
  request,
  onScheduled,
  scheduleId,
  initialScheduledAt,
  onRescheduled,
}: {
  open: boolean;
  onClose: () => void;
  /** "schedule": create a new row · "reschedule": move an existing pending row */
  mode?: "schedule" | "reschedule";
  request?: ScheduleRequest; // schedule mode only
  onScheduled?: () => void; // schedule mode only
  scheduleId?: string; // reschedule mode only
  initialScheduledAt?: string; // reschedule mode only, ISO
  onRescheduled?: () => void; // reschedule mode only
}) {
  const t = useTranslations("scheduled");
  const [value, setValue] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 60 * 60_000)),
  );
  const [recurrence, setRecurrence] = useState<ScheduledRecurrence>("none");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const min = toLocalInputValue(new Date(Date.now() + 2 * 60_000));

  // Reset fields each time the dialog opens (reschedule pre-fills the row's time).
  useEffect(() => {
    if (!open) return;
    setValue(
      mode === "reschedule" && initialScheduledAt
        ? toLocalInputValue(new Date(initialScheduledAt))
        : toLocalInputValue(new Date(Date.now() + 60 * 60_000)),
    );
    setRecurrence("none");
    setError(null);
  }, [open, mode, initialScheduledAt]);

  const quickIn = (ms: number) =>
    setValue(toLocalInputValue(new Date(Date.now() + ms)));
  const tomorrow9 = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    setValue(toLocalInputValue(d));
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const at = new Date(value);
      if (Number.isNaN(at.getTime())) {
        setError(t("invalidDate"));
        return;
      }
      if (mode === "reschedule") {
        if (!scheduleId) {
          setError(t("rescheduleFailed"));
          return;
        }
        const res = await rescheduleAction(scheduleId, at.toISOString());
        if ("error" in res) {
          setError(res.error);
        } else {
          toast.success(t("rescheduledOk"));
          onRescheduled?.();
          onClose();
        }
        return;
      }
      if (!request) {
        setError(t("scheduleFailed"));
        return;
      }
      const res = await scheduleMessageAction({
        webhookId: request.webhookId || undefined,
        manualUrl: request.manualUrl || undefined,
        payload: request.payload,
        mode: request.mode,
        customVars: request.customVars,
        scheduledAt: at.toISOString(),
        recurrence,
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        toast.success(t("scheduledOk"));
        onScheduled?.();
        onClose();
      }
    } catch {
      setError(mode === "reschedule" ? t("rescheduleFailed") : t("scheduleFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        <span className="flex items-center gap-2">
          <CalendarClock size={18} />{" "}
          {mode === "reschedule" ? t("rescheduleTitle") : t("dialogTitle")}
        </span>
      </DialogTitle>
      <DialogBody>
        <div className="space-y-3">
          <div>
            <Label>{t("dateLabel")}</Label>
            <Input
              type="datetime-local"
              value={value}
              min={min}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => quickIn(60 * 60_000)}>
              {t("quick1h")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => quickIn(3 * 60 * 60_000)}>
              {t("quick3h")}
            </Button>
            <Button variant="secondary" size="sm" onClick={tomorrow9}>
              {t("quickTomorrow9")}
            </Button>
          </div>
          {mode === "schedule" && (
            <div>
              <Label>{t("recurrenceLabel")}</Label>
              <Select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as ScheduledRecurrence)}
                className="mt-1"
              >
                <option value="none">{t("recurrence_none")}</option>
                <option value="daily">{t("recurrence_daily")}</option>
                <option value="weekly">{t("recurrence_weekly")}</option>
                <option value="monthly">{t("recurrence_monthly")}</option>
              </Select>
              <p className="text-xs text-fg-secondary mt-1">{t("recurrenceHint")}</p>
            </div>
          )}
          <p className="text-xs text-fg-secondary">{t("granularityNote")}</p>
          {error && (
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          {t("cancel")}
        </Button>
        <Button onClick={handleConfirm} disabled={saving || !value}>
          {saving
            ? t("scheduling")
            : mode === "reschedule"
              ? t("rescheduleConfirm")
              : t("confirmButton")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
