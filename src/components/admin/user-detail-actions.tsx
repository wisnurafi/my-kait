"use client";

/**
 * User detail actions: suspend/unsuspend + delete template +
 * cancel scheduled message + revoke API key.
 * Suspend/delete use the two-step ConfirmButton; the scheduled/key
 * actions use ConfirmDialog directly so server-returned errors can be
 * shown precisely instead of a generic failure toast.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  setUserSuspended,
  deleteTemplate,
  adminCancelScheduledAction,
  adminRevokeApiKeyAction,
} from "@/server/actions/admin";
import { Ban, Undo2, Trash2, KeyRound } from "lucide-react";

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

export function CancelScheduledButton({
  scheduledId,
  webhookName,
}: {
  scheduledId: string;
  webhookName: string;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await adminCancelScheduledAction(scheduledId);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success(t("toastSchedCancelled"));
        router.refresh();
      }
    } catch {
      toast.error(t("toastActionFailed"));
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t("schedCancelTitle")}
        className="hv gap-1.5 text-fg-tertiary hover:text-error shrink-0"
      >
        <Ban size={14} />
        <span>{t("schedCancel")}</span>
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        loading={busy}
        title={t("schedCancelTitle")}
        message={t("schedCancelHint", { name: webhookName })}
        confirmLabel={t("schedCancel")}
      />
    </>
  );
}

export function RevokeApiKeyButton({
  keyId,
  keyName,
}: {
  keyId: string;
  keyName: string;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await adminRevokeApiKeyAction(keyId);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success(t("toastKeyRevoked"));
        router.refresh();
      }
    } catch {
      toast.error(t("toastActionFailed"));
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t("keyRevokeTitle")}
        className="hv gap-1.5 text-fg-tertiary hover:text-error shrink-0"
      >
        <KeyRound size={14} />
        <span>{t("keyRevoke")}</span>
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        loading={busy}
        title={t("keyRevokeTitle")}
        message={t("keyRevokeHint", { name: keyName })}
        confirmLabel={t("keyRevoke")}
      />
    </>
  );
}
