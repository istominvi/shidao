"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());
  const panelAnimationRef = useRef<Animation | null>(null);
  const previousValueRef = useRef(value);
  const pendingPanelTransitionRef = useRef<{
    direction: "forward" | "back";
    from: T;
    to: T;
  } | null>(null);
  const [indicatorMotionReady, setIndicatorMotionReady] = useState(false);
  const [indicator, setIndicator] = useState({
    left: 0,
    width: 0,
    ready: false,
  });

  const updateIndicator = useCallback(() => {
    const tabs = tabsRef.current;
    const activeTab = tabRefs.current.get(value);
    if (!tabs || !activeTab) {
      setIndicator((current) =>
        current.ready ? { left: 0, width: 0, ready: false } : current,
      );
      return;
    }

    const tabsRect = tabs.getBoundingClientRect();
    const activeTabRect = activeTab.getBoundingClientRect();
    const nextIndicator = {
      left: activeTabRect.left - tabsRect.left,
      width: activeTabRect.width,
      ready: true,
    };
    setIndicator((current) => {
      if (
        current.left === nextIndicator.left &&
        current.width === nextIndicator.width &&
        current.ready
      ) {
        return current;
      }
      return nextIndicator;
    });
  }, [value]);

  useLayoutEffect(() => {
    updateIndicator();
    const tabs = tabsRef.current;
    if (!tabs) return;

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateIndicator);
      return () => window.removeEventListener("resize", updateIndicator);
    }

    const observer = new ResizeObserver(updateIndicator);
    observer.observe(tabs);
    for (const tab of tabRefs.current.values()) observer.observe(tab);
    return () => observer.disconnect();
  }, [items, updateIndicator]);

  useEffect(() => {
    if (!indicator.ready) {
      setIndicatorMotionReady(false);
      return;
    }

    const frame = window.requestAnimationFrame(() =>
      setIndicatorMotionReady(true),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [indicator.ready]);

  useEffect(
    () => () => {
      panelAnimationRef.current?.cancel();
    },
    [],
  );

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

  useLayoutEffect(() => {
    const previousValue = previousValueRef.current;
    if (previousValue === value) return;

    const pendingTransition = pendingPanelTransitionRef.current;
    const previousIndex = items.findIndex(
      (item) => item.value === previousValue,
    );
    const nextIndex = items.findIndex((item) => item.value === value);
    const direction =
      pendingTransition?.from === previousValue &&
      pendingTransition.to === value
        ? pendingTransition.direction
        : nextIndex >= previousIndex
          ? "forward"
          : "back";

    previousValueRef.current = value;
    pendingPanelTransitionRef.current = null;

    panelAnimationRef.current?.cancel();
    panelAnimationRef.current = null;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const panel = document.getElementById(workspaceTabPanelId(idBase, value));
    if (!panel || panel.hidden || typeof panel.animate !== "function") return;

    const animation = panel.animate(
      [
        {
          opacity: 0.45,
          clipPath:
            direction === "forward" ? "inset(0 0 0 10px)" : "inset(0 10px 0 0)",
        },
        { opacity: 1, clipPath: "inset(0)" },
      ],
      {
        duration: 260,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );
    panelAnimationRef.current = animation;
    void animation.finished
      .catch(() => undefined)
      .finally(() => {
        if (panelAnimationRef.current === animation) {
          panelAnimationRef.current = null;
        }
      });
  }, [idBase, items, value]);

  function selectTab(
    nextValue: T,
    nextIndex: number,
    directionOverride?: "forward" | "back",
  ) {
    if (nextValue === value) return;
    const currentIndex = items.findIndex((item) => item.value === value);
    const direction =
      directionOverride ?? (nextIndex >= currentIndex ? "forward" : "back");
    pendingPanelTransitionRef.current = {
      direction,
      from: value,
      to: nextValue,
    };
    try {
      onChange(nextValue);
    } catch (error) {
      pendingPanelTransitionRef.current = null;
      throw error;
    }
  }

  function focusTab(index: number, direction?: "forward" | "back") {
    const item = items[index];
    if (!item) return;
    selectTab(item.value, index, direction);
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
    const direction =
      event.key === "ArrowRight"
        ? "forward"
        : event.key === "ArrowLeft"
          ? "back"
          : undefined;
    focusTab(nextIndex, direction);
  }

  return (
    <div
      ref={scrollRef}
      className={classNames("workspace-tabs-scroll", className)}
    >
      <div
        ref={tabsRef}
        className="workspace-tabs"
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        data-indicator-ready={indicator.ready || undefined}
      >
        <span
          className="workspace-tabs-indicator"
          aria-hidden="true"
          data-ready={indicator.ready || undefined}
          data-motion-ready={
            (indicator.ready && indicatorMotionReady) || undefined
          }
          style={{
            width: `${indicator.width}px`,
            transform: `translate3d(${indicator.left}px, 0, 0)`,
          }}
        />
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
              onClick={() => selectTab(item.value, index)}
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
