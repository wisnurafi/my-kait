"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Tombol salin untuk code block di halaman docs. */
export function CopyButton({
  code,
  copyLabel,
  copiedLabel,
}: {
  code: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback untuk konteks non-secure / clipboard API diblokir.
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      title={copied ? copiedLabel : copyLabel}
      aria-label={copied ? copiedLabel : copyLabel}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-ink bg-surface text-fg-tertiary transition-colors hover:text-fg hover:border-border-strong cursor-pointer"
    >
      {copied ? (
        <Check size={14} className="text-success" />
      ) : (
        <Copy size={14} />
      )}
    </button>
  );
}
