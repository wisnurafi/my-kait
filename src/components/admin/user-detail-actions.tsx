"use client";

/**
 * User detail actions: suspend/unsuspend + delete template +
 * cancel scheduled message + revoke API key.
 * All destructive confirms use the shared ConfirmDialog (same pattern as
 * the user dashboard) — centered modal with title, message, confirm/cancel
 * and loading state.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
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

/** Bounce to login when the admin session expired mid-action. */
function useAdminActionError() {
  const t = useTranslations("admin");
  const router = useRouter();
  return (err: unknown) => {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      router.push("/admin/login");
      return;
    }
    toast.error(t("toastActionFailed"));
  };
}

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
  const router = useRouter();
  const handleError = useAdminActionError();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await setUserSuspended(userId, !isSuspended);
      toast.success(t(isSuspended ? "toastUnsuspended" : "toastSuspended"));
      router.refresh();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant={isSuspended ? "primary" : "destructive"}
        onClick={() => setOpen(true)}
        className="hv gap-1.5"
      >
        {isSuspended ? <Undo2 size={14} /> : <Ban size={14} />}
        {isSuspended ? t("unsuspend") : t("suspend")}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        loading={busy}
        danger={!isSuspended}
        title={isSuspended ? t("unsuspend") : t("suspend")}
        message={
          isSuspended
            ? t("unsuspendHint", { username })
            : t("suspendHint", { username })
        }
        confirmLabel={isSuspended ? t("unsuspend") : t("suspend")}
      />
    </>
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
  const router = useRouter();
  const handleError = useAdminActionError();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await deleteTemplate(templateId);
      toast.success(t("toastTemplateDeleted"));
      router.refresh();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label={t("deleteTemplate")}
        className="hv gap-1.5 text-fg-tertiary hover:text-error shrink-0"
      >
        <span className="ia ia-shake" aria-hidden="true">
          <Trash2 size={14} />
        </span>
        <span>{t("deleteTemplate")}</span>
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        loading={busy}
        title={t("deleteTemplate")}
        message={t("deleteTemplateHint", { name: templateName })}
        confirmLabel={t("deleteTemplate")}
      />
    </>
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
  const handleError = useAdminActionError();
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
    } catch (err) {
      handleError(err);
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
  const handleError = useAdminActionError();
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
    } catch (err) {
      handleError(err);
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
