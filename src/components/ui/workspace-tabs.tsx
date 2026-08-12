"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { classNames } from "@/lib/ui/classnames";

type WorkspaceTabItem<T extends string> = {
  value: T;
  label: string;
  count?: number;
  icon: LucideIcon;
};

type WorkspaceTabsProps<T extends string> = {
  items: ReadonlyArray<WorkspaceTabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  idBase: string;
  ariaLabel: string;
  className?: string;
};

export function workspaceTabId(idBase: string, value: string) {
  return `${idBase}-tab-${value}`;
}

export function workspaceTabPanelId(idBase: string, value: string) {
  return `${idBase}-panel-${value}`;
}

export function WorkspaceTabs<T extends string>({
  items,
  value,
  onChange,
  idBase,
  ariaLabel,
  className,
}: WorkspaceTabsProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      const activeTab = tabRefs.current.get(value);
      if (!scroller || !activeTab) return;

      const scrollerRect = scroller.getBoundingClientRect();
      const activeRect = activeTab.getBoundingClientRect();
      const edgePadding = 0;
      if (activeRect.left < scrollerRect.left + edgePadding) {
        scroller.scrollLeft +=
          activeRect.left - scrollerRect.left - edgePadding;
      } else if (activeRect.right > scrollerRect.right - edgePadding) {
        scroller.scrollLeft +=
          activeRect.right - scrollerRect.right + edgePadding;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  function focusTab(index: number) {
    const item = items[index];
    if (!item) return;
    onChange(item.value);
    window.requestAnimationFrame(() =>
      tabRefs.current.get(item.value)?.focus(),
    );
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % items.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    focusTab(nextIndex);
  }

  return (
    <div
      ref={scrollRef}
      className={classNames("workspace-tabs-scroll", className)}
    >
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
      >
        {items.map((item, index) => {
          const active = item.value === value;
          const Icon = item.icon;

          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={workspaceTabId(idBase, item.value)}
              aria-controls={workspaceTabPanelId(idBase, item.value)}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              ref={(node) => {
                if (node) tabRefs.current.set(item.value, node);
                else tabRefs.current.delete(item.value);
              }}
              className={classNames(
                "workspace-tab",
                active && "workspace-tab-active",
              )}
              onClick={() => onChange(item.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <Icon className="workspace-tab-icon" aria-hidden="true" />
              <span className="workspace-tab-label">
                {item.label}
                {typeof item.count === "number" && item.count > 0 ? (
                  <>
                    {" "}
                    <sup className="workspace-tab-count">{item.count}</sup>
                  </>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
