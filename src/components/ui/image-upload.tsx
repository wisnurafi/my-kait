"use client";

/**
 * Image upload component for embed images.
 * Uploads to Vercel Blob, returns URL.
 * See PRD section 3.10 (P2).
 */

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Upload, X, Link as LinkIcon, Loader2 } from "lucide-react";

export function ImageUpload({
  value,
  onChange,
  label,
  placeholder = "https://… atau upload",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"url" | "upload">("url");
  const t = useTranslations("common");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload gagal");
        return;
      }

      onChange(data.url);
    } catch {
      setError("Upload gagal. Coba lagi.");
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleFile(file);
    }
  }

  const tabClasses = (isActive: boolean) =>
    cn(
      "flex items-center gap-1.5 px-3 py-1.5",
      "font-mono text-[11px] font-medium uppercase tracking-wide leading-none",
      "rounded-lg border cursor-pointer transition-colors duration-150 press",
      isActive
        ? "bg-accent text-[#0a0a0b] border-transparent"
        : "bg-surface text-fg-secondary border-border-ink hover:text-fg hover:border-border-strong",
    );

  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}

      {/* Mode tabs */}
      <div className="flex gap-1 mb-1.5">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={tabClasses(mode === "url")}
        >
          <LinkIcon size={12} /> URL
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={tabClasses(mode === "upload")}
        >
          <Upload size={12} /> {t("uploadTab")}
        </button>
      </div>

      {mode === "url" ? (
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
              className="text-error"
            >
              <X size={14} />
            </Button>
          )}
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            // Ignore key events bubbling up from inner controls (e.g. the
            // clear button) — they handle their own keyboard interaction.
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={t("dropHint")}
          className="flex items-center justify-center h-11 px-4 text-sm rounded-lg border border-dashed border-border-strong cursor-pointer hover:bg-surface-hover hover:border-accent transition-colors focus-visible:outline-2 focus-visible:outline-accent"
        >
          {uploading ? (
            <>
              <Loader2 size={16} className="animate-spin mr-2" />
              {t("uploading")}
            </>
          ) : value ? (
            <div className="flex items-center gap-2 w-full">
              <img src={value} alt="" className="h-8 w-8 object-cover rounded" />
              <span className="text-xs text-fg-secondary truncate flex-1 font-mono">{value}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="text-error"
              >
                <X size={14} />
              </Button>
            </div>
          ) : (
            <span className="text-fg-tertiary font-mono text-xs">{t("dropHint")}</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = ""; // Reset for re-upload
            }}
          />
        </div>
      )}

      {error && <p className="text-xs text-error font-mono">{error}</p>}
    </div>
  );
}
