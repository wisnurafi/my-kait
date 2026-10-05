"use client";

/**
 * Message Editor — the core of My Kait.
 * See PRD section 3.3.
 *
 * Features:
 * - 3 modes: normal, embed, both
 * - Full embed editor (title, description, color, author, thumbnail, image, fields, footer, timestamp)
 * - Real-time character counting per Discord limits
 * - Live Discord-style preview
 * - Import/Export JSON payload
 * - Send to saved webhook or manual URL
 * - Undo/redo, autosave draft to localStorage
 */

import { useState, useEffect, useCallback, useTransition, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/ui/image-upload";
import { cn } from "@/lib/utils";
import { DiscordPreview } from "@/components/editor/discord-preview";
import { sendMessageAction, editMessageAction } from "@/server/actions/messages";
import {
  Layers,
  Type,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  Send,
  Undo,
  Redo,
  ChevronDown,
  ChevronUp,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import { SaveTemplateModal } from "@/components/editor/save-template-modal";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import {
  extractCustomVariables,
  substitutePayloadVariables,
} from "@/lib/template-vars";

/* --- Types --- */

type Mode = "normal" | "embed" | "both";

interface EmbedField {
  id: string;
  name: string;
  value: string;
  inline: boolean;
}

interface Embed {
  id: string;
  title: string;
  url: string;
  description: string;
  color: string; // hex
  author: { name: string; url: string; icon_url: string };
  thumbnail_url: string;
  image_url: string;
  fields: EmbedField[];
  footer: { text: string; icon_url: string };
  useTimestamp: boolean;
  manualTimestamp: string;
}

interface EditorState {
  mode: Mode;
  content: string;
  username: string;
  avatarUrl: string;
  tts: boolean;
  threadId: string;
  suppressMentions: boolean;
  embeds: Embed[];
}

/* --- Helpers --- */

const DRAFT_KEY = "mykait-editor-draft";
const SAVE_PAYLOAD_KEY = "mykait-save-payload";

/** Baca preferensi savePayload dari localStorage. Default true. */
function readSavePayloadDefault(): boolean {
  try {
    const v = localStorage.getItem(SAVE_PAYLOAD_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

function createEmptyEmbed(): Embed {
  return {
    id: crypto.randomUUID(),
    title: "",
    url: "",
    description: "",
    color: "#000000",
    author: { name: "", url: "", icon_url: "" },
    thumbnail_url: "",
    image_url: "",
    fields: [],
    footer: { text: "", icon_url: "" },
    useTimestamp: false,
    manualTimestamp: "",
  };
}

function createEmptyField(): EmbedField {
  return { id: crypto.randomUUID(), name: "", value: "", inline: false };
}

function hexToInt(hex: string): number | undefined {
  const cleaned = hex.replace("#", "");
  if (cleaned.length === 6 && /^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return parseInt(cleaned, 16);
  }
  return undefined;
}

/* --- Editor Component --- */

export function Editor({
  webhooks,
}: {
  webhooks: Array<{ id: string; name: string; lastStatus: string }>;
}) {
  const t = useTranslations("editor");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success?: boolean;
    error?: string;
    message?: string;
    results?: Array<{ id: string; name: string; success: boolean; messageId?: string; error?: string }>;
  } | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // Undo/redo history
  const [history, setHistory] = useState<EditorState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [state, setState] = useState<EditorState>({
    mode: "normal",
    content: "",
    username: "",
    avatarUrl: "",
    tts: false,
    threadId: "",
    suppressMentions: false,
    embeds: [],
  });

  const [sendConfig, setSendConfig] = useState({
    webhookId: "",
    manualUrl: "",
    savePayload: true,
    multiTarget: [] as string[],
  });

  // Sync savePayload default from localStorage after mount — reading it in
  // useState would mismatch SSR HTML when the user previously set OFF.
  useEffect(() => {
    setSendConfig((c) => ({ ...c, savePayload: readSavePayloadDefault() }));
  }, []);

  // Custom template variables detected in the payload (e.g. {nama_event}).
  // Values are filled in the send form and substituted server-side at send time.
  const [varValues, setVarValues] = useState<Record<string, string>>({});

  const [editMessageId, setEditMessageId] = useState<string | null>(null);

  // Reset editor to empty state after successful send
  const resetEditor = useCallback(() => {
    const empty: EditorState = {
      mode: "normal",
      content: "",
      username: "",
      avatarUrl: "",
      tts: false,
      threadId: "",
      suppressMentions: false,
      embeds: [],
    };
    setState(empty);
    setHistory([empty]);
    setHistoryIndex(0);
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  // Keyboard shortcuts: Ctrl/Cmd+Enter = send, Ctrl/Cmd+S = save as template
  const sendFormRef = useRef<HTMLFormElement>(null);
  const [modKey, setModKey] = useState("Ctrl");

  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
    if (/mac/i.test(platform)) setModKey("\u2318");
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      // Don't hijack keys inside the JSON panel or the save-template modal
      if (target?.closest?.("[data-kbd-off]")) return;
      if (e.key === "Enter") {
        e.preventDefault();
        sendFormRef.current?.requestSubmit();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        setShowSaveTemplate(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Load draft from localStorage or sessionStorage (for duplicate-to-editor).
  // StrictMode guard: in dev, React mounts effects twice. The first run
  // consumes the sessionStorage payload (and removes the key); without this
  // guard the second run would find an empty key and overwrite the loaded
  // template with a blank draft — the infamous "load template shows nothing"
  // bug. Refs persist across StrictMode's double-effect, so this is safe.
  const didInitFromStorage = useRef(false);
  useEffect(() => {
    if (didInitFromStorage.current) return;
    didInitFromStorage.current = true;

    // Check for edit message mode
    const editId = sessionStorage.getItem("mykait-edit-message-id");
    if (editId) {
      setEditMessageId(editId);
      sessionStorage.removeItem("mykait-edit-message-id");
    }

    // Check sessionStorage first (from "Duplikasi ke Editor" action or template Load)
    const importPayload = sessionStorage.getItem("mykait-import-payload");
    if (importPayload) {
      try {
        const parsed = JSON.parse(importPayload);
        const newState = rebuildFromPayload(parsed);
        setState(newState);
        setHistory([newState]);
        setHistoryIndex(0);
        // Confirm the load actually brought content; an empty rebuild means
        // the stored payload had nothing usable (don't fail silently).
        const isEmpty =
          !newState.content &&
          !newState.username &&
          !newState.avatarUrl &&
          !newState.threadId &&
          newState.embeds.length === 0;
        if (isEmpty) {
          console.warn("[mykait] import payload parsed but produced empty state", parsed);
          toast.error(t("importEmpty"));
        }
      } catch (err) {
        console.error("[mykait] failed to load import payload", err);
        toast.error(t("importFailed"));
      }
      sessionStorage.removeItem("mykait-import-payload");
      return;
    }
    // Otherwise load draft
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setState(parsed);
        setHistory([parsed]);
        setHistoryIndex(0);
      } catch {}
    }
  }, []);

  // Autosave draft. Skipped while in edit mode: the payload being edited must
  // never overwrite the user's unsent draft in localStorage (data loss).
  // editMessageId is in the deps so entering edit mode cancels any pending
  // write and exiting edit mode resumes normal autosave.
  useEffect(() => {
    if (editMessageId) return;
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    }, 1000);
    return () => clearTimeout(timer);
  }, [state, editMessageId]);

  // Push to history
  const pushHistory = useCallback((newState: EditorState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory.slice(-50)); // Keep last 50
    setHistoryIndex(Math.min(newHistory.length - 1, 49));
  }, [history, historyIndex]);

  const updateState = useCallback((updater: (prev: EditorState) => EditorState) => {
    setState((prev) => {
      const next = updater(prev);
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setState(history[historyIndex - 1]);
    }
  };
  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setState(history[historyIndex + 1]);
    }
  };

  /* --- Build payload for send/preview --- */

  const payload = useMemo(() => buildPayload(state), [state]);

  /* --- Custom variables: {tokens} in the payload that aren't built-in --- */

  const customVarNames = useMemo(
    () => extractCustomVariables(JSON.stringify(payload)),
    [payload],
  );

  // Live preview with the filled-in custom values (built-ins stay raw until send).
  // Hidden in edit mode: edit sends the payload as-is (same as built-in vars).
  const showCustomVars = customVarNames.length > 0 && !editMessageId;
  const previewPayload = useMemo(
    () =>
      showCustomVars
        ? substitutePayloadVariables(payload, varValues)
        : payload,
    [payload, showCustomVars, varValues],
  );

  /* --- Actions --- */

  // Idempotency key: must be unique per distinct message. It only needs to
  // stay stable for the duration of ONE send attempt (double-clicks are
  // blocked by `pending`; 429 retries happen server-side with the same key).
  // It is rotated after every completed attempt — otherwise the 2nd message
  // would reuse the 1st message's key and get blocked as "duplikat".
  const [sendId, setSendId] = useState(() => crypto.randomUUID());

  function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return; // Anti double-click
    setResult(null);
    startTransition(async () => {
      const formData = new FormData(e.currentTarget);
      formData.set("payload", JSON.stringify(payload));
      formData.set("mode", state.mode);
      formData.set("savePayload", String(sendConfig.savePayload));
      formData.set("idempotencyKey", sendId);
      if (showCustomVars) {
        const vars: Record<string, string> = {};
        for (const name of customVarNames) {
          vars[name] = varValues[name] ?? "";
        }
        formData.set("customVars", JSON.stringify(vars));
      }
      if (sendConfig.multiTarget.length > 0) {
        formData.set("multiTarget", sendConfig.multiTarget.join(","));
      }

      // If editing an existing message, use editMessageAction
      if (editMessageId) {
        formData.set("logId", editMessageId);
        const res = await editMessageAction(null, formData);
        setResult(res);
        if (res?.success) {
          if (res.message) toast.success(res.message);
          setEditMessageId(null); // Exit edit mode after success
        } else if (res?.error) {
          toast.error(res.error);
        }
        return;
      }

      const res = await sendMessageAction(null, formData);
      // Attempt is over — rotate the key so the next Send is treated as a
      // new message, not a duplicate of this one.
      setSendId(crypto.randomUUID());
      setResult(res);
      if (res?.success) {
        if (res.message) toast.success(res.message);
        resetEditor();
      } else if (res?.error) {
        toast.error(res.error);
      }
    });
  }

  function handleExportJson() {
    const json = JSON.stringify(payload, null, 2);
    setJsonText(json);
    setShowJson(true);
  }

  function handleImportJson() {
    try {
      const parsed = JSON.parse(jsonText);
      // Reconstruct state from payload
      const newState = rebuildFromPayload(parsed);
      setState(newState);
      pushHistory(newState);
      setShowJson(false);
    } catch {
      toast.error(t("invalidJson"));
    }
  }

  /* --- Character counts --- */

  const totalEmbedChars = useMemo(() => {
    return state.embeds.reduce((sum, e) => {
      return (
        sum +
        e.title.length +
        e.description.length +
        e.author.name.length +
        e.footer.text.length +
        e.fields.reduce((fSum, f) => fSum + f.name.length + f.value.length, 0)
      );
    }, 0);
  }, [state.embeds]);

  const canSend = (() => {
    // In edit mode the target is the original webhook, not the selector.
    const hasTarget =
      editMessageId !== null ||
      sendConfig.webhookId !== "" ||
      sendConfig.manualUrl.trim() !== "" ||
      sendConfig.multiTarget.length > 0;
    const hasContent =
      state.content.trim() !== "" || state.embeds.length > 0;
    return (
      hasTarget &&
      hasContent &&
      state.content.length <= 2000 &&
      totalEmbedChars <= 6000 &&
      state.embeds.length <= 10
    );
  })();

  /* --- Render --- */

  return (
    <div className="space-y-6">
      {/* Edit mode indicator */}
      {editMessageId && (
        <div className="panel flex items-center justify-between gap-3 px-4 py-3 animate-fade-in !border-warning/40">
          <span className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-warning">
            <span className="status-dot bg-warning" aria-hidden="true" />
            {t("editModeBanner")}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setEditMessageId(null)} className="font-mono text-[11px] uppercase tracking-[0.14em]">
            {t("cancelEdit")}
          </Button>
        </div>
      )}

      {/* Page head */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent mb-2">compose</p>
          <h1 className="font-display text-3xl tracking-tight">{t("title")}</h1>
        </div>
        {/* Segmented mode control */}
        <div
          role="group"
          aria-label={t("title")}
          className="inline-flex items-center bg-sunken border border-border-ink rounded-lg p-1"
        >
          {(["normal", "embed", "both"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => updateState((prev) => ({ ...prev, mode: m }))}
              aria-pressed={state.mode === m}
              className={cn(
                "px-4 py-2 rounded-md font-mono text-xs uppercase tracking-[0.08em] transition-colors cursor-pointer focus-ring",
                state.mode === m
                  ? "bg-accent text-[#0a0a0b] font-semibold"
                  : "text-fg-secondary hover:text-fg"
              )}
            >
              {t(`mode.${m}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar: undo/redo · JSON import-export · save template */}
      <div className="flex items-center gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0} className="gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
          <Undo size={14} /> {t("undo")}
        </Button>
        <Button variant="ghost" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1} className="gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
          <Redo size={14} /> {t("redo")}
        </Button>
        <span aria-hidden="true" className="mx-2 h-5 w-px bg-border-ink" />
        <Button variant="ghost" size="sm" onClick={handleExportJson} className="gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
          <Download size={14} /> {t("exportJson")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowJson(!showJson)} className="gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
          <Upload size={14} /> {t("importJson")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowSaveTemplate(true)} title={t("kbdSave", { mod: modKey })} className="gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
          <Save size={14} /> {t("saveAs")}
        </Button>
      </div>

      {/* JSON Import/Export panel */}
      {showJson && (
        <div data-kbd-off className="panel p-5 animate-fade-in">
          <Label>{t("jsonPayload")}</Label>
          <Textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            placeholder='{"content":"...","embeds":[...]}'
          />
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleImportJson}>{t("importBtn")}</Button>
            <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(jsonText); }}>{t("copyBtn")}</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
        {/* Left: form */}
        <div className="space-y-4 min-w-0">
          {/* Content */}
          {(state.mode === "normal" || state.mode === "both") && (
            <section className="panel p-5 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2.5 font-display text-base font-semibold">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Type size={14} />
                  </span>
                  {t("content")}
                </h2>
                <Badge variant={state.content.length > 2000 ? "danger" : "default"} className="font-mono">
                  {state.content.length}/2000
                </Badge>
              </div>
              <Textarea
                value={state.content}
                onChange={(e) => updateState((prev) => ({ ...prev, content: e.target.value }))}
                rows={5}
                placeholder={t("contentPlaceholder")}
                maxLength={2000}
              />
              <RoleMentionHelper
                onInsert={(mention) => {
                  updateState((prev) => ({ ...prev, content: prev.content + mention }));
                }}
              />
            </section>
          )}

          {/* Embeds */}
          {(state.mode === "embed" || state.mode === "both") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2.5 font-display text-base font-semibold">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Layers size={14} />
                  </span>
                  {t("embeds")}
                </h2>
                <div className="flex items-center gap-2">
                  <Badge variant={totalEmbedChars > 6000 ? "danger" : "default"} className="font-mono">
                    {totalEmbedChars}/6000
                  </Badge>
                  <Badge variant={state.embeds.length > 10 ? "danger" : "default"} className="font-mono">
                    {state.embeds.length}/10
                  </Badge>
                </div>
              </div>

              {state.embeds.map((embed, idx) => (
                <EmbedEditor
                  key={embed.id}
                  embed={embed}
                  index={idx}
                  t={t}
                  onChange={(updated) => updateState((prev) => ({
                    ...prev,
                    embeds: prev.embeds.map((e) => e.id === embed.id ? updated : e),
                  }))}
                  onRemove={() => updateState((prev) => ({
                    ...prev,
                    embeds: prev.embeds.filter((e) => e.id !== embed.id),
                  }))}
                  onDuplicate={() => updateState((prev) => ({
                    ...prev,
                    embeds: [...prev.embeds, { ...embed, id: crypto.randomUUID(), fields: embed.fields.map(f => ({ ...f, id: crypto.randomUUID() })) }],
                  }))}
                />
              ))}

              {state.embeds.length < 10 && (
                <Button
                  variant="secondary"
                  onClick={() => updateState((prev) => ({
                    ...prev,
                    embeds: [...prev.embeds, createEmptyEmbed()],
                  }))}
                  className="gap-2 w-full font-mono text-[11px] uppercase tracking-[0.14em]"
                >
                  <Plus size={16} />
                  {t("addEmbed")}
                </Button>
              )}
            </div>
          )}

          {/* Override section */}
          <section className="panel p-5 animate-fade-in">
            <h2 className="flex items-center gap-2.5 font-display text-base font-semibold mb-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <SlidersHorizontal size={14} />
              </span>
              {t("override")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>{t("username")}</Label>
                <Input
                  value={state.username}
                  onChange={(e) => updateState((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder={t("usernamePlaceholder")}
                />
              </div>
              <div>
                <Label>{t("avatarUrl")}</Label>
                <ImageUpload
                  value={state.avatarUrl}
                  onChange={(url) => updateState((prev) => ({ ...prev, avatarUrl: url }))}
                  placeholder={t("avatarPlaceholder")}
                />
              </div>
            </div>
            <div className="mt-3 space-y-3">
              <Toggle
                checked={state.tts}
                onChange={(v) => updateState((prev) => ({ ...prev, tts: v }))}
                label={t("tts")}
              />
              <Toggle
                checked={state.suppressMentions}
                onChange={(v) => updateState((prev) => ({ ...prev, suppressMentions: v }))}
                label={t("suppressMentions")}
              />
              <div>
                <Label>{t("threadId")}</Label>
                <Input
                  value={state.threadId}
                  onChange={(e) => updateState((prev) => ({ ...prev, threadId: e.target.value }))}
                  placeholder={t("threadIdPlaceholder")}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right: preview + send */}
        <div className="space-y-4 lg:sticky lg:top-6 min-w-0">
          <DiscordPreview payload={previewPayload} username={state.username} avatarUrl={state.avatarUrl} />

          {/* Send form */}
          <section className="panel p-5 animate-fade-in">
            <h2 className="flex items-center gap-2.5 font-display text-base font-semibold mb-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <Send size={14} />
              </span>
              {t("sendTo")}
            </h2>
            <form ref={sendFormRef} onSubmit={handleSend} className="space-y-3">
              <div>
                <Label>{t("selectWebhook")}</Label>
                <Select
                  name="webhookId"
                  value={sendConfig.webhookId}
                  onChange={(e) => setSendConfig({ ...sendConfig, webhookId: e.target.value })}
                >
                  <option value="">{t("selectWebhookPlaceholder")}</option>
                  {webhooks.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.lastStatus})
                    </option>
                  ))}
                </Select>
              </div>
              {!sendConfig.webhookId && webhooks.length > 1 && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label>{t("multiTarget")}</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSendConfig({ ...sendConfig, multiTarget: webhooks.map((w) => w.id) })}
                        className="text-xs font-mono uppercase tracking-[0.08em] underline text-fg-secondary hover:text-accent"
                      >
                        {t("selectAll")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSendConfig({ ...sendConfig, multiTarget: [] })}
                        className="text-xs font-mono uppercase tracking-[0.08em] underline text-fg-secondary hover:text-accent"
                      >
                        {t("clear")}
                      </button>
                    </div>
                  </div>
                  {sendConfig.multiTarget.length > 0 && (
                    <p className="text-xs font-mono mt-1 text-fg-secondary">
                      {t("selectedCount", { count: sendConfig.multiTarget.length })}
                    </p>
                  )}
                  <div className="rounded-lg border border-border-ink bg-sunken space-y-1 max-h-36 overflow-y-auto mt-1 p-2 text-xs">
                    {webhooks.map((wh) => (
                      <label key={wh.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendConfig.multiTarget.includes(wh.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSendConfig({
                                ...sendConfig,
                                multiTarget: [...sendConfig.multiTarget, wh.id],
                              });
                            } else {
                              setSendConfig({
                                ...sendConfig,
                                multiTarget: sendConfig.multiTarget.filter((id) => id !== wh.id),
                              });
                            }
                          }}
                          className="w-4 h-4 border-[2px] border-border-ink"
                        />
                        <span className="flex-1">{wh.name}</span>
                        <Badge variant={wh.lastStatus === "active" ? "success" : wh.lastStatus === "invalid" ? "danger" : "default"}>
                          {wh.lastStatus}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {sendConfig.multiTarget.length === 0 && !sendConfig.webhookId && (
                <div>
                  <Label>{t("manualUrl")}</Label>
                  <Input
                    name="manualUrl"
                    value={sendConfig.manualUrl}
                    onChange={(e) => setSendConfig({ ...sendConfig, manualUrl: e.target.value })}
                    placeholder="https://discord.com/api/webhooks/…"
                  />
                </div>
              )}
              <Toggle
                checked={sendConfig.savePayload}
                onChange={(v) => setSendConfig({ ...sendConfig, savePayload: v })}
                label="Simpan payload di log"
              />
              {showCustomVars && (
                <div className="rounded-lg border border-border-ink bg-sunken p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t("customVariables")}</Label>
                    <Badge variant="info" className="font-mono">
                      {customVarNames.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-fg-secondary">{t("customVariablesDesc")}</p>
                  {customVarNames.map((name) => (
                    <div key={name} className="flex items-center gap-2">
                      <code className="font-mono text-xs text-accent shrink-0 max-w-[40%] truncate" title={name}>
                        {name}
                      </code>
                      <Input
                        value={varValues[name] ?? ""}
                        onChange={(e) =>
                          setVarValues((prev) => ({ ...prev, [name]: e.target.value }))
                        }
                        placeholder={t("variableValuePlaceholder")}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
              {result?.error && (
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-error">{result.error}</p>
              )}
              {result?.success && (
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-success">{result.message}</p>
              )}
              {result?.results && result.results.length > 0 && (
                <div className="rounded-lg border border-border-ink bg-sunken space-y-1.5 max-h-40 overflow-y-auto p-3 text-xs" aria-live="polite">
                  {result.results.map((r) => (
                    <div key={r.id} className="flex items-center gap-2">
                      <span className={r.success ? "text-success font-bold" : "text-error font-bold"} aria-hidden="true">
                        {r.success ? "✓" : "✗"}
                      </span>
                      <span className="flex-1 truncate text-fg-secondary">{r.name}</span>
                      {r.success && r.messageId && (
                        <span className="text-fg-tertiary truncate">#{r.messageId}</span>
                      )}
                      {!r.success && r.error && (
                        <span className="text-error truncate max-w-[50%]">{r.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Button type="submit" disabled={pending || !canSend} title={t("kbdSend", { mod: modKey })} className="w-full gap-2" size="lg">
                {pending ? (
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-current border-t-transparent" />
                ) : (
                  <Send size={20} />
                )}
                {pending ? t("sending") : editMessageId ? t("sendEdit") : t("send")}
              </Button>
              <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-fg-tertiary">
                {t("kbdSend", { mod: modKey })} · {t("kbdSave", { mod: modKey })}
              </p>
            </form>
          </section>
        </div>
      </div>

      {/* Save as template modal */}
      {showSaveTemplate && (
        <SaveTemplateModal payload={payload} onClose={() => setShowSaveTemplate(false)} />
      )}
    </div>
  );
}

/* --- Embed Editor Sub-component --- */

function EmbedEditor({
  embed,
  index,
  t,
  onChange,
  onRemove,
  onDuplicate,
}: {
  embed: Embed;
  index: number;
  t: (key: string) => string;
  onChange: (e: Embed) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  function update(patch: Partial<Embed>) {
    onChange({ ...embed, ...patch });
  }

  return (
    <section className="panel relative overflow-hidden p-5 pl-6 animate-fade-in">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: embed.color }}
      />
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-fg-secondary hover:text-fg transition-colors cursor-pointer"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Embed #{index + 1}
        </button>
        <div className="flex gap-1">
          <Tooltip content={t("duplicateEmbed")}>
            <Button variant="ghost" size="sm" onClick={onDuplicate}>
              <Copy size={14} />
            </Button>
          </Tooltip>
          <Tooltip content={t("removeEmbed")}>
            <Button variant="ghost" size="sm" onClick={onRemove} className="text-error">
              <Trash2 size={14} />
            </Button>
          </Tooltip>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3">
          {/* Title + URL */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="md:col-span-2">
              <Label>{t("field.title")} (256)</Label>
              <Input
                value={embed.title}
                onChange={(e) => update({ title: e.target.value })}
                maxLength={256}
              />
            </div>
            <div>
              <Label>{t("field.titleUrl")}</Label>
              <Input
                value={embed.url}
                onChange={(e) => update({ url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between">
              <Label>{t("field.description")} (4096)</Label>
              <Badge variant={embed.description.length > 4096 ? "danger" : "default"}>
                {embed.description.length}/4096
              </Badge>
            </div>
            <Textarea
              value={embed.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={3}
              maxLength={4096}
            />
          </div>

          {/* Color */}
          <div className="flex items-center gap-3">
            <Label>{t("field.color")}</Label>
            <input
              type="color"
              value={embed.color}
              onChange={(e) => update({ color: e.target.value })}
              className="h-10 w-12 rounded-lg border border-border-ink bg-sunken cursor-pointer"
            />
            <Input
              value={embed.color}
              onChange={(e) => update({ color: e.target.value })}
              className="w-32 font-mono"
            />
          </div>

          {/* Author */}
          <div className="border-t border-border-ink pt-3">
            <Label>{t("field.author")}</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
              <Input
                value={embed.author.name}
                onChange={(e) => update({ author: { ...embed.author, name: e.target.value } })}
                placeholder={t("field.authorName")}
                maxLength={256}
              />
              <Input
                value={embed.author.url}
                onChange={(e) => update({ author: { ...embed.author, url: e.target.value } })}
                placeholder="URL"
              />
              <ImageUpload
                value={embed.author.icon_url}
                onChange={(url) => update({ author: { ...embed.author, icon_url: url } })}
                placeholder={t("field.authorIcon")}
              />
            </div>
          </div>

          {/* Thumbnail + Image */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label>{t("field.thumbnail")}</Label>
              <ImageUpload
                value={embed.thumbnail_url}
                onChange={(url) => update({ thumbnail_url: url })}
                placeholder="Image URL"
              />
            </div>
            <div>
              <Label>{t("field.image")}</Label>
              <ImageUpload
                value={embed.image_url}
                onChange={(url) => update({ image_url: url })}
                placeholder="Image URL"
              />
            </div>
          </div>

          {/* Fields */}
          <div className="border-t border-border-ink pt-3">
            <div className="flex items-center justify-between mb-2">
              <Label>{t("field.fields")} ({embed.fields.length}/25)</Label>
              {embed.fields.length < 25 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update({ fields: [...embed.fields, createEmptyField()] })}
                  className="gap-1 font-mono text-[11px] uppercase tracking-[0.14em]"
                >
                  <Plus size={14} />
                  {t("addField")}
                </Button>
              )}
            </div>
            {embed.fields.map((field, fIdx) => (
              <div key={field.id} className="flex gap-2 mb-2 items-start">
                <Input
                  value={field.name}
                  onChange={(e) => update({
                    fields: embed.fields.map((f) => f.id === field.id ? { ...f, name: e.target.value } : f),
                  })}
                  placeholder={t("field.fieldName")}
                  maxLength={256}
                  className="flex-1"
                />
                <Input
                  value={field.value}
                  onChange={(e) => update({
                    fields: embed.fields.map((f) => f.id === field.id ? { ...f, value: e.target.value } : f),
                  })}
                  placeholder={t("field.fieldValue")}
                  maxLength={1024}
                  className="flex-[2]"
                />
                <Toggle
                  checked={field.inline}
                  onChange={(v) => update({
                    fields: embed.fields.map((f) => f.id === field.id ? { ...f, inline: v } : f),
                  })}
                  label={t("field.inline")}
                />
                <Tooltip content={t("removeField")}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => update({ fields: embed.fields.filter((f) => f.id !== field.id) })}
                    className="text-error"
                  >
                    <Trash2 size={14} />
                  </Button>
                </Tooltip>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-border-ink pt-3">
            <Label>{t("field.footer")} (2048)</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
              <Input
                value={embed.footer.text}
                onChange={(e) => update({ footer: { ...embed.footer, text: e.target.value } })}
                placeholder={t("field.footerText")}
                maxLength={2048}
                className="md:col-span-2"
              />
              <ImageUpload
                value={embed.footer.icon_url}
                onChange={(url) => update({ footer: { ...embed.footer, icon_url: url } })}
                placeholder={t("field.footerIcon")}
              />
            </div>
          </div>

          {/* Timestamp */}
          <div className="border-t border-border-ink pt-3">
            <Toggle
              checked={embed.useTimestamp}
              onChange={(v) => update({ useTimestamp: v })}
              label={t("field.timestamp")}
              description={t("field.useNow")}
            />
          </div>
        </div>
      )}
    </section>
  );
}

/* --- Build payload from state --- */

function buildPayload(state: EditorState): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (state.mode === "normal" || state.mode === "both") {
    if (state.content) payload.content = state.content;
  }

  if (state.username) payload.username = state.username;
  if (state.avatarUrl) payload.avatar_url = state.avatarUrl;
  if (state.tts) payload.tts = true;
  if (state.threadId) payload.thread_id = state.threadId;
  if (state.suppressMentions) {
    payload.allowed_mentions = { parse: [] };
  }

  if (state.mode === "embed" || state.mode === "both") {
    payload.embeds = state.embeds.map((e) => {
      const embed: Record<string, unknown> = {};
      if (e.title) embed.title = e.title;
      if (e.url) embed.url = e.url;
      if (e.description) embed.description = e.description;
      const color = hexToInt(e.color);
      if (color !== undefined) embed.color = color;
      if (e.author.name || e.author.url || e.author.icon_url) {
        const author: Record<string, string> = {};
        if (e.author.name) author.name = e.author.name;
        if (e.author.url) author.url = e.author.url;
        if (e.author.icon_url) author.icon_url = e.author.icon_url;
        embed.author = author;
      }
      if (e.thumbnail_url) embed.thumbnail = { url: e.thumbnail_url };
      if (e.image_url) embed.image = { url: e.image_url };
      if (e.fields.length > 0) {
        embed.fields = e.fields.map((f) => ({
          name: f.name,
          value: f.value,
          inline: f.inline,
        }));
      }
      if (e.footer.text || e.footer.icon_url) {
        const footer: Record<string, string> = {};
        if (e.footer.text) footer.text = e.footer.text;
        if (e.footer.icon_url) footer.icon_url = e.footer.icon_url;
        embed.footer = footer;
      }
      if (e.useTimestamp) {
        embed.timestamp = new Date().toISOString();
      }
      return embed;
    });
  }

  return payload;
}

/* --- Rebuild state from payload --- */

function rebuildFromPayload(payload: Record<string, unknown>): EditorState {
  const hasContent = "content" in payload;
  const hasEmbeds = "embeds" in payload && Array.isArray(payload.embeds) && payload.embeds.length > 0;

  let mode: Mode = "normal";
  if (hasContent && hasEmbeds) mode = "both";
  else if (hasEmbeds) mode = "embed";

  const embeds: Embed[] = (payload.embeds as Array<Record<string, unknown>> ?? []).map((e) => {
    const color = e.color as number;
    return {
      id: crypto.randomUUID(),
      title: (e.title as string) ?? "",
      url: (e.url as string) ?? "",
      description: (e.description as string) ?? "",
      color: color ? "#" + color.toString(16).padStart(6, "0") : "#000000",
      author: {
        name: ((e.author as Record<string, string>)?.name) ?? "",
        url: ((e.author as Record<string, string>)?.url) ?? "",
        icon_url: ((e.author as Record<string, string>)?.icon_url) ?? "",
      },
      thumbnail_url: ((e.thumbnail as Record<string, string>)?.url) ?? "",
      image_url: ((e.image as Record<string, string>)?.url) ?? "",
      fields: ((e.fields as Array<Record<string, unknown>>) ?? []).map((f) => ({
        id: crypto.randomUUID(),
        name: (f.name as string) ?? "",
        value: (f.value as string) ?? "",
        inline: (f.inline as boolean) ?? false,
      })),
      footer: {
        text: ((e.footer as Record<string, string>)?.text) ?? "",
        icon_url: ((e.footer as Record<string, string>)?.icon_url) ?? "",
      },
      useTimestamp: "timestamp" in e,
      manualTimestamp: (e.timestamp as string) ?? "",
    };
  });

  return {
    mode,
    content: (payload.content as string) ?? "",
    username: (payload.username as string) ?? "",
    avatarUrl: (payload.avatar_url as string) ?? "",
    tts: (payload.tts as boolean) ?? false,
    threadId: (payload.thread_id as string) ?? "",
    suppressMentions: "allowed_mentions" in payload,
    embeds,
  };
}

/* --- Role mention helper --- */
function RoleMentionHelper({ onInsert }: { onInsert: (mention: string) => void }) {
  const t = useTranslations("editor");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState("");

  function handleInsertRole() {
    const id = roleId.trim();
    if (!/^\d{10,25}$/.test(id)) {
      setError(t("roleIdInvalid"));
      return;
    }
    setError("");
    onInsert(`<@&${id}> `);
    setRoleId("");
  }

  return (
    <div className="mt-4 border-t border-border-ink pt-4">
      <p className="label mb-2">{t("mentionRole")}</p>
      <div className="flex gap-2">
        <Input
          value={roleId}
          onChange={(e) => {
            setRoleId(e.target.value);
            setError("");
          }}
          placeholder={t("roleIdPlaceholder")}
          className="font-mono text-sm"
          inputMode="numeric"
        />
        <Button type="button" variant="secondary" size="sm" onClick={handleInsertRole} className="shrink-0">
          {t("insertTag")}
        </Button>
      </div>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={() => onInsert("@everyone ")}
          className="text-xs font-mono uppercase tracking-[0.08em] underline text-fg-secondary hover:text-accent"
        >
          @everyone
        </button>
        <button
          type="button"
          onClick={() => onInsert("@here ")}
          className="text-xs font-mono uppercase tracking-[0.08em] underline text-fg-secondary hover:text-accent"
        >
          @here
        </button>
      </div>
      <p className="text-[11px] text-fg-tertiary mt-1">{t("roleMentionHint")}</p>
    </div>
  );
}
