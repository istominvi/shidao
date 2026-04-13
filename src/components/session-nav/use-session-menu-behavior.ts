"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type MenuPosition = { top: number; left: number };

const MENU_WIDTH = 288;
const MENU_GAP = 8;
const VIEWPORT_PADDING = 8;

export function useSessionMenuBehavior(portalMenu: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const updateMenuPosition = useCallback(() => {
    if (!portalMenu || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const maxLeft = window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING;
    setMenuPosition({
      top: rect.bottom + MENU_GAP,
      left: Math.min(Math.max(rect.right - MENU_WIDTH, VIEWPORT_PADDING), maxLeft),
    });
  }, [portalMenu]);

  const isEventWithinMenu = useCallback((event: Event) => {
    const path =
      typeof event.composedPath === "function" ? event.composedPath() : [];
    const containerNode = containerRef.current;
    const menuNode = menuRef.current;

    if (path.length > 0) {
      return path.some((node) => node === containerNode || node === menuNode);
    }

    const target = event.target as Node | null;
    return Boolean(
      target && (containerNode?.contains(target) || menuNode?.contains(target)),
    );
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!isEventWithinMenu(event)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isEventWithinMenu, open]);

  useEffect(() => {
    if (!open || !portalMenu) return;

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, portalMenu, updateMenuPosition]);

  return {
    open,
    setOpen,
    menuPosition,
    containerRef,
    menuRef,
  };
}
