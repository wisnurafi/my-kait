"use client";

/**
 * Discord-style live preview.
 * Renders message like Discord (dark/light mode).
 * See PRD section 3.3 "Live preview".
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type DiscordTheme = "dark" | "light";

/**
 * Defense-in-depth lawan stored XSS: hanya render <a> untuk URL http(s).
 * Validasi zod (httpUrlSchema) sudah menolak javascript:/data: URL saat input,
 * tapi data lama / jalur lain tetap harus aman saat di-render.
 */
function isSafeLinkUrl(url: unknown): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

const discordDark = {
  bg: "#313338",
  surface: "#1e1f22",
  fg: "#dbdee1",
  muted: "#949ba4",
  accent: "#7a9e7e",
  embedBg: "#2b2d31",
  embedBorder: "#1e1f22",
};

const discordLight = {
  bg: "#ffffff",
  surface: "#f2f3f5",
  fg: "#060607",
  muted: "#5d5f66",
  accent: "#7a9e7e",
  embedBg: "#f2f3f5",
  embedBorder: "#e0e1e5",
};

export function DiscordPreview({
  payload,
  username,
  avatarUrl,
}: {
  payload: Record<string, unknown>;
  username?: string;
  avatarUrl?: string;
}) {
  const [theme, setTheme] = useState<DiscordTheme>("dark");
  const t = useTranslations("editor");
  const c = theme === "dark" ? discordDark : discordLight;

  const content = payload.content as string | undefined;
  const embeds = (payload.embeds as Array<Record<string, unknown>>) ?? [];
  const hasContent = !!content;
  const hasEmbeds = embeds.length > 0;
  const showEmpty = !hasContent && !hasEmbeds;

  const displayName = username || "My Kait Webhook";
  const avatar = avatarUrl || "https://cdn.discordapp.com/embed/avatars/0.png";

  return (
    <div className="panel overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border-ink">
        <span className="flex items-center gap-2.5">
          <span className="status-dot bg-success pulsing" aria-hidden="true" />
          <span className="label">{t("preview.live")}</span>
        </span>
        <div className="inline-flex items-center bg-sunken border border-border-ink rounded-lg p-0.5">
          <button
            onClick={() => setTheme("dark")}
            aria-pressed={theme === "dark"}
            className={cn(
              "px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-[0.12em] transition-colors cursor-pointer",
              theme === "dark"
                ? "bg-accent text-[#0a0a0b] font-semibold"
                : "text-fg-tertiary hover:text-fg-secondary"
            )}
          >
            {t("preview.dark")}
          </button>
          <button
            onClick={() => setTheme("light")}
            aria-pressed={theme === "light"}
            className={cn(
              "px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-[0.12em] transition-colors cursor-pointer",
              theme === "light"
                ? "bg-accent text-[#0a0a0b] font-semibold"
                : "text-fg-tertiary hover:text-fg-secondary"
            )}
          >
            {t("preview.light")}
          </button>
        </div>
      </div>

      {/* Message area */}
      <div
        className="p-4 min-h-[200px] max-h-[500px] overflow-y-auto"
        style={{ background: c.bg, color: c.fg }}
      >
        {showEmpty ? (
          <div className="flex flex-col items-center justify-center gap-2 h-[200px]" style={{ color: c.muted }}>
            <MessageSquare size={28} className="opacity-50" />
            <span className="text-sm">{t("preview.empty")}</span>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 rounded-lg px-2 py-2 -mx-2 hover:bg-white/[0.03] transition-colors"
          >
            {/* Avatar */}
            <img
              src={avatar}
              alt=""
              className="w-10 h-10 flex-shrink-0 mt-0.5 rounded-full"
            />
            {/* Message content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm" style={{ color: c.fg }}>
                  {displayName}
                </span>
                <span className="rounded bg-[#5865F2] px-1 py-0.5 text-[10px] font-bold uppercase text-white leading-none">
                  Bot
                </span>
                <span className="text-xs" style={{ color: c.muted }}>
                  hari ini pada {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* Content text */}
              {hasContent && (
                <div className="text-sm whitespace-pre-wrap break-words mb-2" style={{ color: c.fg }}>
                  {renderMarkdown(content as string)}
                </div>
              )}

              {/* Embeds */}
              {hasEmbeds && (
                <div className="space-y-2">
                  {embeds.map((embed, i) => (
                    <EmbedPreview key={i} embed={embed} colors={c} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* --- Embed preview --- */

function EmbedPreview({
  embed,
  colors,
}: {
  embed: Record<string, unknown>;
  colors: typeof discordDark;
}) {
  const color = embed.color as number | undefined;
  const borderColor = color ? `#${color.toString(16).padStart(6, "0")}` : colors.accent;

  const author = embed.author as { name?: string; url?: string; icon_url?: string } | undefined;
  const footer = embed.footer as { text?: string; icon_url?: string } | undefined;
  const thumbnail = embed.thumbnail as { url: string } | undefined;
  const image = embed.image as { url: string } | undefined;
  const fields = embed.fields as Array<{ name: string; value: string; inline?: boolean }> | undefined;
  const title = embed.title as string | undefined;
  const titleUrl = embed.url as string | undefined;
  const description = embed.description as string | undefined;

  return (
    <div
      className="rounded-[4px] overflow-hidden flex max-w-[432px]"
      style={{
        background: colors.embedBg,
        borderLeft: `4px solid ${borderColor}`,
      }}
    >
      <div className="flex-1 p-3 min-w-0">
        {/* Author */}
        {author?.name && (
          <div className="flex items-center gap-2 mb-2">
            {author.icon_url && (
              <img src={author.icon_url} alt="" className="w-6 h-6" style={{ borderRadius: "50%" }} />
            )}
            <div className="flex items-center gap-1 text-sm">
              {isSafeLinkUrl(author.url) ? (
                <a href={author.url} className="font-bold hover:underline" style={{ color: colors.accent }}>
                  {author.name}
                </a>
              ) : (
                <span className="font-bold">{author.name}</span>
              )}
            </div>
          </div>
        )}

        {/* Title */}
        {title && (
          <div className="font-bold text-sm mb-1">
            {isSafeLinkUrl(titleUrl) ? (
              <a href={titleUrl} className="hover:underline" style={{ color: colors.accent }}>
                {title}
              </a>
            ) : (
              title
            )}
          </div>
        )}

        {/* Description */}
        {description && (
          <div className="text-sm mb-2 whitespace-pre-wrap break-words" style={{ color: colors.fg }}>
            {renderMarkdown(description)}
          </div>
        )}

        {/* Fields */}
        {fields && fields.length > 0 && (
          <div className="grid grid-cols-1 gap-1 mb-2">
            {fields.map((field, i) => (
              <div key={i} className={field.inline ? "inline-block w-[33%] pr-2 align-top" : "block"}>
                <div className="font-bold text-xs mb-0.5" style={{ color: colors.muted }}>
                  {field.name}
                </div>
                <div className="text-xs" style={{ color: colors.fg }}>
                  {field.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Thumbnail (inline) */}
        {thumbnail && (
          <img src={thumbnail.url} alt="" className="w-20 h-20 rounded object-cover float-right ml-2 mb-2" />
        )}

        {/* Image */}
        {image && (
          <img src={image.url} alt="" className="max-w-full rounded mt-2" />
        )}

        {/* Footer */}
        {footer?.text && (
          <div className="flex items-center gap-1 mt-2">
            {footer.icon_url && (
              <img src={footer.icon_url} alt="" className="w-5 h-5" style={{ borderRadius: "50%" }} />
            )}
            <span className="text-xs" style={{ color: colors.muted }}>
              {footer.text}
            </span>
            {typeof embed.timestamp !== "undefined" && (
              <span className="text-xs" style={{ color: colors.muted }}>
                • {new Date().toLocaleDateString("id-ID")}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* --- Simple markdown renderer (sanitized, no dangerouslySetInnerHTML) --- */

function renderMarkdown(text: string): React.ReactNode {
  // Basic inline markdown: **bold**, *italic*, ~~strike~~, `code`, __underline__
  // Split by patterns and return as React nodes
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|~~([^~]+)~~|`([^`]+)`|__([^_]+)__)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) parts.push(<strong key={key++}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={key++}>{match[3]}</em>);
    else if (match[4]) parts.push(<s key={key++}>{match[4]}</s>);
    else if (match[5]) parts.push(<code key={key++} className="px-1 rounded bg-black/20 text-xs font-mono">{match[5]}</code>);
    else if (match[6]) parts.push(<u key={key++}>{match[6]}</u>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}
