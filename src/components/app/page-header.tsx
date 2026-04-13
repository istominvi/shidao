import Link from "next/link";
import type { ReactNode } from "react";
import { classNames } from "@/lib/ui/classnames";

type AppPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  backHref?: string;
  backLabel?: ReactNode;
  backAriaLabel?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function AppPageHeader({
  title,
  description,
  eyebrow,
  backHref,
  backLabel,
  backAriaLabel,
  meta,
  actions,
  className,
}: AppPageHeaderProps) {
  const resolvedBackLabel = backLabel ?? "Назад";

  return (
    <header
      className={classNames(
        "app-page-header",
        className,
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          className="app-page-back-link"
          aria-label={
            backAriaLabel ??
            (typeof resolvedBackLabel === "string"
              ? `Вернуться: ${resolvedBackLabel}`
              : undefined)
          }
        >
          <span aria-hidden="true">←</span>
          <span>{resolvedBackLabel}</span>
        </Link>
      ) : null}
      {eyebrow ? <p className="app-page-eyebrow">{eyebrow}</p> : null}
      <h1 className="app-page-title">{title}</h1>
      {description ? (
        <p className="app-page-description">{description}</p>
      ) : null}
      {meta ? <div className="app-page-meta">{meta}</div> : null}
      {actions ? <div className="app-page-actions">{actions}</div> : null}
    </header>
  );
}
