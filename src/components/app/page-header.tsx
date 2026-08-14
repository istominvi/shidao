"use client";

import type { ReactNode, Ref } from "react";
import { PageTransitionLink } from "@/components/navigation/page-transition-link";
import { usePageTransition } from "@/components/navigation/page-transition-provider";
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
  metric?: ReactNode;
  back?: AppPageHeaderBack;
  meta?: ReactNode;
  actions?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
};

export function AppPageHeader({
  title,
  metric,
  back,
  meta,
  actions,
  headingRef,
}: AppPageHeaderProps) {
  const pageTransition = usePageTransition();
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
          <PageTransitionLink
            href={back.href}
            direction="back"
            className="app-page-back-link"
            aria-label={resolvedBackAriaLabel}
          >
            <span className="app-page-back-link-icon" aria-hidden="true">
              ←
            </span>
            <span className="app-page-back-link-label">
              {resolvedBackLabel}
            </span>
          </PageTransitionLink>
        ) : back ? (
          <button
            type="button"
            className="app-page-back-link"
            aria-label={resolvedBackAriaLabel}
            onClick={() => {
              if (pageTransition) {
                pageTransition.runUpdate("back", back.onClick);
              } else {
                back.onClick();
              }
            }}
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
          {metric ? (
            <p className="app-page-description app-page-metric">{metric}</p>
          ) : null}
        </div>
        {meta ? <div className="app-page-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="app-page-actions">{actions}</div> : null}
    </header>
  );
}
