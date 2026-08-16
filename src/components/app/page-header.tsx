"use client";

import { type ReactNode, type Ref } from "react";
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
  metricPending?: boolean;
  back?: AppPageHeaderBack;
  meta?: ReactNode;
  actions?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
};

export function AppPageHeader({
  title,
  metric,
  metricPending,
  back,
  meta,
  actions,
  headingRef,
}: AppPageHeaderProps) {
  const pageTransition = usePageTransition();
  const usesAsyncMetric = metricPending !== undefined;
  const hasMetric = metric !== null && metric !== undefined && metric !== false;
  const metricIsPending = metricPending === true && !hasMetric;
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
      data-page-header-async-metric={usesAsyncMetric ? "" : undefined}
      data-page-header-pending={metricIsPending ? "" : undefined}
    >
      <div className="app-page-header-content">
        <div className="app-page-back-slot">
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
        </div>
        <div className="app-page-heading">
          <div className="app-page-title-row">
            <h1
              ref={headingRef}
              className="app-page-title"
              tabIndex={headingRef ? -1 : undefined}
            >
              {title}
            </h1>
            {actions ? <div className="app-page-actions">{actions}</div> : null}
          </div>
          {hasMetric || usesAsyncMetric ? (
            <p
              className="app-page-description app-page-metric"
              data-page-header-metric-placeholder={hasMetric ? undefined : ""}
              aria-busy={metricIsPending || undefined}
              aria-live={usesAsyncMetric ? "polite" : undefined}
              title={typeof metric === "string" ? metric : undefined}
            >
              {hasMetric ? metric : "\u00a0"}
            </p>
          ) : null}
        </div>
        {meta ? <div className="app-page-meta">{meta}</div> : null}
      </div>
    </header>
  );
}
