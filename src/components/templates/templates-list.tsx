"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FilterChip } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TemplateHistoryDialog } from "./template-history-dialog";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import {
  bulkDeleteTemplatesAction,
  bulkMoveTemplatesAction,
} from "@/server/actions/bulk";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import {
  deleteTemplateAction,
  duplicateTemplateAction,
  createShareLinkAction,
  revokeShareLinkAction,
  getShareLinks,
  updateTemplateAction,
} from "@/server/actions/templates";
import {
  createFolderAction,
  renameFolderAction,
  deleteFolderAction,
  moveTemplateToFolderAction,
} from "@/server/actions/folders";
import {
  Search,
  Trash2,
  Copy,
  Share2,
  ExternalLink,
  Pencil,
  Check,
  X,
  Plus,
  Ban,
  FolderPlus,
  Folder,
  FolderOpen,
  History,
  ListChecks,
  LayoutGrid,
  FileQuestion,
  LayoutTemplate,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";

type Template = {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  payload: unknown;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Folder = {
  id: string;
  name: string;
  templateCount: number;
};

type ConfirmTarget = { kind: "template" | "folder"; id: string; name?: string } | null;

/**
 * Always-visible folder actions menu (touch-accessible).
 * Replaces the old hover-only rename/delete buttons.
 */
function FolderMenu({
  onRename,
  onDelete,
}: {
  onRename: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("templates");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={ref} className="relative shrink-0">
      <Tooltip content={t("folders.actions")}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t("folders.actions")}
          className="hv inline-flex p-1.5 text-fg-tertiary hover:text-fg cursor-pointer rounded-lg"
        >
          <MoreHorizontal size={14} />
        </button>
      </Tooltip>
      {open && (
        <div role="menu" className="panel absolute right-0 top-full mt-1 z-30 min-w-40 p-1.5">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onRename();
            }}
            className="hv w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg text-fg-secondary hover:text-fg hover:bg-surface-hover cursor-pointer"
          >
            <Pencil size={13} className="ia-pencil" />
            {t("folders.rename")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="hv w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg text-error hover:bg-surface-hover cursor-pointer"
          >
            <Trash2 size={13} className="ia-trash" />
            {t("folders.delete")}
          </button>
        </div>
      )}
    </div>
  );
}

