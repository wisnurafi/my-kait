"use client";

/**
 * Shared theme state — single source of truth for every ThemeLanguageSwitcher
 * instance on the page (desktop sidebar, mobile top bar, settings page, ...).
 *
 * The original component kept theme in local useState, so two mounted
 * switchers could show different active states. This hook keeps them in sync
 * via a window CustomEvent. Dark is the default — do not change that.
 */

import { useState, useEffect, useCallback } from "react";

export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "mykait-theme";
const CHANGE_EVENT = "mykait-theme-change";

function readStoredTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === "system" || saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage unavailable — fall through to default */
  }
  return "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

export function useTheme() {
  // NOTE: dark is the default theme — do not change this initial value.
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const initial = readStoredTheme();
    setThemeState(initial);
    applyTheme(initial);
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<Theme>).detail;
      setThemeState(next);
      applyTheme(next);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyTheme(next);
    window.dispatchEvent(new CustomEvent<Theme>(CHANGE_EVENT, { detail: next }));
  }, []);

  return { theme, setTheme, mounted };
}
