"use client";

import { useState } from "react";
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
import { toast } from "@/components/ui/toast";
import { scheduleMessageAction } from "@/server/actions/scheduled";
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
  request,
  onScheduled,
}: {
  open: boolean;
  onClose: () => void;
  request: ScheduleRequest;
  onScheduled: () => void;
}) {
  const t = useTranslations("scheduled");
  const [value, setValue] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 60 * 60_000)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const min = toLocalInputValue(new Date(Date.now() + 2 * 60_000));

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
      const res = await scheduleMessageAction({
        webhookId: request.webhookId || undefined,
        manualUrl: request.manualUrl || undefined,
        payload: request.payload,
        mode: request.mode,
        customVars: request.customVars,
        scheduledAt: at.toISOString(),
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        toast.success(t("scheduledOk"));
        onScheduled();
        onClose();
      }
    } catch {
      setError(t("scheduleFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        <span className="flex items-center gap-2">
          <CalendarClock size={18} /> {t("dialogTitle")}
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
          {saving ? t("scheduling") : t("confirmButton")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
