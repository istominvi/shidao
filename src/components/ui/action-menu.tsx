"use client";

import Link from "next/link";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
  triggerIcon?: LucideIcon;
  triggerVariant?: "secondary" | "ghost";
  portal?: boolean;
};

type PortalPosition = Pick<CSSProperties, "top" | "left" | "maxHeight">;

const PORTAL_GAP = 7;
const PORTAL_VIEWPORT_MARGIN = 8;
const PORTAL_FALLBACK_WIDTH = 240;

export function ActionMenu({
  label,
  items,
  disabled = false,
  className,
  triggerIcon: TriggerIcon = MoreHorizontal,
  triggerVariant = "secondary",
  portal = false,
}: ActionMenuProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [portalPosition, setPortalPosition] = useState<PortalPosition | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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

  const updatePortalPosition = useCallback(() => {
    if (!portal || !triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current?.getBoundingClientRect();
    const availableWidth = Math.max(
      window.innerWidth - PORTAL_VIEWPORT_MARGIN * 2,
      0,
    );
    const menuWidth = Math.min(
      menuRect?.width || PORTAL_FALLBACK_WIDTH,
      availableWidth,
    );
    const availableHeight = Math.max(
      window.innerHeight - PORTAL_VIEWPORT_MARGIN * 2,
      0,
    );
    const menuHeight = Math.min(menuRect?.height || 0, availableHeight);
    const maxLeft = Math.max(
      PORTAL_VIEWPORT_MARGIN,
      window.innerWidth - menuWidth - PORTAL_VIEWPORT_MARGIN,
    );
    const left = Math.min(
      Math.max(triggerRect.right - menuWidth, PORTAL_VIEWPORT_MARGIN),
      maxLeft,
    );
    const belowTop = triggerRect.bottom + PORTAL_GAP;
    const aboveTop = triggerRect.top - PORTAL_GAP - menuHeight;
    const opensAbove =
      menuHeight > 0 &&
      belowTop + menuHeight > window.innerHeight - PORTAL_VIEWPORT_MARGIN &&
      aboveTop >= PORTAL_VIEWPORT_MARGIN;
    const preferredTop = opensAbove ? aboveTop : belowTop;
    const maxTop = Math.max(
      PORTAL_VIEWPORT_MARGIN,
      window.innerHeight - menuHeight - PORTAL_VIEWPORT_MARGIN,
    );

    setPortalPosition({
      top: Math.min(Math.max(preferredTop, PORTAL_VIEWPORT_MARGIN), maxTop),
      left,
      maxHeight: availableHeight,
    });
  }, [portal]);

  const isEventInsideMenu = useCallback((event: Event) => {
    const path =
      typeof event.composedPath === "function" ? event.composedPath() : [];
    const rootNode = rootRef.current;
    const menuNode = menuRef.current;

    if (path.length > 0) {
      return path.some((node) => node === rootNode || node === menuNode);
    }

    const target = event.target as Node | null;
    return Boolean(
      target && (rootNode?.contains(target) || menuNode?.contains(target)),
    );
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (isEventInsideMenu(event)) return;
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
  }, [closeMenu, isEventInsideMenu, open]);

  useEffect(() => {
    if (!open || !portal) return;
    updatePortalPosition();

    window.addEventListener("resize", updatePortalPosition);
    window.addEventListener("scroll", updatePortalPosition, true);
    return () => {
      window.removeEventListener("resize", updatePortalPosition);
      window.removeEventListener("scroll", updatePortalPosition, true);
    };
  }, [open, portal, updatePortalPosition]);

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

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      className={classNames(
        "action-menu-panel",
        portal && "action-menu-panel-portal",
      )}
      role="menu"
      style={
        portal
          ? {
              position: "fixed",
              top: portalPosition?.top ?? 0,
              left: portalPosition?.left ?? 0,
              right: "auto",
              maxHeight: portalPosition?.maxHeight,
              overflowY: "auto",
              visibility: portalPosition ? "visible" : "hidden",
            }
          : undefined
      }
    >
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
  ) : null;

  return (
    <div ref={rootRef} className={classNames("action-menu-root", className)}>
      <button
        ref={triggerRef}
        type="button"
        className={productButtonClassName(
          triggerVariant,
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
        <TriggerIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      {portal && typeof document !== "undefined"
        ? menu && createPortal(menu, document.body)
        : menu}
    </div>
  );
}
