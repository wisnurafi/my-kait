/**
 * Button — flat, precise, lime primary.
 * No gradients, no colored glows, no translate-lift. GPU-only press.
 */
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

type Variant = ButtonVariant;
type Size = ButtonSize;

const variantClasses: Record<Variant, string> = {
  // Lime fill, dark text, semibold. Hover: deepen.
  primary:
    "bg-accent text-[#0a0a0b] border-transparent hover:bg-accent-deep",
  // Surface fill, 1px ink border. Hover: surface-hover + strong border.
  secondary:
    "bg-surface text-fg border-border-ink hover:bg-surface-hover hover:border-border-strong",
  // Transparent. Hover: subtle surface wash.
  ghost:
    "bg-transparent text-fg-secondary border-transparent hover:bg-surface-hover hover:text-fg",
  // Solid error fill, white text. Hover: slightly transparent.
  destructive:
    "bg-error text-white border-transparent hover:bg-error/90",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-4 text-xs rounded-lg",
  md: "h-11 px-6 text-sm rounded-lg",
  lg: "h-14 px-10 text-base rounded-lg",
  icon: "h-10 w-10 text-sm rounded-lg",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/**
 * Shared class composition for button-styled elements.
 * Use this when the interactive element must be an anchor (e.g. next/link)
 * instead of a <button> — nesting <button> inside <a> is invalid HTML.
 */
export function buttonClasses(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-semibold",
    "cursor-pointer select-none border",
    "transition-colors duration-150 press",
    "disabled:opacity-45 disabled:cursor-not-allowed",
    "focus-ring",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonClasses(variant, size, className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
