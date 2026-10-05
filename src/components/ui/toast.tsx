"use client";

/**
 * Toast — lightweight toast system.
 * Usage:
 *   import { toast, Toaster } from "@/components/ui/toast";
 *   toast.success("Pesan terkirim!");
 *   toast.error("Gagal mengirim");
 *   // Render <Toaster /> once in app layout.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

let nextId = 1;
const listeners = new Set<(t: ToastItem) => void>();

function emit(kind: ToastKind, message: string) {
  const item = { id: nextId++, kind, message };
  listeners.forEach((fn) => fn(item));
}

export const toast = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
  info: (message: string) => emit("info", message),
};

const kindStyles: Record<ToastKind, { icon: typeof CheckCircle2; ring: string; iconColor: string }> = {
  success: { icon: CheckCircle2, ring: "border-[rgba(74,222,128,0.4)]", iconColor: "text-success" },
  error: { icon: XCircle, ring: "border-[rgba(248,113,113,0.4)]", iconColor: "text-error" },
  info: { icon: Info, ring: "border-[rgba(125,211,252,0.4)]", iconColor: "text-info" },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const add = (t: ToastItem) => {
      setItems((prev) => [...prev.slice(-3), t]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 3800);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  return (
    <div
      className="fixed bottom-6 right-6 z-[120] flex flex-col gap-2 items-end pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {items.map((t) => {
          const s = kindStyles[t.kind];
          const Icon = s.icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              // Errors are announced assertively so failures are never missed
              role={t.kind === "error" ? "alert" : undefined}
              className={cn(
                "pointer-events-auto flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-lg border",
                "bg-surface shadow-md",
                s.ring,
              )}
            >
              <Icon size={20} className={s.iconColor} />
              <span className="text-sm font-semibold max-w-xs">{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
