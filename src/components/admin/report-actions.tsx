"use client";

/**
 * Per-row moderation actions on the reports queue.
 * Dismiss / Reviewed are one-click; "Actioned" is a two-step inline
 * confirm (it also unpublishes the template's share link) via the shared
 * ConfirmButton — the single destructive-confirm pattern for admin.
 */

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/admin/confirm-button";
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
        router.refresh();
      }
    });

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
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
      {/* .hv wrapper so the shared ConfirmButton keeps its hover icon
          contract without touching the component. */}
      <span className="hv inline-flex">
        <ConfirmButton
          action={() => actionReport(reportId)}
          variant="destructive"
          ariaLabel={t("actionAndUnshare")}
          label={
            <>
              <Gavel size={14} />
              <span>{t("actionAndUnshare")}</span>
            </>
          }
          confirmLabel={t("confirmYes")}
          confirmHint={t("confirmAction")}
          successMessage={t("toastActioned")}
        />
      </span>
    </div>
  );
}
