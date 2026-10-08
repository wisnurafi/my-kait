"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

/**
 * BulkActionBar — shared select-mode toolbar for bulk ops.
 * Appears when select mode is on: select-all checkbox, selected count,
 * move-to-folder dropdown, delete button, done button.
 */
export function BulkActionBar({
  countText,
  selectAllLabel,
  allSelected,
  onToggleAll,
  folders,
  movePlaceholder,
  unfiledLabel,
  onMove,
  onDelete,
  deleteLabel,
  deleteDisabled = false,
  onCancel,
  cancelLabel,
  busy = false,
}: {
  countText: string;
  selectAllLabel: string;
  allSelected: boolean;
  onToggleAll: () => void;
  folders: Array<{ id: string; name: string }>;
  movePlaceholder: string;
  unfiledLabel: string;
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
  deleteLabel: string;
  /** Disable the delete button, e.g. when nothing is selected. */
  deleteDisabled?: boolean;
  onCancel: () => void;
  cancelLabel: string;
  busy?: boolean;
}) {
  const [moveTo, setMoveTo] = useState("");

  const handleMove = (value: string) => {
    if (!value) return;
    onMove(value === "__unfiled__" ? null : value);
    setMoveTo("");
  };

  return (
    <div
      className="panel p-3 flex items-center gap-3 flex-wrap stagger-in"
      role="toolbar"
      aria-label={selectAllLabel}
    >
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          className="size-4 accent-[var(--accent)] cursor-pointer"
        />
        <span>{selectAllLabel}</span>
      </label>
      <span className="text-sm text-fg-secondary font-mono">{countText}</span>
      <div className="flex-1" />
      <Select
        value={moveTo}
        onChange={(e) => handleMove(e.target.value)}
        disabled={busy}
        className="w-auto h-9 text-xs"
        aria-label={movePlaceholder}
      >
        <option value="">{movePlaceholder}</option>
        <option value="__unfiled__">{unfiledLabel}</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Select>
      <Button
        variant="destructive"
        size="sm"
        onClick={onDelete}
        disabled={busy || deleteDisabled}
        className="gap-1.5"
      >
        <Trash2 size={14} />
        {deleteLabel}
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </Button>
    </div>
  );
}
