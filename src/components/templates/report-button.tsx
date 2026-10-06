"use client";

/**
 * Report button for public template pages (/t/[slug]).
 * Opens a modal with a reason form; submits via reportTemplateAction.
 * Open to everyone — reporter id is attached when logged in.
 */

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { reportTemplateAction } from "@/server/actions/templates";
import { Flag } from "lucide-react";

type ReportState = { error?: string; success?: boolean };

const initialState: ReportState = {};

export function ReportButton({ templateId }: { templateId: string }) {
  const t = useTranslations("templates");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_prev: ReportState, formData: FormData): Promise<ReportState> =>
      reportTemplateAction(_prev, formData),
    initialState,
  );

  if (state.success) {
    return (
      <p className="text-xs text-fg-secondary" role="status">
        {t("reportSuccess")}
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-error hover:underline inline-flex items-center gap-1 cursor-pointer"
      >
        <Flag size={12} /> {t("report")}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{t("report")}</DialogTitle>
        <DialogBody>
          <form id="report-form" action={formAction} className="space-y-3">
            <input type="hidden" name="templateId" value={templateId} />
            <div>
              <Label htmlFor="report-reason">{t("reportReason")}</Label>
              <Textarea
                id="report-reason"
                name="reason"
                rows={3}
                maxLength={1000}
                placeholder={t("reportReasonPlaceholder")}
                required
                minLength={10}
                className="mt-1"
              />
            </div>
            {state.error && (
              <p className="text-xs text-error" role="alert">
                {state.error}
              </p>
            )}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            {t("reportCancel")}
          </Button>
          <Button
            type="submit"
            form="report-form"
            size="sm"
            variant="destructive"
            disabled={pending}
          >
            {pending ? t("reportSending") : t("reportSubmit")}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
