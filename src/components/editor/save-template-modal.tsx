"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogTitle, DialogBody } from "@/components/ui/dialog";
import { saveAsTemplateAction, updateTemplateAction } from "@/server/actions/templates";
import { toast } from "@/components/ui/toast";
import { Save } from "lucide-react";

export function SaveTemplateModal({
  payload,
  editing,
  onClose,
  onSaved,
}: {
  payload: Record<string, unknown>;
  /** Set when the editor was opened from a template's "Edit" action: save updates it in place. */
  editing?: { id: string; name: string; description: string; tags: string[] } | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("templates");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; error?: string; message?: string } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const formData = new FormData(e.currentTarget);
      formData.set("payload", JSON.stringify(payload));
      if (editing) formData.set("id", editing.id);
      const res = editing
        ? await updateTemplateAction(formData)
        : await saveAsTemplateAction(null, formData);
      setResult(res);
      if ("error" in res && res.error) {
        toast.error(res.error);
      } else if ("success" in res && res.success) {
        if (editing) {
          toast.success(t("updated"));
          setTimeout(() => onSaved?.(), 1200);
        } else {
          if ("message" in res && res.message) toast.success(res.message);
          setTimeout(onClose, 1500);
        }
      }
    });
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>
        <span className="flex items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Save size={14} />
          </span>
          {editing ? t("editTitle") : t("saveAs")}
        </span>
      </DialogTitle>
      <DialogBody>
        <form onSubmit={handleSubmit} data-kbd-off className="space-y-4">
          <div>
            <Label required>{t("name")}</Label>
            <Input name="name" placeholder={t("namePlaceholder")} required defaultValue={editing?.name ?? ""} />
          </div>
          <div>
            <Label>{t("description")}</Label>
            <Textarea name="description" rows={2} placeholder={t("descriptionPlaceholder")} defaultValue={editing?.description ?? ""} />
          </div>
          <div>
            <Label>{t("tags")}</Label>
            <Input name="tags" placeholder={t("importTagsPlaceholder")} defaultValue={(editing?.tags ?? []).join(", ")} />
          </div>
          {result?.error && (
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-error">{result.error}</p>
          )}
          {result?.success && (
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-success">{result.message}</p>
          )}
          <Button type="submit" disabled={pending} className="w-full gap-2">
            {pending ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-current border-t-transparent" />
            ) : (
              <Save size={18} />
            )}
            {editing ? t("update") : t("save")}
          </Button>
        </form>
      </DialogBody>
    </Dialog>
  );
}
