"use client";

/**
 * Per-row moderation actions on the reports queue.
 * "Actioned" is two-step (click → confirm) because it also unpublishes
 * the template's share link.
 */

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  setReportStatus,
  actionReport,
} from "@/server/actions/admin";
import { Check, X, Gavel } from "lucide-react";

type SuccessKey = "toastDismissed" | "toastReviewed" | "toastActioned";

export function ReportActions({ reportId }: { reportId: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = (fn: () => Promise<unknown>, successKey: SuccessKey) =>
    startTransition(async () => {
      try {
        await fn();
        toast.success(t(successKey));
      } catch (err) {
        // Session expired mid-action → bounce to login instead of failing silently.
        if (err instanceof Error && err.message === "UNAUTHORIZED") {
          router.push("/admin/login");
          return;
        }
        toast.error(t("toastActionFailed"));
      } finally {
        setConfirming(false);
        router.refresh();
      }
    });

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-warning">{t("confirmAction")}</span>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => run(() => actionReport(reportId), "toastActioned")}
        >
          {t("confirmYes")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setConfirming(false)}
        >
          {t("cancel")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="ghost"
        title={t("dismiss")}
        aria-label={t("dismiss")}
        disabled={busy}
        onClick={() => run(() => setReportStatus(reportId, "dismissed"), "toastDismissed")}
        className="gap-1"
      >
        <X size={14} />
        <span className="hidden lg:inline">{t("dismiss")}</span>
      </Button>
      <Button
        size="sm"
        variant="secondary"
        title={t("markReviewed")}
        aria-label={t("markReviewed")}
        disabled={busy}
        onClick={() => run(() => setReportStatus(reportId, "reviewed"), "toastReviewed")}
        className="gap-1"
      >
        <Check size={14} />
        <span className="hidden lg:inline">{t("markReviewed")}</span>
      </Button>
      <Button
        size="sm"
        variant="destructive"
        title={t("actionAndUnshare")}
        aria-label={t("actionAndUnshare")}
        disabled={busy}
        onClick={() => setConfirming(true)}
        className="gap-1"
      >
        <Gavel size={14} />
        <span className="hidden lg:inline">{t("actionAndUnshare")}</span>
      </Button>
    </div>
  );
}
