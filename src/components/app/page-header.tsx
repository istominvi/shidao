import Link from "next/link";
import type { ReactNode } from "react";

type AppPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  backHref?: string;
  backLabel?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AppPageHeader({
  title,
  description,
  eyebrow,
  backHref,
  backLabel,
  meta,
  actions,
  className,
}: AppPageHeaderProps) {
  return (
    <header className={joinClasses("app-page-header", className)}>
      {backHref ? (
        <Link href={backHref} className="app-page-back-link">
          <span aria-hidden="true">←</span>
          <span>{backLabel ?? "Назад"}</span>
        </Link>
      ) : null}
      {eyebrow ? <p className="app-page-eyebrow">{eyebrow}</p> : null}
      <h1 className="app-page-title">{title}</h1>
      {description ? <p className="app-page-description">{description}</p> : null}
      {meta ? <div className="app-page-meta">{meta}</div> : null}
      {actions ? <div className="app-page-actions">{actions}</div> : null}
    </header>
  );
}
