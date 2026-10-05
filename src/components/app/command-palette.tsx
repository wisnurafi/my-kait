"use client";

/**
 * Command palette — Raycast-style quick launcher.
 * Cmd/Ctrl+K toggles, fuzzy filter, arrow keys + Enter to run, Esc closes.
 * Mounted once in the (app) layout; opened via <CommandPaletteButton />
 * or the global shortcut.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import {
  Home,
  Pencil,
  Link2,
  FileText,
  History,
  Settings,
  LayoutGrid,
  Globe,
  Plus,
  Webhook,
  Import,
  Search,
  Command,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  label: string;
  keywords: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  group: "go" | "actions";
};

const PaletteContext = createContext<{ openPalette: () => void }>({
  openPalette: () => {},
});

export function useCommandPalette() {
  return useContext(PaletteContext);
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const t = text.toLowerCase();
  let qi = 0;
  for (const ch of t) {
    if (ch === q[qi]) qi++;
    if (qi === q.length) return true;
  }
  return false;
}

function PaletteModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("palette");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items: Item[] = useMemo(
    () => [
      { id: "dashboard", label: tNav("dashboard"), keywords: "home overview", href: "/dashboard", icon: Home, group: "go" },
      { id: "editor", label: tNav("editor"), keywords: "compose write message", href: "/editor", icon: Pencil, group: "go" },
      { id: "webhooks", label: tNav("webhooks"), keywords: "discord url endpoint", href: "/webhooks", icon: Link2, group: "go" },
      { id: "templates", label: tNav("templates"), keywords: "saved library", href: "/templates", icon: FileText, group: "go" },
      { id: "logs", label: tNav("logs"), keywords: "history activity", href: "/logs", icon: History, group: "go" },
      { id: "settings", label: tNav("settings"), keywords: "config preferences", href: "/settings", icon: Settings, group: "go" },
      { id: "gallery", label: t("gallery"), keywords: "public community share", href: "/gallery", icon: LayoutGrid, group: "go" },
      { id: "landing", label: t("landingPage"), keywords: "home site", href: "/", icon: Globe, group: "go" },
      { id: "new-message", label: t("newMessage"), keywords: "compose send create", href: "/editor", icon: Plus, group: "actions" },
      { id: "add-webhook", label: t("addWebhook"), keywords: "discord url create", href: "/webhooks", icon: Webhook, group: "actions" },
      { id: "import-template", label: t("importTemplate"), keywords: "load gallery", href: "/templates", icon: Import, group: "actions" },
    ],
    [t, tNav],
  );

  const filtered = useMemo(
    () => items.filter((i) => fuzzyMatch(query, `${i.label} ${i.keywords}`)),
    [items, query],
  );

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // keep active item in view
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = useCallback(
    (item: Item) => {
      onClose();
      router.push(item.href);
    },
    [onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[active];
      if (item) run(item);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const groups: { key: "go" | "actions"; label: string }[] = [
    { key: "go", label: t("goTo") },
    { key: "actions", label: t("actions") },
  ];

  let idx = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[18vh] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-lg overflow-hidden shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
      >
        <div className="flex items-center gap-3 border-b border-border-ink px-4">
          <Search size={16} className="shrink-0 text-fg-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            className="h-12 w-full bg-transparent text-[15px] text-fg placeholder:text-fg-tertiary focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-border-ink bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-fg-tertiary">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-fg-tertiary">
              {t("noResults", { q: query })}
            </div>
          )}
          {groups.map((g) => {
            const groupItems = filtered.filter((i) => i.group === g.key);
            if (groupItems.length === 0) return null;
            return (
              <div key={g.key} className="mb-1">
                <div className="label px-3 pb-1 pt-2">{g.label}</div>
                {groupItems.map((item) => {
                  idx++;
                  const myIdx = idx;
                  const isActive = myIdx === active;
                  return (
                    <button
                      key={item.id}
                      data-idx={myIdx}
                      onClick={() => run(item)}
                      onMouseMove={() => setActive(myIdx)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        isActive
                          ? "bg-accent-soft text-accent"
                          : "text-fg-secondary",
                      )}
                    >
                      <item.icon
                        size={16}
                        className={cn(
                          "shrink-0",
                          isActive ? "text-accent" : "text-fg-tertiary",
                        )}
                      />
                      <span className="font-medium">{item.label}</span>
                      {isActive && (
                        <CornerDownLeft
                          size={14}
                          className="ml-auto shrink-0 text-accent"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-border-ink px-4 py-2.5 font-mono text-[10px] text-fg-tertiary">
          <span>↑↓ {t("hintNavigate")}</span>
          <span>↵ {t("hintSelect")}</span>
          <span>esc {t("hintClose")}</span>
        </div>
      </div>
    </div>
  );
}

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openPalette = useCallback(() => setOpen(true), []);

  return (
    <PaletteContext.Provider value={{ openPalette }}>
      {children}
      {open && <PaletteModal onClose={() => setOpen(false)} />}
    </PaletteContext.Provider>
  );
}

export function CommandPaletteButton() {
  const t = useTranslations("dashboard");
  const { openPalette } = useCommandPalette();
  // Platform-aware shortcut label. Resolved after mount so SSR HTML
  // ("Ctrl+K") matches the first client render — no hydration mismatch.
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/mac/i.test(navigator.platform ?? ""));
  }, []);
  return (
    <button
      type="button"
      onClick={openPalette}
      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border-ink bg-surface px-3 py-2 font-mono text-[11px] text-fg-secondary transition-colors hover:border-border-strong hover:text-fg"
      aria-label={t("commandPalette")}
    >
      <Command size={14} />
      {isMac ? "⌘K" : "Ctrl+K"}
      <span className="hidden sm:inline">{t("commandPalette")}</span>
    </button>
  );
}
