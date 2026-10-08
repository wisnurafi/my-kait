"use client";

/**
 * Dialog — solid panel modal (scale + fade, GPU only).
 * Usage:
 *   <Dialog open={open} onClose={() => setOpen(false)}>
 *     <DialogTitle>...</DialogTitle>
 *     <DialogBody>...</DialogBody>
 *     <DialogFooter>...</DialogFooter>
 *   </Dialog>
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  // Lock body scroll + Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Render via portal ke document.body: tanpa ini, ancestor yang punya
  // transform (mis. .stagger-in dengan animation fill forwards) menjadi
  // containing block untuk position:fixed, sehingga modal terjebak
  // mengikuti box container-nya, bukan viewport.
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Backdrop — plain dim, no blur */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={onClose}
            aria-hidden
          />
          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              "panel relative w-full max-w-md shadow-lg",
              className,
            )}
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <button
              onClick={onClose}
              aria-label={t("close")}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-fg-tertiary hover:text-fg hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-lg font-bold px-6 pt-6 pr-12", className)}>{children}</h3>;
}

export function DialogBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-6 py-4 text-sm text-fg-secondary", className)}>{children}</div>;
}

export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-6 pb-6 pt-2 flex justify-end gap-3", className)}>{children}</div>
  );
}

/**
 * ConfirmDialog — ready-made delete/destructive confirmation.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  loading = false,
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  loading?: boolean;
  danger?: boolean;
}) {
  const t = useTranslations("common");
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogBody>{message}</DialogBody>
      <DialogFooter>
        <button
          onClick={onClose}
          className="h-10 px-5 text-sm font-semibold rounded-lg border border-border-ink bg-surface text-fg-secondary hover:text-fg hover:border-border-strong transition-colors cursor-pointer"
        >
          {t("cancel")}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            "h-10 px-5 text-sm font-semibold rounded-lg border border-transparent transition-colors cursor-pointer disabled:opacity-50",
            danger
              ? "bg-error text-white hover:bg-error/90"
              : "bg-accent text-[#0a0a0b] hover:bg-accent-deep",
          )}
        >
          {loading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            confirmLabel
          )}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
