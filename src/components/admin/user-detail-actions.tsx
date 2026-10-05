"use client";

/**
 * User detail actions: suspend/unsuspend + delete template.
 * Both are two-step confirms via ConfirmButton — the single
 * destructive-confirm pattern for admin.
 */

import { useTranslations } from "next-intl";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { setUserSuspended, deleteTemplate } from "@/server/actions/admin";
import { Ban, Undo2, Trash2 } from "lucide-react";

export function SuspendUserButton({
  userId,
  isSuspended,
  username,
}: {
  userId: string;
  isSuspended: boolean;
  username: string;
}) {
  const t = useTranslations("admin");
  return (
    <span className="hv inline-flex">
      <ConfirmButton
        action={() => setUserSuspended(userId, !isSuspended)}
        variant={isSuspended ? "primary" : "destructive"}
        confirmVariant={isSuspended ? "primary" : "destructive"}
        label={
          <>
            {isSuspended ? <Undo2 size={14} /> : <Ban size={14} />}
            {isSuspended ? t("unsuspend") : t("suspend")}
          </>
        }
        confirmLabel={isSuspended ? t("unsuspend") : t("suspend")}
        confirmHint={
          isSuspended
            ? t("unsuspendHint", { username })
            : t("suspendHint", { username })
        }
        successMessage={t(isSuspended ? "toastUnsuspended" : "toastSuspended")}
      />
    </span>
  );
}

export function DeleteTemplateButton({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  const t = useTranslations("admin");
  return (
    <span className="hv inline-flex">
      <ConfirmButton
        action={() => deleteTemplate(templateId)}
        variant="ghost"
        ariaLabel={t("deleteTemplate")}
        label={
          <>
            <span className="ia ia-shake" aria-hidden="true">
              <Trash2 size={14} />
            </span>
            <span>{t("deleteTemplate")}</span>
          </>
        }
        confirmLabel={t("deleteTemplate")}
        confirmHint={t("deleteTemplateHint", { name: templateName })}
        successMessage={t("toastTemplateDeleted")}
      />
    </span>
  );
}
