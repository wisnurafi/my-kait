"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor, Globe } from "lucide-react";
import { useTheme, type Theme } from "./use-theme";

export function ThemeLanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme, mounted } = useTheme();

  function switchLanguage() {
    const newLocale = locale === "id" ? "en" : "id";
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  }

  if (!mounted) {
    return <div className="h-9 w-20" />;
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Language switcher */}
      <button
        onClick={switchLanguage}
        className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] rounded-lg border border-border-ink bg-surface text-fg-secondary hover:text-fg hover:border-border-strong transition-colors duration-150 cursor-pointer focus-ring"
      >
        <Globe size={14} />
        {locale.toUpperCase()}
      </button>

      {/* Theme switcher — segmented */}
      <div className="flex items-center p-1 rounded-lg border border-border-ink bg-sunken">
        <ThemeButton icon={Monitor} active={theme === "system"} onClick={() => setTheme("system")} label={t("themeSystem")} />
        <ThemeButton icon={Sun} active={theme === "light"} onClick={() => setTheme("light")} label={t("themeLight")} />
        <ThemeButton icon={Moon} active={theme === "dark"} onClick={() => setTheme("dark")} label={t("themeDark")} />
      </div>
    </div>
  );
}

function ThemeButton({
  icon: Icon,
  active,
  onClick,
  label,
}: {
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "p-1.5 rounded-md transition-colors duration-150 cursor-pointer focus-ring",
        active
          ? "bg-accent text-[#0a0a0b]"
          : "text-fg-tertiary hover:text-fg",
      )}
    >
      <Icon size={14} />
    </button>
  );
}

// Re-export for consumers that only need the type/hook.
export type { Theme };
