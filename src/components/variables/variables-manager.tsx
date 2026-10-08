"use client";

/**
 * VariablesManager: manage the user's global variables ({tokens} with
 * default values) used by the editor's {x} picker and pre-filled into the
 * per-send custom-variables panel.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Pencil, Check, X, Variable } from "lucide-react";
import {
  listVariablesAction,
  createVariableAction,
  updateVariableAction,
  deleteVariableAction,
  type UserVariable,
} from "@/server/actions/variables";

/** Loading skeleton that mirrors the real layout: add form + 3 list rows. */
function VariablesSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <ul className="divide-y divide-border-ink rounded-lg border border-border-ink">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-5 w-28 shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VariablesManager() {
  const t = useTranslations("variables");
  const tc = useTranslations("common");
  const [variables, setVariables] = useState<UserVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [defaultValue, setDefaultValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDefault, setEditDefault] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

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

  const startEdit = (v: UserVariable) => {
    setEditingId(v.id);
    setEditName(v.name);
    setEditDefault(v.defaultValue);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDefault("");
  };

  const handleSaveEdit = async () => {
    if (!editingId || savingEdit) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    try {
      const res = await updateVariableAction(editingId, {
        name: trimmed,
        defaultValue: editDefault,
      });
      if ("error" in res) {
        toast.error(res.error);
      } else {
        setVariables((prev) =>
          prev
            .map((v) => (v.id === editingId ? res.variable : v))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        toast.success(t("variableUpdated"));
        cancelEdit();
      }
    } catch {
      toast.error(t("variableUpdateFailed"));
    } finally {
      setSavingEdit(false);
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
    ? (variables.find((v) => v.id === deleteId) ?? null)
    : null;

  return (
    <div className="space-y-6">
      {/* What variables are + how to use them */}
      <p className="text-sm text-fg-secondary leading-relaxed">{t("explainer")}</p>

      {loading ? (
        <VariablesSkeleton />
      ) : (
        <>
          {/* Add form */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <Label>{t("variableNameLabel")}</Label>
                <Input
                  ref={nameInputRef}
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
            <p className="text-xs text-fg-tertiary mt-2">{t("variableNameHint")}</p>
          </div>

          {/* List */}
          {variables.length === 0 ? (
            <EmptyState
              icon={<Variable />}
              title={t("emptyTitle")}
              description={t("variablesEmpty")}
              action={
                <Button
                  onClick={() => nameInputRef.current?.focus()}
                  className="hv gap-2"
                >
                  <Plus size={16} />
                  {t("emptyCta")}
                </Button>
              }
            />
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="label">{t("listTitle")}</p>
                <span className="text-xs text-fg-tertiary font-mono">
                  {t("count", { count: variables.length })}
                </span>
              </div>
              <ul className="divide-y divide-border-ink rounded-lg border border-border-ink">
                {variables.map((v) =>
                  editingId === v.id ? (
                    <li
                      key={v.id}
                      className="flex items-center gap-2 px-4 py-3"
                    >
                      <Input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="font-mono w-36 sm:w-44 shrink-0"
                        maxLength={42}
                        aria-label={t("variableNameLabel")}
                        autoFocus
                      />
                      <Input
                        type="text"
                        value={editDefault}
                        onChange={(e) => setEditDefault(e.target.value)}
                        className="flex-1 min-w-0"
                        maxLength={500}
                        aria-label={t("variableDefaultLabel")}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={savingEdit || !editName.trim()}
                        aria-label={tc("save")}
                        title={tc("save")}
                        className="shrink-0"
                      >
                        <Check size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        aria-label={tc("cancel")}
                        title={tc("cancel")}
                        className="shrink-0"
                      >
                        <X size={16} />
                      </Button>
                    </li>
                  ) : (
                    <li
                      key={v.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <code className="font-mono text-sm text-accent shrink-0">
                        {`{${v.name}}`}
                      </code>
                      <span className="flex-1 min-w-0 truncate text-sm text-fg-secondary">
                        {v.defaultValue || (
                          <span className="text-fg-tertiary">
                            {t("variableNoDefault")}
                          </span>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(v)}
                        aria-label={t("editVariableLabel", { name: v.name })}
                        title={t("editVariableLabel", { name: v.name })}
                        className="shrink-0 text-fg-tertiary hover:text-fg"
                      >
                        <Pencil size={16} />
                      </Button>
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
                  ),
                )}
              </ul>
            </div>
          )}
        </>
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
