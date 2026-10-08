"use client";

/**
 * Per-row moderation actions on the reports queue.
 * Dismiss / Reviewed are one-click; "Actioned" (also unpublishes the
 * template's share link) asks for confirmation via the shared
 * ConfirmDialog — the same pattern as the user dashboard.
 */

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
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
  const [confirmOpen, setConfirmOpen] = useState(false);

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
        setConfirmOpen(false);
        router.refresh();
      }
    });

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        aria-label={t("dismiss")}
        disabled={busy}
        onClick={() => run(() => setReportStatus(reportId, "dismissed"), "toastDismissed")}
        className="hv gap-1"
      >
        <span className="ia ia-x90" aria-hidden="true">
          <X size={14} />
        </span>
        <span>{t("dismiss")}</span>
      </Button>
      <Button
        size="sm"
        variant="secondary"
        aria-label={t("markReviewed")}
        disabled={busy}
        onClick={() => run(() => setReportStatus(reportId, "reviewed"), "toastReviewed")}
        className="hv gap-1"
      >
        <span className="ia ia-checkpop" aria-hidden="true">
          <Check size={14} />
        </span>
        <span>{t("markReviewed")}</span>
      </Button>
      <Button
        size="sm"
        variant="destructive"
        aria-label={t("actionAndUnshare")}
        disabled={busy}
        onClick={() => setConfirmOpen(true)}
        className="hv gap-1"
      >
        <span className="ia ia-shake" aria-hidden="true">
          <Gavel size={14} />
        </span>
        <span>{t("actionAndUnshare")}</span>
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => run(() => actionReport(reportId), "toastActioned")}
        loading={busy}
        title={t("actionAndUnshare")}
        message={t("confirmAction")}
        confirmLabel={t("confirmYes")}
      />
    </>
  );
}
