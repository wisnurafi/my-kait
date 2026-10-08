"use client";

/**
 * VariablesManager: manage the user's global variables ({tokens} with
 * default values) used by the editor's {x} picker and pre-filled into the
 * per-send custom-variables panel.
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import {
  listVariablesAction,
  createVariableAction,
  deleteVariableAction,
  type UserVariable,
} from "@/server/actions/variables";

export function VariablesManager() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [variables, setVariables] = useState<UserVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [defaultValue, setDefaultValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setVariables(await listVariablesAction());
    } catch {
      toast.error(t("variablesLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const res = await createVariableAction({ name: trimmed, defaultValue });
      if ("error" in res) {
        toast.error(res.error);
      } else {
        setVariables((prev) =>
          [...prev, res.variable].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setName("");
        setDefaultValue("");
        toast.success(t("variableCreated"));
      }
    } catch {
      toast.error(t("variableCreateFailed"));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      const res = await deleteVariableAction(deleteId);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        setVariables((prev) => prev.filter((v) => v.id !== deleteId));
        toast.success(t("variableDeleted"));
      }
    } catch {
      toast.error(t("variableDeleteFailed"));
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const pendingDelete = deleteId
    ? variables.find((v) => v.id === deleteId) ?? null
    : null;

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <Label>{t("variableNameLabel")}</Label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("variableNamePlaceholder")}
            className="mt-1 font-mono"
            maxLength={42}
          />
        </div>
        <div>
          <Label>{t("variableDefaultLabel")}</Label>
          <Input
            type="text"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            placeholder={t("variableDefaultPlaceholder")}
            className="mt-1"
            maxLength={500}
          />
        </div>
        <Button
          onClick={handleCreate}
          disabled={!name.trim() || creating}
          className="hv gap-2"
        >
          <Plus size={16} />
          {creating ? t("variableAdding") : t("variableAdd")}
        </Button>
      </div>
      <p className="text-xs text-fg-tertiary">{t("variableNameHint")}</p>

      {/* List */}
      {loading ? (
        <p className="text-sm text-fg-secondary">{t("loading")}</p>
      ) : variables.length === 0 ? (
        <p className="text-sm text-fg-secondary">{t("variablesEmpty")}</p>
      ) : (
        <ul className="divide-y divide-border-ink rounded-lg border border-border-ink">
          {variables.map((v) => (
            <li
              key={v.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <code className="font-mono text-sm text-accent shrink-0">
                {`{${v.name}}`}
              </code>
              <span className="flex-1 min-w-0 truncate text-sm text-fg-secondary">
                {v.defaultValue || (
                  <span className="text-fg-tertiary">{t("variableNoDefault")}</span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteId(v.id)}
                aria-label={t("variableDeleteLabel", { name: v.name })}
                title={t("variableDeleteLabel", { name: v.name })}
                className="shrink-0 text-fg-tertiary hover:text-error"
              >
                <Trash2 size={16} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={t("variableDeleteTitle")}
        message={
          pendingDelete
            ? t("variableDeleteMessage", { name: `{${pendingDelete.name}}` })
            : ""
        }
        confirmLabel={tc("delete")}
      />
    </div>
  );
}
