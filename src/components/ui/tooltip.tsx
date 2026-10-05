"use client";

import { useId, useState, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

/**
 * Tooltip — solid surface, 1px strong border, mono micro text.
 * Shows on hover/focus. Supports top/bottom positioning.
 *
 * Accessibility: the tooltip bubble gets role="tooltip" and a unique id, and
 * the trigger element gets aria-describedby pointing at it while the tooltip
 * is shown, so icon-only buttons wrapped in a Tooltip are announced by
 * screen readers. Props API is unchanged.
 */
export function Tooltip({
  children,
  content,
  position = "top",
}: {
  children: React.ReactNode;
  content: string;
  position?: "top" | "bottom";
}) {
  const [show, setShow] = useState(false);
  const tooltipId = useId();

  // Attach aria-describedby to the trigger so assistive tech announces the
  // tooltip text. Existing aria-describedby values are preserved (appended).
  // Non-element children are rendered as-is (no breaking change).
  const trigger = isValidElement<{ "aria-describedby"?: string }>(children)
    ? cloneElement(children, {
        "aria-describedby":
          [children.props["aria-describedby"], show ? tooltipId : null]
            .filter(Boolean)
            .join(" ") || undefined,
      })
    : children;

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {trigger}
      {show && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            "absolute z-50 left-1/2 -translate-x-1/2",
            "px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-nowrap",
            "bg-surface text-fg-secondary border border-border-strong rounded-lg shadow-md",
            "max-w-[260px] animate-fade-in pointer-events-none",
            position === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
