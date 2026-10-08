"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Dialog, DialogTitle, DialogBody, ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { DiscordPreview } from "@/components/editor/discord-preview";
import { cn } from "@/lib/utils";
import {
  createTemplateVersionAction,
  listTemplateVersionsAction,
  restoreTemplateVersionAction,
} from "@/server/actions/templates";
import { History, Camera, RotateCcw, Eye } from "lucide-react";

type Version = { id: string; name: string; createdAt: string; payload: unknown };

function fmtTimestamp(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TemplateHistoryDialog({
  templateId,
  templateName,
  open,
  onClose,
}: {
  templateId: string;
  templateName: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("templates");
  const locale = useLocale();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Version | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The previewed version: explicit selection, otherwise the newest.
  const active =
    versions?.find((v) => v.id === selectedId) ?? versions?.[0] ?? null;
  const activePayload =
    active && typeof active.payload === "object" && active.payload !== null
      ? (active.payload as Record<string, unknown>)
      : {};

  const load = async () => {
    const res = await listTemplateVersionsAction(templateId);
    if ("error" in res) {
      toast.error(res.error);
      setVersions([]);
    } else {
      setVersions(res.versions);
    }
    setSelectedId(null);
  };

  useEffect(() => {
    if (open) {
      setVersions(null);
      setSelectedId(null);
      load();
    } else {
      setRestoreTarget(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateId ]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      const res = await createTemplateVersionAction(templateId);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success(t("versions.snapshotOk"));
        await load();
      }
    } finally {
      setSnapshotting(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const res = await restoreTemplateVersionAction(restoreTarget.id);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success(t("versions.restoreOk"));
        onClose();
      }
    } finally {
      setRestoring(false);
      setRestoreTarget(null);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} className="max-w-4xl">
        <DialogTitle>
          <span className="flex items-center gap-2">
            <History size={18} />
            {t("versions.title")}
          </span>
        </DialogTitle>
        <DialogBody>
          <p className="text-sm text-fg-secondary mb-4">
            {t("versions.subtitle", { name: templateName })}
          </p>
          <Button
            onClick={handleSnapshot}
            disabled={snapshotting}
            className="gap-2 mb-4"
            size="sm"
          >
            <Camera size={16} />
            {snapshotting ? t("versions.snapshotting") : t("versions.snapshotNow")}
          </Button>

          {versions === null ? (
            <p className="text-sm text-fg-tertiary">{t("versions.loading")}</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-fg-tertiary">{t("versions.empty")}</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Version list */}
              <ul className="space-y-2 max-h-[30rem] overflow-y-auto pr-1">
                {versions.map((v, i) => {
                  const isActive = active?.id === v.id;
                  return (
                    <li
                      key={v.id}
                      className={cn(
                        "panel p-3 transition-colors",
                        isActive && "border-accent",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate flex-1 min-w-0">
                          {v.name}
                        </span>
                        {i === 0 && (
                          <Badge variant="info">{t("versions.latest")}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-fg-tertiary mt-0.5">
                        {fmtTimestamp(v.createdAt, locale)}
                      </p>
                      <div className="flex items-center gap-2 mt-2.5">
                        <Button
                          size="sm"
                          variant={isActive ? "secondary" : "ghost"}
                          onClick={() => setSelectedId(v.id)}
                          className="gap-1.5"
                          aria-pressed={isActive}
                        >
                          <Eye size={14} />
                          {t("versions.preview")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRestoreTarget(v)}
                          className="gap-1.5"
                        >
                          <RotateCcw size={14} />
                          {t("versions.restore")}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Side preview */}
              <div className="min-w-0">
                {active && (
                  <p className="label mb-2 truncate">
                    {t("versions.previewTitle", { name: active.name })}
                  </p>
                )}
                <DiscordPreview payload={activePayload} />
              </div>
            </div>
          )}
          <p className="text-xs text-fg-tertiary mt-4">
            {t("versions.keptNote", { count: 20 })}
          </p>
        </DialogBody>
      </Dialog>

      {restoreTarget && (
        <ConfirmDialog
          open={!!restoreTarget}
          onClose={() => setRestoreTarget(null)}
          onConfirm={handleRestore}
          title={t("versions.restoreTitle")}
          message={t("versions.restoreMessage", { name: templateName })}
          confirmLabel={t("versions.restoreConfirm")}
          loading={restoring}
          danger={false}
        />
      )}
    </>
  );
}
