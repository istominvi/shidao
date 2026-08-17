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
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={classNames("product-segmented-control", className)}
    >
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
