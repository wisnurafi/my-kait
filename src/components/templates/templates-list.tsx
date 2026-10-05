"use client";

import { useState, useEffect, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FilterChip } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import {
  deleteTemplateAction,
  duplicateTemplateAction,
  createShareLinkAction,
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
  FolderPlus,
  Folder,
  FolderOpen,
  LayoutGrid,
  FileQuestion,
  LayoutTemplate,
  ChevronLeft,
  ChevronRight,
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
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);

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
    router.push(`/templates?${params.toString()}`);
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
        router.push(`/templates?${params.toString()}`);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  function selectFolder(id: string) {
    pushParams({ folder: id === "all" ? undefined : id });
  }

  function handleDelete(id: string) {
    setConfirmTarget({ kind: "template", id });
  }

  function handleConfirmDelete() {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", target.id);
      if (target.kind === "template") {
        await deleteTemplateAction(fd);
        toast.success(t("deleted"));
      } else {
        await deleteFolderAction(fd);
        if (activeFolder === target.id) selectFolder("all");
        toast.success(t("folders.deleted"));
      }
    });
  }

  function handleDuplicate(id: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await duplicateTemplateAction(fd);
      toast.success(t("duplicated"));
    });
  }

  function handleShare(id: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("templateId", id);
      const result = await createShareLinkAction(fd);
      if (result.success && result.slug) {
        setShared({ templateId: id, slug: result.slug });
      }
    });
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
    router.push(`/templates?${params.toString()}`);
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

  return (
    <div className="flex gap-8 flex-col lg:flex-row">
      {/* Folder sidebar */}
      <aside className="w-full lg:w-64 shrink-0">
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
                className="gap-1"
              >
                <FolderPlus size={14} />
              </Button>
            </Tooltip>
          </div>

          {showNewFolder && (
            <div className="flex gap-1 mb-2">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t("folders.namePlaceholder")}
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                autoFocus
              />
              <Tooltip content={t("folders.create")}>
                <Button size="sm" onClick={handleCreateFolder} disabled={pending}>
                  <Check size={14} />
                </Button>
              </Tooltip>
            </div>
          )}

          {folderButton("all", t("folders.all"), <LayoutGrid size={15} />, initial.length)}
          {folderButton(
            "unfiled",
            t("folders.unfiled"),
            <FileQuestion size={15} />,
          )}

          {folders.map((folder) =>
            renamingId === folder.id ? (
              <div key={folder.id} className="flex gap-1 px-1">
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleRenameFolder(folder.id)}
                  autoFocus
                />
                <Tooltip content={tc("save")}>
                  <Button size="sm" onClick={() => handleRenameFolder(folder.id)} disabled={pending}>
                    <Check size={14} />
                  </Button>
                </Tooltip>
                <Tooltip content={tc("cancel")}>
                  <Button size="sm" variant="ghost" onClick={() => setRenamingId(null)}>
                    <X size={14} />
                  </Button>
                </Tooltip>
              </div>
            ) : (
              <div key={folder.id} className="group flex items-center">
                <div className="flex-1 min-w-0">
                  {folderButton(
                    folder.id,
                    folder.name,
                    activeFolder === folder.id ? <FolderOpen size={15} /> : <Folder size={15} />,
                    folder.templateCount,
                  )}
                </div>
                <div className="hidden group-hover:flex shrink-0">
                  <Tooltip content={t("folders.rename")}>
                    <button
                      onClick={() => {
                        setRenamingId(folder.id);
                        setRenameValue(folder.name);
                      }}
                      className="p-1.5 text-fg-tertiary hover:text-fg cursor-pointer"
                    >
                      <Pencil size={13} />
                    </button>
                  </Tooltip>
                  <Tooltip content={t("folders.delete")}>
                    <button
                      onClick={() => handleDeleteFolder(folder.id, folder.name)}
                      className="p-1.5 text-fg-tertiary hover:text-error cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            ),
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap stagger-in">
          <div>
            <div className="label mb-2">{t("title")}</div>
            <h2 className="uppercase">{t("title")}</h2>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" size={16} />
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={handleSearch}
              className="pl-9"
            />
          </div>
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

        {/* Templates grid */}
        {initial.length === 0 ? (
          hasActiveFilter ? (
            <Card className="p-12 text-center animate-fade-in">
              <div className="mx-auto mb-4 w-12 h-12 rounded-lg bg-accent-soft border border-accent/40 flex items-center justify-center">
                <Search size={22} className="text-accent" />
              </div>
              <p className="text-fg-secondary text-lg">{t("noSearchResults")}</p>
            </Card>
          ) : (
            <Card className="p-12 text-center animate-fade-in">
              <div className="mx-auto mb-4 w-12 h-12 rounded-lg bg-accent-soft border border-accent/40 flex items-center justify-center">
                <LayoutTemplate size={22} className="text-accent" />
              </div>
              <p className="text-fg-secondary text-lg">{t("noTemplates")}</p>
              <p className="text-sm text-fg-tertiary mt-2">{t("noTemplatesHint")}</p>
            </Card>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {initial.map((template, i) => (
              <div
                key={template.id}
                className="stagger-in"
                style={{ "--stagger-index": i } as React.CSSProperties}
              >
              <Card
                className="p-5 h-full hover:border-border-strong transition-colors"
                hover
              >
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
                      <Button size="sm" onClick={() => handleSaveEdit(template.id)} className="gap-1.5">
                        <Check size={14} /> {t("save")}
                      </Button>
                      <Tooltip content={tc("cancel")}>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X size={14} />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Card header */}
                    <div className="flex items-start gap-3 mb-2">
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-accent-soft border border-accent/40 flex items-center justify-center">
                        <LayoutTemplate size={18} className="text-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-lg uppercase leading-tight truncate">{template.name}</h3>
                        <p className="text-xs text-fg-tertiary font-mono mt-0.5">
                          {new Date(template.updatedAt).toLocaleDateString(
                            locale === "en" ? "en-US" : "id-ID",
                          )}
                        </p>
                      </div>
                    </div>
                    {template.description && (
                      <p className="text-sm text-fg-secondary mb-2">{template.description}</p>
                    )}
                    {template.tags && template.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-3">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="default" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                    {/* Move to folder */}
                    {folders.length > 0 && (
                      <div className="mb-3">
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
                    <div className="flex gap-1 flex-wrap">
                      <Button size="sm" variant="primary" onClick={() => handleLoad(template.id)} className="gap-1.5">
                        <Plus size={14} /> {t("load")}
                      </Button>
                      <Tooltip content={tc("edit")}>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(template)} className="gap-1">
                          <Pencil size={14} />
                        </Button>
                      </Tooltip>
                      <Tooltip content={tc("duplicate")}>
                        <Button size="sm" variant="ghost" onClick={() => handleDuplicate(template.id)} className="gap-1">
                          <Copy size={14} />
                        </Button>
                      </Tooltip>
                      <Tooltip content={t("shareLink")}>
                        <Button size="sm" variant="ghost" onClick={() => handleShare(template.id)} className="gap-1">
                          <Share2 size={14} />
                        </Button>
                      </Tooltip>
                      <Tooltip content={tc("delete")}>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(template.id)} className="text-error gap-1">
                          <Trash2 size={14} />
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
                            >
                              <Copy size={12} />
                            </Button>
                          </Tooltip>
                          <a href={`/t/${shared.slug}`} target="_blank" rel="noopener noreferrer">
                            <Tooltip content={t("openShareLink")}>
                              <Button size="sm" variant="ghost">
                                <ExternalLink size={14} />
                              </Button>
                            </Tooltip>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
              </div>
            ))}
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
              className="gap-1"
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
              className="gap-1"
            >
              {tc("next")} <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </div>

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
    </div>
  );
}
