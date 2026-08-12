import Link from "next/link";
import type { ReactNode, Ref } from "react";
import { classNames } from "@/lib/ui/classnames";

type AppPageHeaderBack =
  | {
      type: "link";
      href: string;
      label?: ReactNode;
      ariaLabel?: string;
    }
  | {
      type: "button";
      onClick: () => void;
      label?: ReactNode;
      ariaLabel?: string;
    };

type AppPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  back?: AppPageHeaderBack;
  meta?: ReactNode;
  actions?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
};

export function AppPageHeader({
  title,
  description,
  back,
  meta,
  actions,
  headingRef,
}: AppPageHeaderProps) {
  const resolvedBackLabel = back?.label ?? "Назад";
  const resolvedBackAriaLabel =
    back?.ariaLabel ??
    (typeof resolvedBackLabel === "string"
      ? `Вернуться: ${resolvedBackLabel}`
      : undefined);
  return (
    <header
      className={classNames(
        "app-page-header",
        back && "app-page-header-with-back",
        Boolean(actions) && "app-page-header-with-actions",
      )}
    >
      <div className="app-page-header-content">
        {back?.type === "link" ? (
          <Link
            href={back.href}
            className="app-page-back-link"
            aria-label={resolvedBackAriaLabel}
          >
            <span className="app-page-back-link-icon" aria-hidden="true">
              ←
            </span>
            <span className="app-page-back-link-label">
              {resolvedBackLabel}
            </span>
          </Link>
        ) : back ? (
          <button
            type="button"
            className="app-page-back-link"
            aria-label={resolvedBackAriaLabel}
            onClick={back.onClick}
          >
            <span className="app-page-back-link-icon" aria-hidden="true">
              ←
            </span>
            <span className="app-page-back-link-label">
              {resolvedBackLabel}
            </span>
          </button>
        ) : null}
        <div className="app-page-heading">
          <h1
            ref={headingRef}
            className="app-page-title"
            tabIndex={headingRef ? -1 : undefined}
          >
            {title}
          </h1>
          {description ? (
            <p className="app-page-description">{description}</p>
          ) : null}
        </div>
        {meta ? <div className="app-page-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="app-page-actions">{actions}</div> : null}
    </header>
  );
}
