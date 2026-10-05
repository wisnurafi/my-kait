/**
 * PageHeader — unified page header (item #4, covers Editor too).
 *
 * Layout: flex wrap. Left = optional media + (mono uppercase eyebrow +
 * display title + description). Right = actions slot.
 * The eyebrow automatically carries the `cursor-blink` class (blinking block
 * cursor, class provided by the CSS agent's stylesheet).
 * All copy arrives via props already translated — this component never
 * calls useTranslations. Own CSS classes (mk-*), not Tailwind overrides.
 */
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  media?: React.ReactNode;
  className?: string;
}

const pageHeaderCss = `
.mk-page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem 1.5rem;
}
.mk-page-header-main {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}
.mk-page-header-media {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.mk-page-header-eyebrow {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--fg-tertiary);
  margin-bottom: 0.35rem;
}
.mk-page-header-title {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--fg);
  margin: 0;
}
.mk-page-header-desc {
  margin: 0.5rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--fg-secondary);
  max-width: 42rem;
}
.mk-page-header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
@media (max-width: 640px) {
  .mk-page-header-title {
    font-size: 1.5rem;
  }
}
`;

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  media,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mk-page-header", className)}>
      <style>{pageHeaderCss}</style>
      <div className="mk-page-header-main">
        {media ? <div className="mk-page-header-media">{media}</div> : null}
        <div>
          <div className={cn("mk-page-header-eyebrow", "cursor-blink")}>
            {eyebrow}
          </div>
          <h1 className="mk-page-header-title">{title}</h1>
          {description ? (
            <p className="mk-page-header-desc">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="mk-page-header-actions">{actions}</div>
      ) : null}
    </header>
  );
}
