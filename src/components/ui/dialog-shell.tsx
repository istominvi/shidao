"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
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
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const dialogPanel: HTMLElement = panel;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const focusableSelector = [
      "a[href]",
      "button:not([disabled]):not([tabindex='-1'])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    document.body.style.overflow = "hidden";
    if (!dialogPanel.contains(document.activeElement)) {
      const initialTarget =
        dialogPanel.querySelector<HTMLElement>("[autofocus]") ??
        dialogPanel.querySelector<HTMLElement>("[data-dialog-initial-focus]");
      (initialTarget ?? dialogPanel).focus();
    }

    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogPanel.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogPanel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialogPanel.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialogPanel.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return (
    <div className={classNames("dialog-shell-overlay", className)}>
      {closeHref ? (
        <Link
          href={closeHref}
          tabIndex={-1}
          className="dialog-shell-backdrop"
          aria-label={closeLabel}
        />
      ) : (
        <button
          type="button"
          tabIndex={-1}
          className="dialog-shell-backdrop"
          aria-label={closeLabel}
          onClick={onClose}
        />
      )}
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className={classNames("dialog-shell-panel", panelClassName)}
      >
        {hasHeader || onClose || closeHref ? (
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
              <Link
                href={closeHref}
                className="dialog-shell-close"
                aria-label={closeLabel}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : null}
          </header>
        ) : null}
        <div className={classNames("dialog-shell-body", bodyClassName)}>
          {children}
        </div>
        {footer ? (
          <footer className="dialog-shell-footer">{footer}</footer>
        ) : null}
      </section>
    </div>
  );
}