export function TemplatesList({
  templates: initial,
  folders,
  activeFolder,
  allTags,
  pagination,
}: {
  templates: Template[];
  folders: Folder[];
  activeFolder: string;
  allTags: string[];
  pagination: { page: number; totalPages: number };
}) {
  const t = useTranslations("templates");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTags, setEditTags] = useState("");
  const [shared, setShared] = useState<{ templateId: string; slug: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ templateId: string } | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  function pushParams(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    // Preserve active tag/folder filters unless the patch changes them
    for (const key of ["tag", "folder"] as const) {
      const v = searchParams.get(key);
      if (v) params.set(key, v);
    }
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    // A changed filter can shrink the result set — never land on an empty page
    params.delete("page");
    router.push(`/templates?${params.toString()}`, { scroll: false });
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
  }

  // Debounce search — preserve folder/tag filters, reset page
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get("search") ?? "";
      if (search !== current) {
        const params = new URLSearchParams(searchParams.toString());
        if (search) params.set("search", search);
        else params.delete("search");
        params.delete("page");
        router.push(`/templates?${params.toString()}`, { scroll: false });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  function selectFolder(id: string) {
    pushParams({ folder: id === "all" ? undefined : id });
  }

  function resetAllFilters() {
    setSearch("");
    router.push("/templates", { scroll: false });
  }

  function handleDelete(id: string) {
    setConfirmTarget({ kind: "template", id });
  }

  function handleConfirmDelete() {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", target.id);
        if (target.kind === "template") {
          const res = await deleteTemplateAction(fd);
          if (res.error) {
            toast.error(res.error);
            return;
          }
          toast.success(t("deleted"));
        } else {
          const res = await deleteFolderAction(fd);
          if (res.error) {
            toast.error(res.error);
            return;
          }
          if (activeFolder === target.id) selectFolder("all");
          toast.success(t("folders.deleted"));
        }
      } catch {
        toast.error(t("deleteFailed"));
      }
    });
  }

  function handleDuplicate(id: string) {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", id);
        const res = await duplicateTemplateAction(fd);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(t("duplicated"));
        }
      } catch {
        toast.error(t("duplicateFailed"));
      }
    });
  }

  /* --- Bulk select mode --- */
  const pageIds = initial.map((tmpl) => tmpl.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  async function confirmBulkDelete() {
    setBulkBusy(true);
    try {
      const res = await bulkDeleteTemplatesAction(selectedIds);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success(t("bulk.deletedOk", { count: res.count }));
        exitSelectMode();
      }
    } catch {
      toast.error(t("bulk.actionFailed"));
    } finally {
      setBulkBusy(false);
      setShowBulkDelete(false);
    }
  }

  async function handleBulkMove(folderId: string | null) {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await bulkMoveTemplatesAction(selectedIds, folderId);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success(t("bulk.movedOk", { count: res.count }));
        exitSelectMode();
      }
    } catch {
      toast.error(t("bulk.actionFailed"));
    } finally {
      setBulkBusy(false);
    }
  }

  function handleShare(id: string) {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("templateId", id);
        const result = await createShareLinkAction(fd);
        if (result.error) {
          toast.error(result.error);
        } else if (result.success && result.slug) {
          setShared({ templateId: id, slug: result.slug });
        }
      } catch {
        toast.error(t("shareFailed"));
      }
    });
  }

  async function handleConfirmRevoke() {
    if (!revokeTarget) return;
    const { templateId } = revokeTarget;
    setRevoking(true);
    try {
      const shares = await getShareLinks(templateId);
      const active = shares.find((s) => s.isActive) ?? shares[0];
      if (!active) {
        toast.error(t("shareRevokeNone"));
        return;
      }
      const fd = new FormData();
      fd.set("shareId", active.id);
      const res = await revokeShareLinkAction(fd);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("shareRevoked"));
        setShared((s) => (s?.templateId === templateId ? null : s));
      }
    } catch {
      toast.error(t("shareRevokeFailed"));
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  }

  function handleLoad(id: string) {
    const template = initial.find((t) => t.id === id);
    if (!template) return;
    sessionStorage.setItem("mykait-import-payload", JSON.stringify(template.payload));
    // Use full reload with locale prefix to ensure editor remounts and loads the payload
    window.location.href = `/${locale}/editor`;
  }

  function goToPage(newPage: number) {
    // Preserve all current filters (search/tag/folder), only change page
    const params = new URLSearchParams(searchParams.toString());
    if (newPage <= 1) params.delete("page");
    else params.set("page", String(newPage));
    router.push(`/templates?${params.toString()}`, { scroll: false });
  }

  function handleSaveEdit(id: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("name", editName);
      fd.set("description", editDesc);
      fd.set("tags", editTags);
      await updateTemplateAction(fd);
      setEditingId(null);
      toast.success(t("updated"));
    });
  }

  function startEdit(template: Template) {
    setEditingId(template.id);
    setEditName(template.name);
    setEditDesc(template.description ?? "");
    setEditTags((template.tags ?? []).join(", "));
  }

  function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", newFolderName.trim());
      const result = await createFolderAction(fd);
      if (result.success) {
        setNewFolderName("");
        setShowNewFolder(false);
        toast.success(t("folders.created"));
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  }

  function handleRenameFolder(id: string) {
    if (!renameValue.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("name", renameValue.trim());
      const result = await renameFolderAction(fd);
      if (result.success) {
        setRenamingId(null);
        toast.success(t("folders.renamed"));
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  }

  function handleDeleteFolder(id: string, name: string) {
    setConfirmTarget({ kind: "folder", id, name });
  }

  function startRenameFolder(folder: Folder) {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  }

  function handleMoveTemplate(templateId: string, folderId: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("templateId", templateId);
      fd.set("folderId", folderId === "unfiled" ? "" : folderId);
      await moveTemplateToFolderAction(fd);
    });
  }

  const activeTag = searchParams.get("tag");
  const hasActiveFilter =
    (searchParams.get("search") ?? "") !== "" ||
    activeTag !== null ||
    activeFolder !== "all";

  // Tag filter chips cover ALL user templates, not just the current page.
  // (allTags comes from the server via getAllTemplateTags.)

  const folderButton = (
    id: string,
    label: string,
    icon: React.ReactNode,
    count?: number,
  ) => (
    <button
      key={id}
      onClick={() => selectFolder(id)}
      className={`w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.06em] rounded-lg border text-left transition-colors duration-150 press cursor-pointer ${
        activeFolder === id
          ? "bg-accent-soft text-accent border-accent/40"
          : "border-transparent text-fg-secondary hover:text-fg hover:bg-surface-hover hover:border-border-ink"
      }`}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-xs font-mono opacity-80">{count}</span>
      )}
    </button>
  );

  const newFolderForm = (
    <div className="flex gap-1">
      <Input
        value={newFolderName}
        onChange={(e) => setNewFolderName(e.target.value)}
        placeholder={t("folders.namePlaceholder")}
        className="h-8 text-sm"
        onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
        autoFocus
      />
      <Tooltip content={t("folders.create")}>
        <Button size="sm" onClick={handleCreateFolder} disabled={pending} className="hv">
          <Check size={14} className="ia-check" />
        </Button>
      </Tooltip>
    </div>
  );

  const renameForm = (folder: Folder, compact = false) => (
    <div className={`flex gap-1 ${compact ? "shrink-0" : "px-1"}`}>
      <Input
        value={renameValue}
        onChange={(e) => setRenameValue(e.target.value)}
        className={`h-8 text-sm ${compact ? "w-32" : ""}`}
        onKeyDown={(e) => e.key === "Enter" && handleRenameFolder(folder.id)}
        autoFocus
      />
      <Tooltip content={tc("save")}>
        <Button size="sm" onClick={() => handleRenameFolder(folder.id)} disabled={pending} className="hv">
          <Check size={14} className="ia-check" />
        </Button>
      </Tooltip>
      <Tooltip content={tc("cancel")}>
        <Button size="sm" variant="ghost" onClick={() => setRenamingId(null)} className="hv">
          <X size={14} className="ia-x" />
        </Button>
      </Tooltip>
    </div>
  );

  return (
    <div className="flex gap-8 flex-col lg:flex-row">
      {/* Main content FIRST in DOM: title (page header) + search, then folder chips */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Search */}
        <div className="flex gap-2 flex-wrap items-center stagger-in">
          <div className="hv relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" aria-hidden="true">
              <Search size={16} className="ia-search" />
            </span>
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={handleSearch}
              className="pl-9"
            />
          </div>
          <Button
            variant={selectMode ? "primary" : "secondary"}
            size="md"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            className="hv gap-2"
          >
            <ListChecks size={16} />
            {t("bulk.select")}
          </Button>
        </div>

        {/* Folder chips — horizontal scroll rail on mobile (sidebar takes over on lg) */}
        <div className="lg:hidden stagger-in">
          <div
            className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1"
            role="group"
            aria-label={t("folders.title")}
          >
            <FilterChip
              active={activeFolder === "all"}
              onClick={() => selectFolder("all")}
              className="shrink-0"
            >
              {t("folders.all")} · {initial.length}
            </FilterChip>
            <FilterChip
              active={activeFolder === "unfiled"}
              onClick={() => selectFolder("unfiled")}
              className="shrink-0"
            >
              {t("folders.unfiled")}
            </FilterChip>
            {folders.map((folder) =>
              renamingId === folder.id ? (
                <div key={folder.id} className="shrink-0">
                  {renameForm(folder, true)}
                </div>
              ) : (
                <div key={folder.id} className="flex items-center shrink-0">
                  <FilterChip
                    active={activeFolder === folder.id}
                    onClick={() => selectFolder(folder.id)}
                  >
                    {folder.name} · {folder.templateCount}
                  </FilterChip>
                  <FolderMenu
                    onRename={() => startRenameFolder(folder)}
                    onDelete={() => handleDeleteFolder(folder.id, folder.name)}
                  />
                </div>
              ),
            )}
            <button
              type="button"
              onClick={() => setShowNewFolder((v) => !v)}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide leading-none rounded-full border border-dashed border-border-ink text-fg-secondary hover:text-accent hover:border-accent cursor-pointer transition-colors press"
            >
              <FolderPlus size={13} />
              {t("folders.new")}
            </button>
          </div>
          {showNewFolder && <div className="mt-1 max-w-xs">{newFolderForm}</div>}
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {allTags.map((tag) => (
              <FilterChip
                key={tag}
                active={activeTag === tag}
                onClick={() => pushParams({ tag: activeTag === tag ? undefined : tag })}
              >
                {tag}
              </FilterChip>
            ))}
          </div>
        )}

        {/* Bulk action bar */}
        {selectMode && initial.length > 0 && (
          <BulkActionBar
            countText={t("bulk.selected", { count: selectedIds.length })}
            selectAllLabel={t("bulk.selectAll")}
            allSelected={allSelected}
            onToggleAll={() => setSelectedIds(allSelected ? [] : pageIds)}
            folders={folders}
            movePlaceholder={t("bulk.moveTo")}
            unfiledLabel={t("folders.unfiled")}
            onMove={handleBulkMove}
            onDelete={() => selectedIds.length > 0 && setShowBulkDelete(true)}
            deleteLabel={t("bulk.delete")}
            onCancel={exitSelectMode}
            cancelLabel={t("bulk.done")}
            busy={bulkBusy}
          />
        )}

        {/* Templates grid */}
        {initial.length === 0 ? (
          hasActiveFilter ? (
            <EmptyState
              icon={<Search />}
              title={t("noSearchResults")}
              description={t("noSearchResultsHint")}
              action={
                <Button variant="secondary" onClick={resetAllFilters} className="hv gap-2">
                  <X size={14} className="ia-x" />
                  {tc("reset")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<LayoutTemplate />}
              title={t("noTemplates")}
              description={t("noTemplatesHint")}
              action={
                <Link
                  href={`/${locale}/editor`}
                  className={buttonClasses("primary", "sm", "hv gap-2 no-underline")}
                >
                  <Plus size={16} className="ia-plus" />
                  {t("createTemplate")}
                </Link>
              }
            />
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {initial.map((template, i) => {
              const folderName = template.folderId
                ? folders.find((f) => f.id === template.folderId)?.name
                : undefined;
              return (
                <div
                  key={template.id}
                  className="stagger-in"
                  style={{ "--stagger-index": i } as React.CSSProperties}
                >
                  <Card className="p-5 h-full">
                    {editingId === template.id ? (
                      <div className="space-y-3">
                        <div>
                          <Label>{t("name")}</Label>
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                        <div>
                          <Label>{t("description")}</Label>
                          <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
                        </div>
                        <div>
                          <Label>{t("tags")}</Label>
                          <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder={t("tagsPlaceholder")} />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSaveEdit(template.id)} className="hv gap-1.5">
                            <Check size={14} className="ia-check" /> {t("save")}
                          </Button>
                          <Tooltip content={tc("cancel")}>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="hv">
                              <X size={14} className="ia-x" />
                            </Button>
                          </Tooltip>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* Card header: icon box + name + badges */}
                        <div className="flex items-center gap-3">
                          {selectMode && (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(template.id)}
                              onChange={() => toggleSelect(template.id)}
                              className="size-5 shrink-0 accent-[var(--accent)] cursor-pointer"
                              aria-label={template.name}
                            />
                          )}
                          <div
                            className="hv w-10 h-10 rounded-lg bg-accent-soft border border-accent/40 flex items-center justify-center shrink-0"
                            aria-hidden="true"
                          >
                            <LayoutTemplate size={18} className="ia-file text-accent" />
                          </div>
                          <h3 className="flex-1 min-w-0 font-display text-lg uppercase leading-tight truncate">
                            {template.name}
                          </h3>
                          {folderName && (
                            <Badge variant="default" className="gap-1 shrink-0">
                              <Folder size={11} />
                              {folderName}
                            </Badge>
                          )}
                        </div>
                        {/* Meta block */}
                        <p className="font-mono text-xs text-fg-tertiary mt-2.5">
                          {new Date(template.updatedAt).toLocaleDateString(
                            locale === "en" ? "en-US" : "id-ID",
                          )}
                        </p>
                        {template.description && (
                          <p className="text-sm text-fg-secondary mt-1.5 line-clamp-2">
                            {template.description}
                          </p>
                        )}
                        {template.tags && template.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-2">
                            {template.tags.map((tag) => (
                              <Badge key={tag} variant="default" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        )}
                        {/* Move to folder */}
                        {folders.length > 0 && (
                          <div className="mt-2.5">
                            <Select
                              value={template.folderId ?? "unfiled"}
                              onChange={(e) => handleMoveTemplate(template.id, e.target.value)}
                              disabled={pending}
                              className="h-9 text-xs font-bold uppercase tracking-[0.05em]"
                              title={t("folders.moveTo")}
                            >
                              <option value="unfiled">{t("folders.unfiled")}</option>
                              {folders.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}
                        {/* Action row: icon-buttons */}
                        <div className="flex gap-1 mt-3 pt-3 border-t border-border-ink flex-wrap">
                          <Tooltip content={t("load")}>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleLoad(template.id)}
                              className="hv"
                            >
                              <Plus size={16} className="ia-plus" />
                            </Button>
                          </Tooltip>
                          <Tooltip content={tc("edit")}>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => startEdit(template)}
                              className="hv"
                            >
                              <Pencil size={16} className="ia-pencil" />
                            </Button>
                          </Tooltip>
                          <Tooltip content={tc("duplicate")}>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDuplicate(template.id)}
                              disabled={pending}
                              className="hv"
                            >
                              <Copy size={16} />
                            </Button>
                          </Tooltip>
                          <Tooltip content={t("shareLink")}>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleShare(template.id)}
                              disabled={pending}
                              className="hv"
                            >
                              <Share2 size={16} />
                            </Button>
                          </Tooltip>
                          <Tooltip content={tc("delete")}>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(template.id)}
                              disabled={pending}
                              className="hv text-error"
                            >
                              <Trash2 size={16} className="ia-trash" />
                            </Button>
                          </Tooltip>
                          <Tooltip content={t("history")}>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setHistoryFor(template)}
                              className="hv"
                            >
                              <History size={16} />
                            </Button>
                          </Tooltip>
                        </div>
                        {shared?.templateId === template.id && (
                          <div className="mt-3 p-2 bg-sunken border border-border-ink rounded-lg">
                            <div className="flex items-center gap-2">
                              <Input
                                readOnly
                                value={`${window.location.origin}/t/${shared.slug}`}
                                className="text-xs h-8 font-mono"
                              />
                              <Tooltip content={t("copyShareLink")}>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/t/${shared.slug}`);
                                    toast.success(t("shareLinkCopied"));
                                  }}
                                  className="hv"
                                >
                                  <Copy size={12} />
                                </Button>
                              </Tooltip>
                              <a href={`/t/${shared.slug}`} target="_blank" rel="noopener noreferrer">
                                <Tooltip content={t("openShareLink")}>
                                  <Button size="sm" variant="ghost" className="hv">
                                    <ExternalLink size={14} />
                                  </Button>
                                </Tooltip>
                              </a>
                              <Tooltip content={t("revokeShareLink")}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setRevokeTarget({ templateId: template.id })}
                                  disabled={revoking}
                                  className="hv text-error"
                                >
                                  <Ban size={14} />
                                </Button>
                              </Tooltip>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="panel px-4 py-3 flex items-center justify-between mt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="hv gap-1"
            >
              <ChevronLeft size={16} /> {tc("prev")}
            </Button>
            <span className="text-sm text-fg-secondary font-mono">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="hv gap-1"
            >
              {tc("next")} <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </div>

      {/* Folder sidebar — desktop only, visually first via order */}
      <aside className="hidden lg:block lg:order-first w-64 shrink-0">
        <div className="lg:sticky lg:top-4 space-y-1 panel p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h2 className="label flex items-center gap-1.5 truncate">
              <Folder size={14} className="shrink-0" />
              <span className="truncate">{t("folders.title")}</span>
            </h2>
            <Tooltip content={t("folders.new")}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowNewFolder((v) => !v)}
                className="hv gap-1"
              >
                <FolderPlus size={14} className="ia-plus" />
              </Button>
            </Tooltip>
          </div>

          {showNewFolder && <div className="mb-2">{newFolderForm}</div>}

          {folderButton("all", t("folders.all"), <LayoutGrid size={15} />, initial.length)}
          {folderButton("unfiled", t("folders.unfiled"), <FileQuestion size={15} />)}

          {folders.map((folder) =>
            renamingId === folder.id ? (
              <div key={folder.id}>{renameForm(folder)}</div>
            ) : (
              <div key={folder.id} className="flex items-center">
                <div className="flex-1 min-w-0">
                  {folderButton(
                    folder.id,
                    folder.name,
                    activeFolder === folder.id ? <FolderOpen size={15} /> : <Folder size={15} />,
                    folder.templateCount,
                  )}
                </div>
                <FolderMenu
                  onRename={() => startRenameFolder(folder)}
                  onDelete={() => handleDeleteFolder(folder.id, folder.name)}
                />
              </div>
            ),
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
        title={confirmTarget?.kind === "folder" ? t("folders.deleteTitle") : t("deleteTitle")}
        message={
          confirmTarget?.kind === "folder"
            ? t("folders.confirmDelete", { name: confirmTarget?.name ?? "" })
            : t("confirmDelete")
        }
        confirmLabel={t("confirmAction")}
        loading={pending}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleConfirmRevoke}
        title={t("revokeShareTitle")}
        message={t("revokeShareMessage")}
        confirmLabel={t("revokeShareConfirm")}
        loading={revoking}
      />

      {historyFor && (
        <TemplateHistoryDialog
          templateId={historyFor.id}
          templateName={historyFor.name}
          open={historyFor !== null}
          onClose={() => setHistoryFor(null)}
        />
      )}

      <ConfirmDialog
        open={showBulkDelete}
        onClose={() => setShowBulkDelete(false)}
        onConfirm={confirmBulkDelete}
        title={t("bulk.deleteTitle", { count: selectedIds.length })}
        message={t("bulk.deleteMessage")}
        confirmLabel={t("bulk.deleteConfirm")}
        loading={bulkBusy}
      />
    </div>
  );
}
