"use client";

import Link from "next/link";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { productButtonClassName } from "@/components/ui/button";
import { classNames } from "@/lib/ui/classnames";

export type ActionMenuItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  hint?: string;
  destructive?: boolean;
  separatorBefore?: boolean;
};

type ActionMenuProps = {
  label: string;
  items: ReadonlyArray<ActionMenuItem>;
  disabled?: boolean;
  className?: string;
};

export function ActionMenu({
  label,
  items,
  disabled = false,
  className,
}: ActionMenuProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());

  const enabledItems = useMemo(
    () => items.filter((item) => !item.disabled),
    [items],
  );

  const closeMenu = useCallback(({ restoreFocus = true } = {}) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  const focusItem = useCallback(
    (index: number) => {
      const item = enabledItems[index];
      if (!item) return;
      itemRefs.current.get(item.id)?.focus();
    },
    [enabledItems],
  );

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      closeMenu({ restoreFocus: false });
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMenu();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeMenu, open]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => focusItem(0));
  }, [focusItem, open]);

  function handleItemKeyDown(
    event: KeyboardEvent<HTMLElement>,
    itemId: string,
  ) {
    const currentIndex = enabledItems.findIndex((item) => item.id === itemId);
    if (currentIndex < 0) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % enabledItems.length;
    } else if (event.key === "ArrowUp") {
      nextIndex =
        (currentIndex - 1 + enabledItems.length) % enabledItems.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = enabledItems.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    focusItem(nextIndex);
  }

  return (
    <div ref={rootRef} className={classNames("action-menu-root", className)}>
      <button
        ref={triggerRef}
        type="button"
        className={productButtonClassName(
          "secondary",
          "action-menu-trigger px-3",
        )}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {open ? (
        <div id={menuId} className="action-menu-panel" role="menu">
          {items.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                {Icon ? (
                  <Icon className="action-menu-item-icon" aria-hidden="true" />
                ) : null}
                <span className="min-w-0">
                  <span className="action-menu-item-label">{item.label}</span>
                  {item.hint ? (
                    <span className="action-menu-item-hint">{item.hint}</span>
                  ) : null}
                </span>
              </>
            );
            const itemClassName = classNames(
              "action-menu-item",
              item.destructive && "action-menu-item-destructive",
            );

            return (
              <div key={item.id}>
                {item.separatorBefore ? (
                  <div className="action-menu-separator" role="separator" />
                ) : null}
                {item.href && !item.disabled ? (
                  <Link
                    ref={(node) => {
                      if (node) itemRefs.current.set(item.id, node);
                      else itemRefs.current.delete(item.id);
                    }}
                    href={item.href}
                    role="menuitem"
                    className={itemClassName}
                    onKeyDown={(event) => handleItemKeyDown(event, item.id)}
                    onClick={() => closeMenu({ restoreFocus: false })}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    ref={(node) => {
                      if (node) itemRefs.current.set(item.id, node);
                      else itemRefs.current.delete(item.id);
                    }}
                    type="button"
                    role="menuitem"
                    className={itemClassName}
                    disabled={item.disabled}
                    aria-disabled={item.disabled || undefined}
                    onKeyDown={(event) => handleItemKeyDown(event, item.id)}
                    onClick={() => {
                      if (item.disabled) return;
                      // Move focus back synchronously before the menu item is
                      // unmounted. If the action opens a DialogShell, that
                      // dialog can now remember the trigger as its return
                      // target and restore focus there when it closes.
                      triggerRef.current?.focus();
                      setOpen(false);
                      item.onSelect?.();
                    }}
                  >
                    {content}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
