/**
 * EmptyState — unified empty state (item #3).
 *
 * Icon in a soft accent box, display title, muted description, CTA slot.
 * Own CSS classes (mk-*), not Tailwind overrides. All copy arrives via props
 * already translated — this component never calls useTranslations.
 */
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const emptyStateCss = `
.mk-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3rem 1.5rem;
}
.mk-empty-state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  background: var(--accent-primary-soft);
  border: 1px solid color-mix(in srgb, var(--accent-primary) 40%, transparent);
  color: var(--accent-primary);
  margin-bottom: 1rem;
}
.mk-empty-state-icon svg {
  width: 22px;
  height: 22px;
}
.mk-empty-state-title {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
  color: var(--fg);
  margin: 0 0 0.5rem;
}
.mk-empty-state-desc {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--fg-tertiary);
  max-width: 28rem;
  margin: 0;
}
.mk-empty-state-action {
  margin-top: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
`;

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("mk-empty-state", className)}>
      <style>{emptyStateCss}</style>
      <div className="mk-empty-state-icon" aria-hidden>
        {icon}
      </div>
      <h3 className="mk-empty-state-title">{title}</h3>
      {description ? <p className="mk-empty-state-desc">{description}</p> : null}
      {action ? <div className="mk-empty-state-action">{action}</div> : null}
    </div>
  );
}
