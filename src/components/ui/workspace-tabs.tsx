"use client";

import { useRef, type KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { classNames } from "@/lib/ui/classnames";

type WorkspaceTabItem<T extends string> = {
  value: T;
  label: string;
  count?: number;
  icon?: LucideIcon;
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
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());

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
    <div className={classNames("workspace-tabs-scroll", className)}>
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
              {Icon ? (
                <Icon className="workspace-tab-icon" aria-hidden="true" />
              ) : null}
              <span>{item.label}</span>
              {typeof item.count === "number" ? (
                <span className="workspace-tab-count">{item.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
