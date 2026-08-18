"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { LucideIcon } from "lucide-react";
import { classNames } from "@/lib/ui/classnames";

type SegmentedControlItem<T extends string> = {
  value: T;
  label: string;
  ariaLabel?: string;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
  busy?: boolean;
};

type SegmentedControlProps<T extends string> = {
  items: SegmentedControlItem<T>[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  iconOnly?: boolean;
};

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  className,
  iconOnly = false,
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef(new Map<T, HTMLButtonElement>());
  const [indicatorMotionReady, setIndicatorMotionReady] = useState(false);
  const [indicator, setIndicator] = useState({
    left: 0,
    width: 0,
    ready: false,
  });

  const updateIndicator = useCallback(() => {
    const group = groupRef.current;
    const selectedOption =
      value === null ? null : optionRefs.current.get(value);
    if (!group || !selectedOption) {
      setIndicator((current) =>
        current.ready ? { left: 0, width: 0, ready: false } : current,
      );
      return;
    }

    const groupRect = group.getBoundingClientRect();
    const selectedRect = selectedOption.getBoundingClientRect();
    if (selectedRect.width <= 0 || selectedRect.height <= 0) {
      setIndicator((current) =>
        current.ready ? { left: 0, width: 0, ready: false } : current,
      );
      return;
    }

    const nextIndicator = {
      left: selectedRect.left - groupRect.left - group.clientLeft,
      width: selectedRect.width,
      ready: true,
    };
    setIndicator((current) =>
      current.ready &&
      current.left === nextIndicator.left &&
      current.width === nextIndicator.width
        ? current
        : nextIndicator,
    );
  }, [value]);

  useLayoutEffect(() => {
    updateIndicator();
    const group = groupRef.current;
    if (!group) return;

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateIndicator);
      return () => window.removeEventListener("resize", updateIndicator);
    }

    const observer = new ResizeObserver(updateIndicator);
    observer.observe(group);
    for (const option of optionRefs.current.values()) observer.observe(option);
    return () => observer.disconnect();
  }, [items, updateIndicator]);

  const selectedItem =
    value === null ? undefined : items.find((item) => item.value === value);
  const indicatorVisible =
    indicator.ready &&
    selectedItem !== undefined &&
    !(disabled || selectedItem.disabled);

  useEffect(() => {
    if (!indicatorVisible) {
      setIndicatorMotionReady(false);
      return;
    }

    const frame = window.requestAnimationFrame(() =>
      setIndicatorMotionReady(true),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [indicatorVisible]);

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={ariaLabel}
      data-indicator-ready={indicatorVisible || undefined}
      className={classNames(
        "product-segmented-control",
        iconOnly
          ? "product-segmented-control-icon-only"
          : "product-segmented-control-text",
        className,
      )}
    >
      <span
        className="product-segmented-control-indicator"
        aria-hidden="true"
        data-ready={indicatorVisible || undefined}
        data-motion-ready={
          (indicatorVisible && indicatorMotionReady) || undefined
        }
        style={{
          width: `${indicator.width}px`,
          transform: `translate3d(${indicator.left}px, 0, 0)`,
        }}
      />
      {items.map((item) => {
        const Icon = item.icon;
        const isSelected = item.value === value;
        const isDisabled = disabled || item.disabled;

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={isSelected}
            aria-label={item.ariaLabel ?? (iconOnly ? item.label : undefined)}
            title={iconOnly ? item.label : undefined}
            ref={(node) => {
              if (node) optionRefs.current.set(item.value, node);
              else optionRefs.current.delete(item.value);
            }}
            disabled={isDisabled}
            onClick={() => onChange(item.value)}
            aria-busy={item.busy || undefined}
            className={classNames(
              "product-segmented-control-option",
              iconOnly
                ? "product-segmented-control-option-icon-only"
                : undefined,
              isSelected
                ? "product-segmented-control-option-selected"
                : undefined,
            )}
          >
            {Icon ? <Icon aria-hidden="true" /> : null}
            {!iconOnly ? <span>{item.label}</span> : null}
            {!iconOnly && item.count !== undefined ? (
              <span className="product-segmented-control-option-count">
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
