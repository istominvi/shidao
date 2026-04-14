"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { classNames } from "@/lib/ui/classnames";

type DialogShellProps = {
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  closeHref?: string;
  closeLabel?: string;
  className?: string;
  panelClassName?: string;
  bodyClassName?: string;
};

export function DialogShell({
  title,
  description,
  footer,
  children,
  onClose,
  closeHref,
  closeLabel = "Закрыть",
  className,
  panelClassName,
  bodyClassName,
}: DialogShellProps) {
  const titleId = useId();
  const descriptionId = useId();
  const hasHeader = Boolean(title || description);

  return (
    <div className={classNames("dialog-shell-overlay", className)}>
      {closeHref ? (
        <Link
          href={closeHref}
          className="dialog-shell-backdrop"
          aria-label={closeLabel}
        />
      ) : (
        <button
          type="button"
          className="dialog-shell-backdrop"
          aria-label={closeLabel}
          onClick={onClose}
        />
      )}
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className={classNames("dialog-shell-panel", panelClassName)}
      >
        {(hasHeader || onClose || closeHref) ? (
          <header className="dialog-shell-header">
            <div className="min-w-0">
              {title ? (
                <h2 id={titleId} className="dialog-shell-title">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descriptionId} className="dialog-shell-description">
                  {description}
                </p>
              ) : null}
            </div>
            {onClose ? (
              <button
                type="button"
                className="dialog-shell-close"
                onClick={onClose}
                aria-label={closeLabel}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : closeHref ? (
              <Link href={closeHref} className="dialog-shell-close" aria-label={closeLabel}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : null}
          </header>
        ) : null}
        <div className={classNames("dialog-shell-body", bodyClassName)}>{children}</div>
        {footer ? <footer className="dialog-shell-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
