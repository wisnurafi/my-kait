/**
 * Badge — mono micro-label pills, semantic status tints.
 * `pulse` adds a pulsing status dot (great for "active" webhook status).
 */
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "active"
  | "success"
  | "warning"
  | "danger"
  | "error"
  | "info";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-hover text-fg-secondary border-border-ink",
  active: "bg-success-soft text-success border-success/30",
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-error-soft text-error border-error/30",
  error: "bg-error-soft text-error border-error/30",
  info: "bg-info-soft text-info border-info/30",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-fg-tertiary",
  active: "bg-success",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-error",
  error: "bg-error",
  info: "bg-info",
};

export function Badge({
  children,
  variant = "default",
  className,
  pulse = false,
  dot = false,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  /** Pulsing dot — use for live/active states */
  pulse?: boolean;
  /** Static status dot */
  dot?: boolean;
}) {
  const showDot = pulse || dot;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1",
        "font-mono text-[11px] font-medium uppercase tracking-wide leading-none",
        "rounded-full border",
        variantClasses[variant],
        className,
      )}
    >
      {showDot && (
        <span className={cn("status-dot", dotColors[variant], pulse && "pulsing")} />
      )}
      {children}
    </span>
  );
}

/**
 * Filter Chip — toggleable pill filter.
 */
export function FilterChip({
  children,
  active = false,
  onClick,
  className,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "px-4 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide leading-none",
        "rounded-full border cursor-pointer transition-colors duration-150 press",
        active
          ? "bg-accent text-[#0a0a0b] border-transparent"
          : "bg-surface text-fg-secondary border-border-ink hover:text-fg hover:border-border-strong",
        className,
      )}
    >
      {children}
    </button>
  );
}
